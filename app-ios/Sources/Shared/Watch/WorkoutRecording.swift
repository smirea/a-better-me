import Foundation
import HealthKit
import os

/// One `HKWorkoutSession` and its live builder: the watch's own recording, the phone's own when no watch records, or
/// the phone's mirror of the watch's. The recording device saves the workout; a mirror only reads its numbers and
/// carries messages.
@MainActor
final class WorkoutRecording: NSObject {
    let session: HKWorkoutSession
    let builder: HKLiveWorkoutBuilder
    let isMirror: Bool
    private let store: HKHealthStore

    private(set) var stats = Stats()
    var onStats: ((Stats) -> Void)?
    var onMessage: ((WatchMessage) -> Void)?
    /// The session ended, failed, or lost its remote device.
    var onEnd: (() -> Void)?

    struct Stats: Codable, Equatable, Sendable {
        var heartRate: Double?
        var averageHeartRate: Double?
        var maxHeartRate: Double?
        var activeEnergyKcal: Double?
        var basalEnergyKcal: Double?

        var live: LiveHealthMetrics { LiveHealthMetrics(heartRate: heartRate, activeEnergyKcal: activeEnergyKcal) }
    }

    nonisolated static let log = Logger(subsystem: "com.stefan.a-better-me", category: "workout-recording")
    nonisolated static let heartRate = HKQuantityType(.heartRate)
    nonisolated static let activeEnergy = HKQuantityType(.activeEnergyBurned)
    nonisolated static let basalEnergy = HKQuantityType(.basalEnergyBurned)
    nonisolated static let effort = HKQuantityType(.workoutEffortScore)
    nonisolated static let beatsPerMinute = HKUnit.count().unitDivided(by: .minute())

    static let shareTypes: Set<HKSampleType> = [.workoutType(), heartRate, activeEnergy, basalEnergy, effort]
    /// Date of birth sets the watch's heart rate zones.
    static let readTypes: Set<HKObjectType> = [.workoutType(), heartRate, activeEnergy, basalEnergy, effort, HKCharacteristicType(.dateOfBirth)]

    static var configuration: HKWorkoutConfiguration {
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .traditionalStrengthTraining
        configuration.locationType = .indoor
        return configuration
    }

    static func authorize(_ store: HKHealthStore) async throws {
        try await store.requestAuthorization(toShare: shareTypes, read: readTypes)
    }

    /// Starts recording on this device. The watch mirrors its session to the phone first; without the mirror it still
    /// records, and the two talk over WatchConnectivity instead.
    static func start(in store: HKHealthStore, at date: Date = .now) async throws -> WorkoutRecording {
        let session = try HKWorkoutSession(healthStore: store, configuration: configuration)
        let recording = WorkoutRecording(session: session, store: store, isMirror: false)
        #if os(watchOS)
        do {
            try await session.startMirroringToCompanionDevice()
        } catch {
            log.error("Mirroring the workout session failed: \(String(describing: error))")
        }
        #endif
        session.startActivity(with: date)
        try await recording.builder.beginCollection(at: date)
        return recording
    }

    /// The session HealthKit kept running across a crash or relaunch of this app. HealthKit also hands back one that
    /// already ended, which has nothing left to record.
    static func recover(in store: HKHealthStore) async throws -> WorkoutRecording? {
        guard let session = try await store.recoverActiveWorkoutSession(), session.state == .running || session.state == .paused else { return nil }
        return WorkoutRecording(session: session, store: store, isMirror: false)
    }

    static func mirror(_ session: HKWorkoutSession, in store: HKHealthStore) -> WorkoutRecording {
        WorkoutRecording(session: session, store: store, isMirror: true)
    }

    private init(session: HKWorkoutSession, store: HKHealthStore, isMirror: Bool) {
        self.session = session
        self.store = store
        self.isMirror = isMirror
        builder = session.associatedWorkoutBuilder()
        super.init()
        session.delegate = self
        builder.delegate = self
        if !isMirror, builder.dataSource == nil {
            builder.dataSource = HKLiveWorkoutDataSource(healthStore: store, workoutConfiguration: session.workoutConfiguration)
        }
    }

    var isRunning: Bool { session.state != .ended && session.state != .stopped }

    func pause() { if session.state == .running { session.pause() } }

    func resume() { if session.state == .paused { session.resume() } }

    func send(_ message: WatchMessage) async throws {
        try await session.sendToRemoteWorkoutSession(data: message.encoded())
    }

    /// Ends the session and saves the workout with the plan's segments, name, and effort. The session id is the sync
    /// identifier, so saving the same workout again replaces it instead of adding a second one.
    func finish(_ plan: WorkoutRecordingPlan, source: WorkoutHealthSummary.Source) async throws -> WorkoutHealthSummary {
        let start = builder.startDate ?? plan.endedAt
        let end = max(start, min(plan.endedAt, .now))
        session.stopActivity(with: end)
        session.end()
        try await builder.endCollection(at: end)
        let events = plan.segments.compactMap { segment -> HKWorkoutEvent? in
            // A segment can end before the recording began, when Health started late; it has nothing to cover.
            let clippedStart = max(segment.start, start), clippedEnd = min(segment.end, end)
            guard clippedEnd > clippedStart else { return nil }
            return HKWorkoutEvent(
                type: .segment, dateInterval: DateInterval(start: clippedStart, end: clippedEnd), metadata: [Self.exerciseKey: segment.exercise]
            )
        }
        if !events.isEmpty { try await builder.addWorkoutEvents(events) }
        try await builder.addMetadata([
            HKMetadataKeySyncIdentifier: plan.sessionID.uuidString,
            HKMetadataKeySyncVersion: 1,
            HKMetadataKeyIndoorWorkout: true,
            Self.workoutNameKey: plan.name,
        ])
        guard let workout = try await builder.finishWorkout() else { throw RecordingError.notSaved }
        if let effort = plan.effort {
            let sample = HKQuantitySample(
                type: Self.effort, quantity: HKQuantity(unit: .appleEffortScore(), doubleValue: effort),
                start: workout.startDate, end: workout.endDate
            )
            do {
                try await store.relateWorkoutEffortSample(sample, with: workout, activity: nil)
            } catch {
                Self.log.error("Relating the effort score failed: \(String(describing: error))")
            }
        }
        return WorkoutHealthSummary(
            healthKitWorkoutID: workout.uuid,
            source: source,
            averageHeartRate: workout.statistics(for: Self.heartRate)?.averageQuantity()?.doubleValue(for: Self.beatsPerMinute),
            maxHeartRate: workout.statistics(for: Self.heartRate)?.maximumQuantity()?.doubleValue(for: Self.beatsPerMinute),
            activeEnergyKcal: workout.statistics(for: Self.activeEnergy)?.sumQuantity()?.doubleValue(for: .kilocalorie()),
            totalEnergyKcal: Self.total(
                workout.statistics(for: Self.activeEnergy)?.sumQuantity()?.doubleValue(for: .kilocalorie()),
                workout.statistics(for: Self.basalEnergy)?.sumQuantity()?.doubleValue(for: .kilocalorie())
            )
        )
    }

    func discard() {
        session.end()
        if !isMirror { builder.discardWorkout() }
    }

    enum RecordingError: Error { case notSaved }

    static let exerciseKey = "BetterMeExercise"
    static let workoutNameKey = "BetterMeWorkoutName"

    static func total(_ active: Double?, _ basal: Double?) -> Double? {
        active == nil && basal == nil ? nil : (active ?? 0) + (basal ?? 0)
    }

    private func receive(_ stats: Stats) {
        guard stats != self.stats else { return }
        self.stats = stats
        onStats?(stats)
    }
}

extension WorkoutRecording: HKWorkoutSessionDelegate, HKLiveWorkoutBuilderDelegate {
    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState, from fromState: HKWorkoutSessionState, date: Date) {
        guard toState == .ended else { return }
        Task { @MainActor in onEnd?() }
    }

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: any Error) {
        Self.log.error("Workout session failed: \(String(describing: error))")
    }

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didReceiveDataFromRemoteWorkoutSession data: [Data]) {
        let messages = data.compactMap { try? WatchMessage($0) }
        Task { @MainActor in messages.forEach { onMessage?($0) } }
    }

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didDisconnectFromRemoteDeviceWithError error: (any Error)?) {
        Self.log.info("Remote workout session disconnected: \(String(describing: error))")
        Task { @MainActor in if isMirror { onEnd?() } }
    }

    nonisolated func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

    nonisolated func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        let heartRate = workoutBuilder.statistics(for: Self.heartRate)
        let stats = Stats(
            heartRate: heartRate?.mostRecentQuantity()?.doubleValue(for: Self.beatsPerMinute),
            averageHeartRate: heartRate?.averageQuantity()?.doubleValue(for: Self.beatsPerMinute),
            maxHeartRate: heartRate?.maximumQuantity()?.doubleValue(for: Self.beatsPerMinute),
            activeEnergyKcal: workoutBuilder.statistics(for: Self.activeEnergy)?.sumQuantity()?.doubleValue(for: .kilocalorie()),
            basalEnergyKcal: workoutBuilder.statistics(for: Self.basalEnergy)?.sumQuantity()?.doubleValue(for: .kilocalorie())
        )
        Task { @MainActor in receive(stats) }
    }
}
