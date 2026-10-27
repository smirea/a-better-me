import Foundation
import HealthKit
import Observation

/// Records each workout in Apple Health on exactly one device. When the paired watch has the app, the watch runs the
/// `HKWorkoutSession` and mirrors it here; otherwise this phone runs its own. It follows the in-progress session through
/// `LiveWorkoutController.status`, so nothing in the session code knows Health exists.
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

    @ObservationIgnored let healthStore = HealthStore.shared
    private(set) var recorder: Recorder?
    /// The session being recorded, and its live numbers for Workout Complete until the summary is saved.
    private(set) var sessionID: UUID?
    private(set) var stats: WorkoutRecording.Stats?

    @ObservationIgnored private var store: LocalStore?
    @ObservationIgnored private var catalog: ExerciseCatalog?
    @ObservationIgnored private var isPaused = false
    /// Sessions the watch started, which the watch records from their first second. Kept across launches, so a phone
    /// relaunched mid-workout doesn't start a second recording.
    @ObservationIgnored private var startedOnWatch = UserDefaults.standard.stringArray(forKey: startedOnWatchKey)?.compactMap(UUID.init) ?? []
    private static let startedOnWatchKey = "sessionsStartedOnWatch"
    /// When this phone's own recording started, so a watch that speaks up late doesn't throw away most of it.
    @ObservationIgnored private var phoneRecordingStartedAt: Date?

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
            LiveWorkoutController.shared.status.map { (id: $0.sessionID, paused: $0.pausedAt != nil) }
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
            // A watch reached only over WatchConnectivity follows the workout's pause itself.
            switch recorder {
            case .phone(let recording), .mirror(let recording): if paused { recording.pause() } else { recording.resume() }
            case .watch, nil: break
            }
        }
    }

    // MARK: Starting

    /// A workout started on the watch is recorded there; the phone only follows it, even when it hears of the
    /// workout before the watch's word that it records.
    func expectWatchRecording(_ id: UUID) {
        if !startedOnWatch.contains(id) {
            startedOnWatch = startedOnWatch.suffix(19) + [id]
            UserDefaults.standard.set(startedOnWatch.map(\.uuidString), forKey: Self.startedOnWatchKey)
        }
        if sessionID == id, recorder == nil { recorder = .watch }
    }

    private func begin(_ id: UUID) {
        sessionID = id
        if startedOnWatch.contains(id) { return adopt(.watch) }
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
                phoneRecordingStartedAt = .now
                if isPaused { recording.pause() }
            } catch {
                WorkoutRecording.log.error("Starting the phone's workout session failed: \(String(describing: error))")
            }
        }
    }

    /// The watch says it records. If the phone already gave up on it and records itself, one copy goes so the workout
    /// lands in Health once. Within the first minute the phone's goes: the watch measures heart rate and stays with the
    /// owner when the phone is left behind. Later the watch's goes, since it only covers the rest of the workout.
    func watchStartedRecording() {
        switch recorder {
        case nil where sessionID != nil: recorder = .watch
        case .phone(let recording):
            if let started = phoneRecordingStartedAt, Date.now.timeIntervalSince(started) > 60 {
                WatchBridge.shared.deliver(.discardRecording(sessionID: sessionID ?? UUID()))
            } else {
                recording.discard()
                recorder = .watch
            }
        default: break
        }
    }

    func receiveWatchStats(_ stats: WorkoutRecording.Stats) {
        guard case .watch = recorder else { return }
        receive(stats)
    }

    private func adoptMirror(_ session: HKWorkoutSession) {
        let mirror = WorkoutRecording.mirror(session, in: healthStore)
        if case .phone(let own) = recorder { own.discard() }
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
        // The watch saves its own recording from the finished workout `WatchBridge` sends, and answers with `.recorded`.
        guard case .phone(let recording) = recorder else { return }
        let plan = HealthRecordingPlan.plan(sessionID: session.id, name: session.name, startedAt: session.startedAt, endedAt: endedAt, blocks: session.blocks, exerciseName: catalog.name)
        Task {
            do {
                save(try await recording.finish(plan, source: .phone), for: id)
            } catch {
                WorkoutRecording.log.error("Saving the workout to Health failed: \(String(describing: error))")
            }
        }
    }

    func save(_ summary: WorkoutHealthSummary, for id: UUID) {
        stats = nil
        store?.modify(WorkoutSession.self, id: id) { $0.health = summary }
    }
}
