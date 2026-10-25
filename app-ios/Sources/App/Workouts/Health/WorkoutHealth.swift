import Foundation
import HealthKit
import Observation

/// Records each workout in Apple Health on exactly one device. When the paired watch has the app, the watch runs the
/// `HKWorkoutSession` and mirrors it here; otherwise this phone runs its own. It follows the in-progress session through
/// `LiveWorkoutController.snapshot`, so nothing in the session code knows Health exists.
@MainActor @Observable
final class WorkoutHealth {
    static let shared = WorkoutHealth()

    /// Who records the session being followed.
    enum Recorder {
        /// This phone's own session.
        case phone(WorkoutRecording)
        /// The watch records, and its session's mirror reached this phone.
        case mirror(WorkoutRecording)
        /// The watch records, but no mirror arrived; WatchConnectivity carries everything.
        case watch
    }

    @ObservationIgnored let healthStore = HKHealthStore()
    private(set) var recorder: Recorder?
    /// The session being recorded, and its live numbers for Workout Complete until the summary is saved.
    private(set) var sessionID: UUID?
    private(set) var stats: WorkoutRecording.Stats?

    @ObservationIgnored private var store: LocalStore?
    @ObservationIgnored private var catalog: ExerciseCatalog?
    @ObservationIgnored private var isPaused = false

    /// How long the phone waits to hear that the watch records before recording on its own.
    private static let watchStartTimeout: Duration = .seconds(10)

    var mirror: WorkoutRecording? {
        if case .mirror(let recording) = recorder { recording } else { nil }
    }

    func start(store: LocalStore, catalog: ExerciseCatalog) {
        guard self.store == nil, HKHealthStore.isHealthDataAvailable() else { return }
        self.store = store
        self.catalog = catalog
        // Set at launch, since the system relaunches the app in the background to hand it a mirrored session.
        healthStore.workoutSessionMirroringStartHandler = { session in
            Task { @MainActor in WorkoutHealth.shared.adoptMirror(session) }
        }
        track()
    }

    private func track() {
        let status = withObservationTracking {
            LiveWorkoutController.shared.snapshot.map { (id: $0.status.sessionID, paused: $0.status.pausedAt != nil) }
        } onChange: {
            Task { @MainActor in WorkoutHealth.shared.track() }
        }
        if status?.id != sessionID {
            if let sessionID { end(sessionID) }
            if let id = status?.id { begin(id) }
        }
        let paused = status?.paused ?? false
        if paused != isPaused {
            isPaused = paused
            // A watch reached only over WatchConnectivity follows the snapshot's pause itself.
            switch recorder {
            case .phone(let recording), .mirror(let recording): if paused { recording.pause() } else { recording.resume() }
            case .watch, nil: break
            }
        }
    }

    // MARK: Starting

    private func begin(_ id: UUID) {
        sessionID = id
        Task {
            do {
                try await WorkoutRecording.authorize(healthStore)
            } catch {
                WorkoutRecording.log.error("HealthKit authorization failed: \(String(describing: error))")
                return
            }
            // After a relaunch this phone's own session comes back here, unless the watch already said it records,
            // since its sensors measure more.
            let recovered = try? await WorkoutRecording.recover(in: healthStore)
            guard sessionID == id, recorder == nil else { return recovered?.discard() ?? () }
            if let recovered { return adopt(.phone(recovered)) }
            await WatchBridge.shared.activated()
            guard sessionID == id, recorder == nil else { return }
            if WatchBridge.shared.isWatchAppInstalled {
                do {
                    try await healthStore.startWatchApp(toHandle: WorkoutRecording.configuration)
                } catch {
                    WorkoutRecording.log.error("Starting the watch app failed: \(String(describing: error))")
                }
                let deadline = ContinuousClock.now + Self.watchStartTimeout
                while recorder == nil, sessionID == id, ContinuousClock.now < deadline {
                    try? await Task.sleep(for: .milliseconds(250))
                }
                guard sessionID == id, recorder == nil else { return }
            }
            do {
                let recording = try await WorkoutRecording.start(in: healthStore)
                guard sessionID == id, recorder == nil else { return recording.discard() }
                adopt(.phone(recording))
                if isPaused { recording.pause() }
            } catch {
                WorkoutRecording.log.error("Starting the phone's workout session failed: \(String(describing: error))")
            }
        }
    }

    /// The watch says it records. If the phone already gave up on it and records itself, the watch's copy goes, so the
    /// workout lands in Health once.
    func watchStartedRecording() {
        switch recorder {
        case nil where sessionID != nil: recorder = .watch
        case .phone: WatchBridge.shared.deliver(.discardRecording(sessionID: sessionID ?? UUID()))
        default: break
        }
    }

    func receiveWatchStats(_ stats: WorkoutRecording.Stats) {
        guard case .watch = recorder else { return }
        receive(stats)
    }

    private func adoptMirror(_ session: HKWorkoutSession) {
        let mirror = WorkoutRecording.mirror(session, in: healthStore)
        if case .phone = recorder {
            Task { try? await mirror.send(.discardRecording(sessionID: sessionID ?? UUID())) }
            return
        }
        adopt(.mirror(mirror))
        WatchBridge.shared.sendState()
    }

    private func adopt(_ recorder: Recorder) {
        self.recorder = recorder
        switch recorder {
        case .phone(let recording), .mirror(let recording): observe(recording)
        case .watch: break
        }
    }

    private func observe(_ recording: WorkoutRecording) {
        recording.onStats = { [weak self] in self?.receive($0) }
        recording.onMessage = { WatchBridge.shared.receive($0) }
        recording.onEnd = { [weak self, weak recording] in
            guard let self, let recording, self.mirror === recording else { return }
            // The mirror dropped mid-workout; the watch still records and answers over WatchConnectivity.
            self.recorder = .watch
        }
    }

    private func receive(_ stats: WorkoutRecording.Stats) {
        self.stats = stats
        LiveWorkoutController.shared.metrics = stats.live
    }

    // MARK: Ending

    /// The session left the in-progress query: Done ended it, or it was discarded and its row is gone.
    private func end(_ id: UUID) {
        let recorder = recorder
        sessionID = nil
        self.recorder = nil
        LiveWorkoutController.shared.metrics = nil
        guard let recorder, let store, let catalog else { return }
        let session = try? store.read { try WorkoutSession.fetchOne($0, key: WorkoutSession.key(id)) }
        guard let session, let endedAt = session.endedAt else {
            stats = nil
            switch recorder {
            case .phone(let recording): recording.discard()
            case .mirror(let recording): Task { try? await recording.send(.discardRecording(sessionID: id)) }
            case .watch: WatchBridge.shared.deliver(.discardRecording(sessionID: id))
            }
            return
        }
        let plan = HealthRecordingPlan.plan(for: session, endedAt: endedAt, name: catalog.name)
        Task {
            switch recorder {
            case .phone(let recording):
                do {
                    save(try await recording.finish(plan, source: .phone), for: id)
                } catch {
                    WorkoutRecording.log.error("Saving the workout to Health failed: \(String(describing: error))")
                }
            // The watch saves the workout and answers with `.recorded`.
            case .mirror(let recording):
                do { try await recording.send(.record(plan)) } catch { WatchBridge.shared.deliver(.record(plan)) }
            case .watch:
                WatchBridge.shared.deliver(.record(plan))
            }
        }
    }

    func save(_ summary: WorkoutHealthSummary, for id: UUID) {
        stats = nil
        store?.modify(WorkoutSession.self, id: id) { $0.health = summary }
        WatchBridge.shared.sendFinished(id, health: summary)
    }
}
