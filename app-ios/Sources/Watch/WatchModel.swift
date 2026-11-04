import Foundation
import HealthKit
import Observation
import WatchConnectivity
import WatchKit

/// The watch app's whole state. A workout runs here on its own in `replica`, so a set logged with the phone out of
/// reach shows at once and reaches the phone whenever it is back. The replica and the home list are saved to disk,
/// so a relaunch mid-workout resumes. The watch also records the workout in Health and saves it when the workout ends.
@MainActor @Observable
final class WatchModel: NSObject {
    static let shared = WatchModel()

    private(set) var home: WatchHome?
    private(set) var replica = WatchReplica()
    private(set) var workout: WatchWorkout?
    /// The Health numbers of finished workouts, for the summary.
    private(set) var health: [UUID: WorkoutHealthSummary] = [:]
    private(set) var recording: WorkoutRecording?
    private(set) var stats: WorkoutRecording.Stats?
    /// 220 minus the owner's age from Health, else a 30-year-old's.
    private(set) var maxHeartRate = 190.0
    private(set) var isPhoneReachable = false
    /// Rows logged or skipped on this watch in the current workout, newest last, so Undo reverses a skip as well.
    private(set) var actedRows: [UUID] = []

    @ObservationIgnored let healthStore = HKHealthStore()
    /// Set once a message arrives over the recording's data channel, which proves the phone holds its mirror. Until
    /// then everything goes over WatchConnectivity: a mirror can start here and never reach the phone.
    @ObservationIgnored private var isMirrorConfirmed = false
    @ObservationIgnored private var lastStatsSent = Date.distantPast
    @ObservationIgnored private var connectivityTasks: [WKWatchConnectivityRefreshBackgroundTask] = []
    @ObservationIgnored private var pendingContentObservation: NSKeyValueObservation?
    /// A save outlives the delivery that triggered it; the refresh task stays held until it lands.
    @ObservationIgnored private var savesInFlight = 0
    @ObservationIgnored private var savedRecording: UUID?
    @ObservationIgnored private var isStartingRecording = false
    /// Sessions the phone told this watch not to record: discarded, or recorded on the phone by an older build.
    @ObservationIgnored private var standDown: Set<UUID> = []

    var metrics: LiveHealthMetrics? { stats?.live }

    func activate() {
        restore()
        recordIfNeeded()
        Task { await loadMaxHeartRate() }
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        pendingContentObservation = WCSession.default.observe(\.hasContentPending) { _, _ in
            Task { @MainActor in WatchModel.shared.completeConnectivityTasks() }
        }
        WCSession.default.activate()
    }

    /// Asks the phone to resend its state and resends the outbox. Messages sent while this app was suspended are dropped.
    func requestState() {
        sendOverConnectivity(.hello, queued: false)
        flush()
        recordIfNeeded()
    }

    func hold(_ task: WKWatchConnectivityRefreshBackgroundTask) {
        connectivityTasks.append(task)
        completeConnectivityTasks()
    }

    private func completeConnectivityTasks() {
        guard WCSession.default.activationState == .activated, !WCSession.default.hasContentPending, savesInFlight == 0 else { return }
        for task in connectivityTasks { task.setTaskCompletedWithSnapshot(false) }
        connectivityTasks = []
    }

    // MARK: Workout

    /// Starts a home-list workout here, with or without the phone. The phone inserts the same session when the start
    /// event reaches it.
    func start(_ option: WatchWorkoutOption) {
        guard let plan = option.plan, workout.map(\.isFinished) ?? true else { return }
        let start = replica.start(plan, at: .now)
        health = [:]
        savedRecording = nil
        actedRows = []
        deliver(start)
        WKInterfaceDevice.current().play(.start)
        beginRecording(for: start.sessionID, from: start.at, askingForAccess: true)
    }

    /// Applies what the owner did here at once and queues it for the phone.
    func act(_ kind: WatchEvent.Kind) {
        guard workout != nil, let event = replica.record(kind, at: .now) else { return }
        switch kind {
        case .log(let rowID, _), .skip(let rowID): actedRows.append(rowID)
        default: break
        }
        deliver(event)
        switch kind {
        case .log: WKInterfaceDevice.current().play(.success)
        case .skip: WKInterfaceDevice.current().play(.directionUp)
        case .finish: WKInterfaceDevice.current().play(.stop)
        case .discard:
            recording?.discard()
            recording = nil
            stats = nil
            close()
        default: break
        }
    }

    func dismissSummary() {
        guard workout?.isFinished == true else { return }
        close()
    }

    private func close() {
        replica.close()
        actedRows = []
        refresh()
    }

    /// What Undo reverses: the latest row this watch logged or skipped that still is, else the latest logged row.
    var undoRow: UUID? {
        guard let workout else { return nil }
        let blocks = workout.blocks
        let acted = actedRows.last { id in blocks.path(of: id).map { blocks.log(at: $0) != nil || blocks.isSkipped(at: $0) } ?? false }
        return acted ?? lastLoggedRow
    }

    private var lastLoggedRow: UUID? {
        guard let workout else { return nil }
        return workout.blocks.allRows
            .compactMap { path in workout.blocks.log(at: path).map { (path, $0.completedAt) } }
            .max { $0.1 < $1.1 }
            .map { workout.blocks.rowID(at: $0.0) }
    }

    private func deliver(_ event: WatchEvent) {
        refresh()
        // User info is delivered in order even after this app is suspended; the message is the fast path.
        if let data = try? WatchMessage.events([event]).encoded() { WCSession.default.transferUserInfo([WatchMessage.messageKey: data]) }
        flush()
    }

    private func flush() {
        guard !replica.outbox.isEmpty else { return }
        send(.events(replica.outbox))
    }

    private func refresh() {
        let next = replica.workout
        if next != workout { workout = next }
        if let workout { recording?.session.follow(paused: workout.pausedAt != nil) }
        if let workout, workout.isFinished { saveRecording(for: workout) }
        persist()
        recordIfNeeded()
    }

    // MARK: Recording

    /// The phone started a workout and launched this app to record it.
    func startRecording() {
        guard recording == nil else {
            // The phone relaunched and asks again; it needs to hear that this watch already records.
            return sendOverConnectivity(.recordingStarted, queued: true)
        }
        // The phone's copy of its workout may not have arrived yet, so this start isn't tied to a session.
        beginRecording(for: nil, from: .now, askingForAccess: true)
    }

    /// Records the workout on screen whenever nothing on this watch does. Heart rate only comes from a session running
    /// here, and a workout the phone started before this app was installed, or before it could launch it, had none, so
    /// the stats page stayed blank. The new session starts at the workout's start, and the phone hands its own
    /// recording over when it hears `recordingStarted`. Health access is asked for only while the app is on screen;
    /// in the background (a relaunch, `handleActiveWorkoutRecovery`) only an access already settled counts.
    func recordIfNeeded() {
        guard recording == nil, let workout, !workout.isFinished, !standDown.contains(workout.sessionID) else { return }
        beginRecording(for: workout.sessionID, from: workout.startedAt, askingForAccess: WKApplication.shared().applicationState == .active)
    }

    /// Takes back the session HealthKit kept running across a relaunch, else starts one from `date`. Every await can
    /// outlive `sessionID`'s workout (discarded, replaced, or stood down), so a session found or started for a workout
    /// that is gone by then is discarded rather than left recording.
    private func beginRecording(for sessionID: UUID?, from date: Date, askingForAccess: Bool) {
        guard !isStartingRecording else { return }
        isStartingRecording = true
        func isGone(finishedCounts: Bool) -> Bool {
            guard let sessionID else { return false }
            guard let workout, workout.sessionID == sessionID, !standDown.contains(sessionID) else { return true }
            return finishedCounts && workout.isFinished
        }
        Task {
            defer { isStartingRecording = false }
            if let recovered = try? await WorkoutRecording.recover(in: healthStore) {
                guard recording == nil else { return }
                // A finished workout still saves the recovered session.
                guard !isGone(finishedCounts: false) else { return recovered.discard() }
                adopt(recovered)
                try? await recovered.session.startMirroringToCompanionDevice()
                return
            }
            if askingForAccess {
                await authorize()
            } else {
                guard HKHealthStore.isHealthDataAvailable(),
                      (try? await healthStore.statusForAuthorizationRequest(toShare: WorkoutRecording.shareTypes, read: WorkoutRecording.readTypes)) == .unnecessary
                else { return }
            }
            guard recording == nil, !isGone(finishedCounts: true) else { return }
            do {
                let started = try await WorkoutRecording.start(in: healthStore, at: date)
                guard recording == nil, !isGone(finishedCounts: true) else { return started.discard() }
                adopt(started)
            } catch {
                WorkoutRecording.log.error("Starting the workout session failed: \(String(describing: error))")
            }
        }
    }

    private func adopt(_ recording: WorkoutRecording) {
        self.recording = recording
        isMirrorConfirmed = false
        sendOverConnectivity(.recordingStarted, queued: true)
        recording.onStats = { [weak self] in self?.receive($0) }
        recording.onMessage = { [weak self] in
            self?.isMirrorConfirmed = true
            self?.receive($0)
        }
        recording.onEnd = { [weak self, weak recording] in
            guard let self, recording != nil, self.recording === recording else { return }
            self.recording = nil
            stats = nil
        }
        if let workout { recording.session.follow(paused: workout.pausedAt != nil) }
    }

    /// The phone shows heart rate too; without a mirror it only hears it from here, every few seconds.
    private func receive(_ stats: WorkoutRecording.Stats) {
        self.stats = stats
        guard !isMirrorConfirmed, Date.now.timeIntervalSince(lastStatsSent) >= 5 else { return }
        lastStatsSent = .now
        sendOverConnectivity(.stats(stats), queued: false)
    }

    /// Saves the recording once its workout ended, here or on the phone, with segments and effort from the logged sets.
    private func saveRecording(for workout: WatchWorkout) {
        guard let recording, !recording.isMirror, let endedAt = workout.endedAt, savedRecording != workout.sessionID else { return }
        savedRecording = workout.sessionID
        self.recording = nil
        let plan = HealthRecordingPlan.plan(
            sessionID: workout.sessionID, name: workout.name, startedAt: workout.startedAt, endedAt: endedAt,
            blocks: workout.blocks, exerciseName: { workout.exercise($0).name }
        )
        savesInFlight += 1
        Task {
            defer {
                savesInFlight -= 1
                completeConnectivityTasks()
            }
            do {
                let summary = try await recording.finish(plan, source: .watch)
                health[workout.sessionID] = summary
                sendOverConnectivity(.recorded(sessionID: workout.sessionID, summary), queued: true)
            } catch {
                WorkoutRecording.log.error("Saving the workout to Health failed: \(String(describing: error))")
            }
            stats = nil
        }
    }

    /// Health access is asked for only when the owner starts a workout here or the phone launches this app to record
    /// one, never at launch. A sheet raised at launch sat unanswered on the watch; when a workout later relaunched the
    /// app, HealthKit stored its dismissal as a newer decision that synced to the phone and revoked the phone's grant.
    private func authorize() async {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        do {
            try await WorkoutRecording.authorize(healthStore)
            readMaxHeartRate()
        } catch {
            WorkoutRecording.log.error("HealthKit authorization failed: \(String(describing: error))")
        }
    }

    private func loadMaxHeartRate() async {
        guard HKHealthStore.isHealthDataAvailable(),
              (try? await healthStore.statusForAuthorizationRequest(toShare: WorkoutRecording.shareTypes, read: WorkoutRecording.readTypes)) == .unnecessary
        else { return }
        readMaxHeartRate()
    }

    private func readMaxHeartRate() {
        guard let birth = try? healthStore.dateOfBirthComponents().date,
              let age = Calendar.current.dateComponents([.year], from: birth, to: .now).year else { return }
        maxHeartRate = Double(220 - age)
    }

    // MARK: Phone

    /// In a mirrored workout the data channel is fastest; WatchConnectivity covers everything else.
    private func send(_ message: WatchMessage) {
        guard let recording, recording.isRunning, isMirrorConfirmed else { return sendOverConnectivity(message, queued: false) }
        Task {
            do { try await recording.send(message) } catch { sendOverConnectivity(message, queued: false) }
        }
    }

    /// A message that must arrive goes as queued user info when the phone is unreachable, which WatchConnectivity
    /// delivers later.
    private func sendOverConnectivity(_ message: WatchMessage, queued: Bool) {
        let session = WCSession.default
        guard session.activationState == .activated, let data = try? message.encoded() else { return }
        let payload = [WatchMessage.messageKey: data]
        if session.isReachable {
            // WatchConnectivity calls the error handler on its own queue.
            session.sendMessage(payload, replyHandler: nil) { @Sendable _ in
                if queued { WCSession.default.transferUserInfo(payload) }
            }
        } else if queued {
            session.transferUserInfo(payload)
        }
    }

    private func receive(_ message: WatchMessage) {
        switch message {
        case .workout(let remote, let acknowledged):
            replica.receive(remote, acknowledged: acknowledged)
            refresh()
        case .home(let home):
            self.home = home
            persist()
        case .discardRecording(let sessionID):
            // The session was discarded on the phone, or an older phone build keeps its own recording of it.
            standDown.insert(sessionID)
            recording?.discard()
            recording = nil
            stats = nil
        case .events, .recorded, .hello, .recordingStarted, .stats:
            break
        }
    }

    private func receive(context: [String: Any]) {
        if let data = context[WatchMessage.homeKey] as? Data, let message = try? WatchMessage(data) { receive(message) }
        if let data = context[WatchMessage.workoutKey] as? Data, let message = try? WatchMessage(data) { receive(message) }
        completeConnectivityTasks()
    }

    // MARK: Disk

    private struct Saved: Codable {
        var home: WatchHome?
        var replica: WatchReplica
        var actedRows: [UUID]?
    }

    private static let file = URL.applicationSupportDirectory.appending(path: "watch-state.json")

    private func persist() {
        let saved = Saved(home: home, replica: replica, actedRows: actedRows)
        do {
            try FileManager.default.createDirectory(at: .applicationSupportDirectory, withIntermediateDirectories: true)
            try JSONEncoder().encode(saved).write(to: Self.file, options: .atomic)
        } catch {
            WorkoutRecording.log.error("Saving the watch's workout failed: \(String(describing: error))")
        }
    }

    private func restore() {
        guard let data = try? Data(contentsOf: Self.file), let saved = try? JSONDecoder().decode(Saved.self, from: data) else { return }
        home = saved.home
        replica = saved.replica
        actedRows = saved.actedRows ?? []
        workout = replica.workout
    }
}

private extension HKWorkoutSession {
    /// The workout's pause drives the recording's, so Health gets matching pause and resume events.
    func follow(paused: Bool) {
        if paused, state == .running { pause() } else if !paused, state == .paused { resume() }
    }
}

extension WatchModel: WCSessionDelegate {
    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: (any Error)?) {
        let context = session.receivedApplicationContext
        let data = context.compactMapValues { $0 as? Data }
        let reachable = session.isReachable
        Task { @MainActor in
            receive(context: data)
            isPhoneReachable = reachable
            requestState()
        }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        let reachable = session.isReachable
        Task { @MainActor in
            isPhoneReachable = reachable
            if reachable { requestState() }
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        let data = applicationContext.compactMapValues { $0 as? Data }
        Task { @MainActor in receive(context: data) }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        receive(data: message[WatchMessage.messageKey] as? Data)
    }

    nonisolated func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        receive(data: userInfo[WatchMessage.messageKey] as? Data)
    }

    private nonisolated func receive(data: Data?) {
        guard let data, let message = try? WatchMessage(data) else { return }
        Task { @MainActor in
            WatchModel.shared.receive(message)
            WatchModel.shared.completeConnectivityTasks()
        }
    }
}
