import Foundation
import HealthKit
import Observation
import WatchConnectivity

/// The watch app's whole state. It never edits the workout: it shows the phone's latest `LiveWorkoutSnapshot` and sends
/// `LiveWorkoutCommand`s back. It also runs the workout's `HKWorkoutSession` when the phone asks, mirrored to the phone,
/// and saves it to Health when the phone sends the finished workout's plan.
@MainActor @Observable
final class WatchModel: NSObject {
    static let shared = WatchModel()

    private(set) var home: WatchHome?
    private(set) var snapshot: LiveWorkoutSnapshot?
    /// The finish screen, until Done.
    var summary: WatchWorkoutSummary?
    private(set) var recording: WorkoutRecording?
    private(set) var stats: WorkoutRecording.Stats?
    /// 220 minus the owner's age from Health, else a 30-year-old's.
    private(set) var maxHeartRate = 190.0
    private(set) var isPhoneReachable = false
    /// A Start tap waiting for the phone's snapshot.
    private(set) var startingTemplate: UUID?

    @ObservationIgnored let healthStore = HKHealthStore()
    /// Set once a message arrives over the recording's data channel, which proves the phone holds its mirror. Until
    /// then everything goes over WatchConnectivity: a mirror can start here and never reach the phone.
    @ObservationIgnored private var isMirrorConfirmed = false
    @ObservationIgnored private var lastStatsSent = Date.distantPast

    /// Live numbers: this watch's own recording, else what the phone's snapshot carries.
    var metrics: LiveHealthMetrics? { stats?.live ?? snapshot?.status.metrics }

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func authorize() async {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        do {
            try await WorkoutRecording.authorize(healthStore)
            if let birth = try? healthStore.dateOfBirthComponents().date,
               let age = Calendar.current.dateComponents([.year], from: birth, to: .now).year {
                maxHeartRate = Double(220 - age)
            }
        } catch {
            WorkoutRecording.log.error("HealthKit authorization failed: \(String(describing: error))")
        }
    }

    // MARK: Recording

    /// The phone started a workout and launched this app to record it.
    func startRecording() {
        guard recording == nil else {
            // The phone relaunched and asks again; it needs to hear that this watch already records.
            return sendOverConnectivity(.recordingStarted, queued: true)
        }
        Task {
            do {
                adopt(try await WorkoutRecording.start(in: healthStore))
            } catch {
                WorkoutRecording.log.error("Starting the workout session failed: \(String(describing: error))")
            }
        }
    }

    func recover() {
        Task {
            guard let recovered = try? await WorkoutRecording.recover(in: healthStore) else { return }
            adopt(recovered)
            try? await recovered.session.startMirroringToCompanionDevice()
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
        if let snapshot { recording.session.pause(if: snapshot.status.pausedAt != nil) }
    }

    /// The phone shows heart rate too; without a mirror it only hears it from here, every few seconds.
    private func receive(_ stats: WorkoutRecording.Stats) {
        self.stats = stats
        guard !isMirrorConfirmed, Date.now.timeIntervalSince(lastStatsSent) >= 5 else { return }
        lastStatsSent = .now
        sendOverConnectivity(.stats(stats), queued: false)
    }

    private func save(_ plan: WorkoutRecordingPlan) {
        guard let recording, !recording.isMirror else { return }
        self.recording = nil
        Task {
            do {
                let health = try await recording.finish(plan, source: .watch)
                if summary?.sessionID == plan.sessionID { summary?.health = health }
                let message = WatchMessage.recorded(sessionID: plan.sessionID, health)
                sendOverConnectivity(message, queued: true)
            } catch {
                WorkoutRecording.log.error("Saving the workout to Health failed: \(String(describing: error))")
            }
            stats = nil
        }
    }

    // MARK: Phone

    func send(_ command: LiveWorkoutCommand) {
        send(.command(command))
    }

    func start(_ option: WatchWorkoutOption) {
        startingTemplate = option.id
        send(.start(templateID: option.id))
        Task {
            try? await Task.sleep(for: .seconds(15))
            if startingTemplate == option.id { startingTemplate = nil }
        }
    }

    /// In a mirrored workout the data channel is fastest; WatchConnectivity covers everything else.
    private func send(_ message: WatchMessage) {
        guard let recording, recording.isRunning, isMirrorConfirmed else { return sendOverConnectivity(message, queued: false) }
        Task {
            do { try await recording.send(message) } catch { sendOverConnectivity(message, queued: false) }
        }
    }

    /// A message that must arrive goes as queued user info when the phone is unreachable, which WatchConnectivity
    /// delivers later. Workout controls don't: a late End or log could act on a workout started since.
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
        case .snapshot(let snapshot):
            apply(snapshot)
        case .home(let home):
            self.home = home
        case .finished(let finished):
            var finished = finished
            if summary?.sessionID == finished.sessionID, finished.health == nil { finished.health = summary?.health }
            summary = finished
        case .record(let plan):
            save(plan)
        case .discardRecording:
            recording?.discard()
            recording = nil
            stats = nil
        case .command, .start, .recorded, .hello, .recordingStarted, .stats:
            break
        }
    }

    private func apply(_ snapshot: LiveWorkoutSnapshot?) {
        self.snapshot = snapshot
        guard let snapshot else { return }
        startingTemplate = nil
        if summary?.sessionID != snapshot.status.sessionID { summary = nil }
        recording?.session.pause(if: snapshot.status.pausedAt != nil)
    }

    private func receive(context: [String: Any]) {
        if let data = context[WatchMessage.homeKey] as? Data, let message = try? WatchMessage(data) { receive(message) }
        if let data = context[WatchMessage.snapshotKey] as? Data, let message = try? WatchMessage(data) { receive(message) }
    }
}

private extension HKWorkoutSession {
    /// The phone decides pauses; the recording follows them so Health gets matching pause and resume events.
    func pause(if paused: Bool) {
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
            sendOverConnectivity(.hello, queued: false)
        }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        let reachable = session.isReachable
        Task { @MainActor in
            isPhoneReachable = reachable
            if reachable { sendOverConnectivity(.hello, queued: false) }
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
        Task { @MainActor in WatchModel.shared.receive(message) }
    }
}
