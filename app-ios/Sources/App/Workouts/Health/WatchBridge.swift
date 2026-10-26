import Foundation
import GRDB
import Observation
import WatchConnectivity

/// The phone's end of the watch app's link. The phone sends the workout in progress as a `WatchWorkout` the watch can
/// run alone, and a ready-to-start plan per workout on the watch's home list. The watch sends back its outbox of
/// `WatchEvent`s, which `LiveWorkoutController` applies and acknowledges. In a workout messages take the mirrored
/// session's data channel when it works and WatchConnectivity otherwise; the application context always holds the
/// latest home list and workout, so a watch app that opens later starts from them.
@MainActor @Observable
final class WatchBridge: NSObject {
    static let shared = WatchBridge()

    private(set) var isWatchAppInstalled = false
    private(set) var isActivated = false
    @ObservationIgnored private var activationWaiters: [CheckedContinuation<Void, Never>] = []

    @ObservationIgnored private var store: LocalStore?
    @ObservationIgnored private var catalog: ExerciseCatalog?
    @ObservationIgnored private var history: SessionHistory?
    @ObservationIgnored private var homeInputs: HomeInputs?
    @ObservationIgnored private var isTrackingHistory = false
    @ObservationIgnored private var homeObservation: AnyDatabaseCancellable?
    @ObservationIgnored private var home = WatchHome(workouts: [])
    @ObservationIgnored private var workout: WatchWorkout?
    /// Event ids the watch sent lately, newest last.
    @ObservationIgnored private var heardOrder: [UUID] = []
    @ObservationIgnored private var heard: Set<UUID> = []

    private var session: WCSession? { WCSession.isSupported() ? .default : nil }

    /// Returns once WatchConnectivity knows whether the watch app is installed. Until then `isWatchAppInstalled` is
    /// false even with a watch, and a workout in progress at launch would start recording on the phone.
    func activated() async {
        guard session != nil, !isActivated else { return }
        await withCheckedContinuation { activationWaiters.append($0) }
    }

    func start(store: LocalStore, history: SessionHistory, catalog: ExerciseCatalog) {
        guard self.store == nil, let session else { return }
        self.store = store
        self.catalog = catalog
        self.history = history
        session.delegate = self
        session.activate()
        homeObservation = ValueObservation.trackingConstantRegion { db in
            try HomeInputs(
                templates: WorkoutTemplate.all.fetch(db), program: Program.active.fetch(db),
                gyms: GymProfile.all.fetch(db), defaultGym: GymProfile.defaultGym.fetch(db)
            )
        }
        .removeDuplicates()
        .start(
            in: store.database.pool,
            scheduling: .immediate,
            onError: { LocalStore.log.error("Watch home observation failed: \(String(describing: $0))") },
            onChange: { [weak self] in
                self?.homeInputs = $0
                self?.publish()
            }
        )
        track()
    }

    private struct HomeInputs: Equatable, Sendable {
        var templates: [WorkoutTemplate]
        var program: Program?
        var gyms: [GymProfile]
        var defaultGym: GymProfile?
    }

    /// Runs again whenever the inputs or the history change.
    private func publish() {
        guard let catalog, let history, let inputs = homeInputs else { return }
        let finished = isTrackingHistory ? history.sessions : withObservationTracking { history.sessions } onChange: {
            Task { @MainActor in
                WatchBridge.shared.isTrackingHistory = false
                WatchBridge.shared.publish()
            }
        }
        isTrackingHistory = true
        let byID = Dictionary(inputs.templates.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        let blocks = finished.map(\.blocks)
        func option(_ template: WorkoutTemplate, program: String?, session: WorkoutSession) -> WatchWorkoutOption {
            var session = session
            session.gymID = session.gymID ?? inputs.defaultGym?.id
            let gym = inputs.gyms.first { $0.id == session.gymID }
            let exercises = session.blocks.flatMap(\.exercises)
            return WatchWorkoutOption(
                id: template.id, name: template.name, program: program,
                exercises: exercises.map { catalog.name($0.exerciseID) }, totalSets: exercises.flatMap(\.sets).count,
                plan: LiveWorkoutController.shared.watchWorkout(for: session, history: blocks, gym: gym, isLive: false)
            )
        }
        var workouts: [WatchWorkoutOption] = []
        if let program = inputs.program, let next = program.upNext(after: finished),
           let templateID = program.days.first(where: { $0.id == next.dayID })?.templateID, let template = byID[templateID] {
            let session = program.session(startingFrom: template, dayID: next.dayID, gymID: template.gymID)
            workouts.append(option(template, program: program.name, session: session))
        }
        workouts += inputs.templates.filter { $0.programID == nil && !$0.isArchived }.map {
            option($0, program: nil, session: WorkoutSession(startingFrom: $0))
        }
        home = WatchHome(workouts: workouts)
        updateContext()
    }

    private func track() {
        let live = withObservationTracking {
            (LiveWorkoutController.shared.watchWorkout, LiveWorkoutController.shared.acknowledgedWatchEvents)
        } onChange: {
            Task { @MainActor in WatchBridge.shared.track() }
        }.0
        if let live {
            workout = live
        } else if let current = workout, !current.isFinished {
            // The workout left the in-progress query. A finished one stays the watch's copy, with `endedAt`, so a
            // watch that hears this before the earlier copies still sees the end, saves its recording, and shows the
            // summary. A discarded one is gone, and `WorkoutHealth` tells the watch.
            workout = finishedCopy(of: current.sessionID)
            if let workout { deliver(.workout(workout, acknowledged: acknowledged)) }
        }
        send(.workout(workout, acknowledged: acknowledged))
        updateContext()
    }

    private func finishedCopy(of id: UUID) -> WatchWorkout? {
        guard let store, let session = try? store.read({ try WorkoutSession.fetchOne($0, key: WorkoutSession.key(id)) }),
              session.endedAt != nil else { return nil }
        return LiveWorkoutController.shared.watchWorkout(for: session, history: [], gym: nil, isLive: false)
    }

    /// The acknowledged events the watch may still hold: the ones it sent lately. The phone's list of applied events is
    /// far longer than any outbox.
    private var acknowledged: [UUID] {
        LiveWorkoutController.shared.acknowledgedWatchEvents.filter(heard.contains)
    }

    // MARK: Sending

    /// The current home list and workout, right away: a watch app just opened, or a mirrored session just connected.
    func sendState() {
        send(.home(home))
        send(.workout(workout, acknowledged: acknowledged))
    }

    private func send(_ message: WatchMessage) {
        guard let data = try? message.encoded() else { return }
        if let mirror = WorkoutHealth.shared.mirror {
            Task {
                do { try await mirror.send(message) } catch { self.sendMessage(data) }
            }
        } else {
            sendMessage(data)
        }
    }

    private func sendMessage(_ data: Data) {
        guard let session, session.activationState == .activated, session.isReachable else { return }
        session.sendMessage([WatchMessage.messageKey: data], replyHandler: nil)
    }

    /// What must arrive even if the watch app is closed, like the plan that saves its recording: right away when the
    /// watch is reachable, else queued as user info, which WatchConnectivity delivers once it is.
    func deliver(_ message: WatchMessage) {
        guard let session, session.activationState == .activated, let data = try? message.encoded() else { return }
        let payload = [WatchMessage.messageKey: data]
        guard session.isReachable else {
            session.transferUserInfo(payload)
            return
        }
        // WatchConnectivity calls the error handler on its own queue.
        session.sendMessage(payload, replyHandler: nil) { @Sendable _ in WCSession.default.transferUserInfo(payload) }
    }

    /// Not gated on `isWatchAppInstalled`, which reads false for seconds at a time while the watch app is installed
    /// (seen between paired simulators), and an update skipped then left the watch on an old workout.
    private func updateContext() {
        guard let session, session.activationState == .activated, session.isPaired else { return }
        var context: [String: Any] = [:]
        if let data = try? WatchMessage.home(home).encoded() { context[WatchMessage.homeKey] = data }
        if let data = try? WatchMessage.workout(workout, acknowledged: acknowledged).encoded() { context[WatchMessage.workoutKey] = data }
        do { try session.updateApplicationContext(context) } catch WCError.watchAppNotInstalled {} catch {
            LocalStore.log.error("Updating the watch's context failed: \(String(describing: error))")
        }
    }

    // MARK: Receiving

    func receive(_ message: WatchMessage) {
        switch message {
        case .events(let events):
            for event in events where !heard.contains(event.id) {
                heardOrder.append(event.id)
                heard.insert(event.id)
            }
            if heardOrder.count > 400 {
                heardOrder.removeFirst(heardOrder.count - 400)
                heard = Set(heardOrder)
            }
            events.forEach(LiveWorkoutController.shared.apply)
            // Events applied before are skipped without a change to observe, so the watch hears their ids right away.
            send(.workout(workout, acknowledged: acknowledged))
        case .recorded(let sessionID, let summary): WorkoutHealth.shared.save(summary, for: sessionID)
        case .hello: sendState()
        case .recordingStarted: WorkoutHealth.shared.watchStartedRecording()
        case .stats(let stats): WorkoutHealth.shared.receiveWatchStats(stats)
        case .workout, .home, .discardRecording: break
        }
    }
}

extension WatchBridge: WCSessionDelegate {
    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: (any Error)?) {
        let installed = session.isPaired && session.isWatchAppInstalled
        Task { @MainActor in
            isWatchAppInstalled = installed
            isActivated = true
            for waiter in activationWaiters { waiter.resume() }
            activationWaiters = []
            updateContext()
        }
    }

    nonisolated func sessionWatchStateDidChange(_ session: WCSession) {
        let installed = session.isPaired && session.isWatchAppInstalled
        Task { @MainActor in
            isWatchAppInstalled = installed
            updateContext()
        }
    }

    /// A message sent while the watch was unreachable was dropped, so the watch gets the current state once it is back.
    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        guard session.isReachable else { return }
        Task { @MainActor in sendState() }
    }

    nonisolated func sessionDidBecomeInactive(_ session: WCSession) {}

    nonisolated func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        receive(data: message[WatchMessage.messageKey] as? Data)
    }

    nonisolated func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        receive(data: userInfo[WatchMessage.messageKey] as? Data)
    }

    private nonisolated func receive(data: Data?) {
        guard let data, let message = try? WatchMessage(data) else { return }
        Task { @MainActor in WatchBridge.shared.receive(message) }
    }
}
