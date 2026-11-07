import Foundation

/// The in-progress workout as the Live Activity shows it. `LiveWorkoutController` publishes it after every change and
/// applies the `LiveWorkoutCommand`s the Live Activity's buttons send back. ActivityKit caps a content state at 4 KB.
/// Weights are kilograms, like the model; `unit` is how to show them.
struct LiveWorkoutStatus: Codable, Hashable, Sendable {
    var sessionID: UUID
    var name: String
    /// The start moved forward by every finished pause, so `Text(timerInterval: pauseAdjustedStart...)` counts the
    /// workout clock while `pausedAt` is nil.
    var pauseAdjustedStart: Date
    var pausedAt: Date?
    var rest: LiveRest?
    /// The row to do next, or nil once every set is logged.
    var current: LiveSet?
    var upNext: LiveSet?
    var completedSets: Int
    var totalSets: Int
    var unit: WeightUnit
    var metrics: LiveHealthMetrics?
    /// Set only on the Live Activity's final content, after the session was finished.
    var endedAt: Date?
}

/// A rest between sets, and the rules the phone and the watch both run it by.
struct LiveRest: Codable, Hashable, Sendable {
    var endsAt: Date
    var duration: TimeInterval

    var startedAt: Date { endsAt.addingTimeInterval(-duration) }

    func remaining(at date: Date) -> TimeInterval { max(0, endsAt.timeIntervalSince(date)) }

    /// A rest of `duration` from `start`, which a set logged on the watch a while ago puts in the past. Nil when it is
    /// over by `now`.
    static func starting(_ duration: TimeInterval, at start: Date, now: Date) -> LiveRest? {
        let rest = LiveRest(endsAt: start.addingTimeInterval(duration), duration: duration)
        return duration > 0 && rest.endsAt > now ? rest : nil
    }

    /// The Rest Timer's −15 and +15. Nil once it has run out by `now`.
    func adjusted(by seconds: TimeInterval, now: Date) -> LiveRest? {
        var rest = self
        rest.endsAt.addTimeInterval(seconds)
        rest.duration += seconds
        return rest.endsAt > now ? rest : nil
    }

    /// What Pause freezes: the time left at `now`, nil when none is.
    func frozen(at now: Date) -> TimeInterval? {
        let left = remaining(at: now)
        return left > 0 ? left : nil
    }

    /// The frozen rest picking up again at Resume.
    static func resumed(_ frozen: TimeInterval?, at now: Date) -> LiveRest? {
        frozen.flatMap { starting($0, at: now, now: now) }
    }
}

/// One row of the set table: a set's main row or a drop or myo sub-row.
struct LiveSet: Codable, Hashable, Sendable, Identifiable {
    var id: UUID
    var blockExerciseID: UUID
    /// The catalog or custom exercise ID.
    var catalogID: String
    var exerciseName: String
    /// "Set 2 of 4", or "Superset 1 of 2 • Round 1 of 3".
    var position: String
    var setType: SetType
    var isSubRow: Bool
    var fields: [LiveField]
    /// What the row logs if it is checked now: what was typed, else the prefill.
    var values: LiveValues
    /// "8–10 reps · 2 RIR"
    var target: String?
    /// Last time's log of this row, "135 lb · 8".
    var previous: String?
}

struct LiveValues: Codable, Hashable, Sendable {
    var weightKg: Double?
    var reps: Int?
    var rir: Int?
    var durationSeconds: Int?
    var distanceMeters: Double?
}

enum LiveField: String, Codable, Hashable, Sendable {
    case weight, reps, rir, duration, distance
}

/// Heart rate and energy from the workout's HealthKit session, on the watch or the phone.
struct LiveHealthMetrics: Codable, Hashable, Sendable {
    var heartRate: Double?
    var activeEnergyKcal: Double?
}

/// What the Live Activity's buttons, and the watch's events, ask the phone to do. Each names the row it was shown, so a command
/// that crosses a change on the phone acts on the row the owner saw, or does nothing once that row is gone.
enum LiveWorkoutCommand: Codable, Hashable, Sendable {
    /// Checks a row with `values`, then runs rest and auto-next as on the phone.
    case log(rowID: UUID, values: LiveValues)
    /// Clears the row's log, or its set's skip.
    case unlog(rowID: UUID)
    /// Passes over the row's set without logging it, then moves on as after a log, without a rest.
    case skip(rowID: UUID)
    /// Moves the phone's current exercise.
    case select(exerciseID: UUID)
    /// Appends a copy of the exercise's last working set with this id.
    case addSet(exerciseID: UUID, setID: UUID)
    case adjustRest(seconds: Int)
    case skipRest
    case pause
    case resume
    /// Finishes like Done on Workout Complete with Update Workout Plan off: logged sets stay and open rows stay unlogged.
    case finish
}

/// What a finished workout recorded in Health, kept on the session's `health` column.
struct WorkoutHealthSummary: Codable, Hashable, Sendable {
    enum Source: String, Codable, Hashable, Sendable {
        case watch, phone
    }

    var healthKitWorkoutID: UUID
    var source: Source
    var averageHeartRate: Double?
    var maxHeartRate: Double?
    var activeEnergyKcal: Double?
    var totalEnergyKcal: Double?
}

#if os(iOS)
import ActivityKit

struct WorkoutActivityAttributes: ActivityAttributes {
    typealias ContentState = LiveWorkoutStatus

    var sessionID: UUID
}
#endif
