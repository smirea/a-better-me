import Foundation
import GRDB

/// A workout another app wrote to Apple Health, as the phone reads it.
struct HealthWorkout: Hashable, Sendable {
    var id: UUID
    /// Health's activity type in snake case.
    var activityType: String
    var start: Date
    var end: Date
    var activeKcal: Double?
    var distanceMeters: Double?
    var averageHeartRate: Double?
    var maxHeartRate: Double?
    var source: HealthSource
}

/// A row of the synced `health_activities` table: one session from Apple Health, whichever apps recorded it.
struct HealthActivity: SyncedRecord {
    static let table = "health_activities"

    var id: UUID
    var activityType: String
    var startedAt: Date
    var endedAt: Date
    var activeKcal: Double?
    var distanceMeters: Double?
    var averageHeartRate: Double?
    var maxHeartRate: Double?
    var source: String
    var sourceBundle: String
    /// Every app that recorded the session, the kept one first.
    var sources: [String]

    init(_ workout: HealthWorkout) {
        id = workout.id
        activityType = workout.activityType
        startedAt = workout.start.storedInstant
        endedAt = workout.end.storedInstant
        activeKcal = workout.activeKcal
        distanceMeters = workout.distanceMeters
        averageHeartRate = workout.averageHeartRate
        maxHeartRate = workout.maxHeartRate
        source = workout.source.name
        sourceBundle = workout.source.bundle
        sources = [workout.source.name]
    }

    init(row: Row) throws {
        id = try row.uuid("id")
        activityType = row["activity_type"]
        startedAt = try row.instant("started_at")
        endedAt = try row.instant("ended_at")
        activeKcal = row["active_kcal"]
        distanceMeters = row["distance_meters"]
        averageHeartRate = row["average_heart_rate"]
        maxHeartRate = row["max_heart_rate"]
        source = row["source"]
        sourceBundle = row["source_bundle"]
        sources = try row.json("sources")
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = key
        container["activity_type"] = activityType
        container["started_at"] = Instant.text(startedAt)
        container["ended_at"] = Instant.text(endedAt)
        container["active_kcal"] = activeKcal
        container["distance_meters"] = distanceMeters
        container["average_heart_rate"] = averageHeartRate
        container["max_heart_rate"] = maxHeartRate
        container["source"] = source
        container["source_bundle"] = sourceBundle
        container["sources"] = try RowJSON.text(sources)
    }

    /// "Walking", "Traditional Strength Training".
    var title: String { activityType.split(separator: "_").map(\.capitalized).joined(separator: " ") }

    /// A workout shorter than this was started by an accidental tap (Garmin keeps 0-minute "Timed Activity" sessions), so
    /// it is not a session.
    static let shortest: TimeInterval = 60

    /// One row per session. Two workouts from different apps are the same session when they share at least half of the
    /// shorter one, or start within a minute of each other; the best-ranked app's workout stands for it and takes what it
    /// lacks from the others: a type when it has only `other`, and missing energy, distance, or heart rate. An app's own
    /// workouts never merge with each other.
    static func deduplicated(_ workouts: [HealthWorkout]) -> [HealthActivity] {
        let ordered = workouts.filter { !$0.source.isThisApp && $0.end.timeIntervalSince($0.start) >= shortest }.sorted {
            ($0.source.rank, $0.source.bundle, $0.start, $0.id.uuidString) < ($1.source.rank, $1.source.bundle, $1.start, $1.id.uuidString)
        }
        var kept: [(workout: HealthWorkout, activity: HealthActivity)] = []
        for workout in ordered {
            if let index = kept.firstIndex(where: { $0.workout.source.bundle != workout.source.bundle && sameSession($0.workout, workout) }) {
                kept[index].activity.fill(from: workout)
                continue
            }
            kept.append((workout, HealthActivity(workout)))
        }
        return kept.map(\.activity).sorted { ($0.startedAt, $0.key) < ($1.startedAt, $1.key) }
    }

    private mutating func fill(from other: HealthWorkout) {
        if !sources.contains(other.source.name) { sources.append(other.source.name) }
        if activityType == "other", other.activityType != "other" { activityType = other.activityType }
        activeKcal = activeKcal ?? other.activeKcal
        distanceMeters = distanceMeters ?? other.distanceMeters
        averageHeartRate = averageHeartRate ?? other.averageHeartRate
        maxHeartRate = maxHeartRate ?? other.maxHeartRate
    }

    private static func sameSession(_ a: HealthWorkout, _ b: HealthWorkout) -> Bool {
        if abs(a.start.timeIntervalSince(b.start)) < 60 { return true }
        let shared = min(a.end, b.end).timeIntervalSince(max(a.start, b.start))
        let shorter = min(a.end.timeIntervalSince(a.start), b.end.timeIntervalSince(b.start))
        return shared > 0 && shared >= shorter / 2
    }
}
