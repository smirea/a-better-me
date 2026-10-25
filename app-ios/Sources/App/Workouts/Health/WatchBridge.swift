import Foundation
import GRDB
import Observation
import WatchConnectivity

/// The phone's end of the watch app's link. In a workout the snapshot goes over the mirrored session's data channel when
/// the watch records, and over WatchConnectivity otherwise; the application context always holds the latest home list
/// and snapshot, so a watch app that opens later starts from them. Commands come back the same ways and go to
/// `LiveWorkoutController.perform`, so the phone stays the session's only writer.
@MainActor @Observable
final class WatchBridge: NSObject {
    static let shared = WatchBridge()

    private(set) var isWatchAppInstalled = false
    private(set) var isActivated = false
    @ObservationIgnored private var activationWaiters: [CheckedContinuation<Void, Never>] = []

    @ObservationIgnored private var store: LocalStore?
    @ObservationIgnored private var catalog: ExerciseCatalog?
    @ObservationIgnored private var homeObservation: AnyDatabaseCancellable?
    @ObservationIgnored private var home = WatchHome(workouts: [])
    @ObservationIgnored private var snapshot: LiveWorkoutSnapshot?

    private var session: WCSession? { WCSession.isSupported() ? .default : nil }

    /// Returns once WatchConnectivity knows whether the watch app is installed. Until then `isWatchAppInstalled` is
    /// false even with a watch, and a workout in progress at launch would start recording on the phone.
    func activated() async {
        guard session != nil, !isActivated else { return }
        await withCheckedContinuation { activationWaiters.append($0) }
    }

    func start(store: LocalStore, catalog: ExerciseCatalog) {
        guard self.store == nil, let session else { return }
        self.store = store
        self.catalog = catalog
        session.delegate = self
        session.activate()
        homeObservation = ValueObservation.tracking { db in
            try HomeInputs(
                templates: WorkoutTemplate.all.fetch(db), program: Program.active.fetch(db), finished: WorkoutSession.finished.fetch(db)
            )
        }
        .removeDuplicates()
        .start(
            in: store.database.pool,
            scheduling: .immediate,
            onError: { LocalStore.log.error("Watch home observation failed: \(String(describing: $0))") },
            onChange: { [weak self] in self?.publish($0) }
        )
        track()
    }

    private struct HomeInputs: Equatable, Sendable {
        var templates: [WorkoutTemplate]
        var program: Program?
        var finished: [WorkoutSession]
    }

    private func publish(_ inputs: HomeInputs) {
        guard let catalog else { return }
        let byID = Dictionary(inputs.templates.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        func option(_ template: WorkoutTemplate, program: String?) -> WatchWorkoutOption {
            let exercises = template.blocks.flatMap(\.exercises)
            return WatchWorkoutOption(
                id: template.id, name: template.name, program: program,
                exercises: exercises.map { catalog.name($0.exerciseID) }, totalSets: exercises.flatMap(\.sets).count
            )
        }
        var workouts: [WatchWorkoutOption] = []
        if let program = inputs.program, let next = program.upNext(after: inputs.finished),
           let templateID = program.days.first(where: { $0.id == next.dayID })?.templateID, let template = byID[templateID] {
            workouts.append(option(template, program: program.name))
        }
        workouts += inputs.templates.filter { $0.programID == nil && !$0.isArchived }.map { option($0, program: nil) }
        home = WatchHome(workouts: workouts)
        updateContext()
    }

    private func track() {
        let next = withObservationTracking { LiveWorkoutController.shared.snapshot } onChange: {
            Task { @MainActor in WatchBridge.shared.track() }
        }
        let ended = snapshot.flatMap { previous in next?.status.sessionID == previous.status.sessionID ? nil : previous }
        snapshot = next
        if let ended { sendFinished(ended.status.sessionID, health: nil, last: ended) }
        send(.snapshot(next))
        updateContext()
    }

    // MARK: Sending

    /// The current home list and workout, right away: a watch app just opened, or a mirrored session just connected.
    func sendState() {
        send(.home(home))
        send(.snapshot(snapshot))
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
    /// (seen between paired simulators), and an update skipped then left the watch on an old snapshot.
    private func updateContext() {
        guard let session, session.activationState == .activated, session.isPaired else { return }
        var context: [String: Any] = [:]
        if let data = try? WatchMessage.home(home).encoded() { context[WatchMessage.homeKey] = data }
        if let data = try? WatchMessage.snapshot(snapshot).encoded() { context[WatchMessage.snapshotKey] = data }
        do { try session.updateApplicationContext(context) } catch WCError.watchAppNotInstalled {} catch {
            LocalStore.log.error("Updating the watch's context failed: \(String(describing: error))")
        }
    }

    /// The watch's finish screen. `last` is the snapshot before the workout ended, when it just did.
    func sendFinished(_ id: UUID, health: WorkoutHealthSummary?, last: LiveWorkoutSnapshot? = nil) {
        guard let store, let catalog,
              let session = try? store.read({ try WorkoutSession.fetchOne($0, key: WorkoutSession.key(id)) }),
              let endedAt = session.endedAt else { return }
        let volume = SessionRecords.stats(in: session.blocks, catalog: catalog.exercise).values.reduce(0) { $0 + $1.volumeKg }
        let summary = WatchWorkoutSummary(
            sessionID: id, name: session.name,
            duration: endedAt.timeIntervalSince(session.startedAt) - TimeInterval(session.pausedSeconds),
            completedSets: session.blocks.allRows.count { session.blocks.log(at: $0) != nil },
            volumeKg: volume, unit: last?.status.unit ?? snapshot?.status.unit ?? .lb, health: health ?? session.health
        )
        send(.finished(summary))
    }

    // MARK: Receiving

    func receive(_ message: WatchMessage) {
        switch message {
        case .command(let command): LiveWorkoutController.shared.perform(command)
        case .start(let templateID): startWorkout(templateID)
        case .recorded(let sessionID, let summary): WorkoutHealth.shared.save(summary, for: sessionID)
        case .hello: sendState()
        case .recordingStarted: WorkoutHealth.shared.watchStartedRecording()
        case .stats(let stats): WorkoutHealth.shared.receiveWatchStats(stats)
        case .snapshot, .home, .finished, .record, .discardRecording: break
        }
    }

    /// Starts a workout from the watch's list, as a program day when the template is one. With a workout already in
    /// progress the watch just shows that one.
    private func startWorkout(_ templateID: UUID) {
        store?.write { db in
            guard try WorkoutSession.inProgress.fetch(db) == nil,
                  let template = try WorkoutTemplate.fetchOne(db, key: WorkoutTemplate.key(templateID)) else { return }
            let session = if let programID = template.programID, let program = try Program.fetchOne(db, key: Program.key(programID)),
                             let day = program.day(for: template.id) {
                program.session(startingFrom: template, dayID: day.id, gymID: template.gymID)
            } else {
                WorkoutSession(startingFrom: template)
            }
            try session.atStartingGym(db).insert(db)
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
