import Foundation

/// The window Levels averages over, picked under the body map ("Average weekly sets over 1-week").
enum LevelsPeriod: String, CaseIterable, Identifiable {
    case oneWeek = "1-week", oneMonth = "1-month", threeMonths = "3-months"

    static let storageKey = "levels.period"

    var id: String { rawValue }

    /// The trailing window ending now. Months are calendar months, so 1-month is 28 to 31 days.
    func interval(endingAt end: Date, calendar: Calendar) -> DateInterval {
        let start = switch self {
        case .oneWeek: calendar.date(byAdding: .day, value: -7, to: end)!
        case .oneMonth: calendar.date(byAdding: .month, value: -1, to: end)!
        case .threeMonths: calendar.date(byAdding: .month, value: -3, to: end)!
        }
        return DateInterval(start: start, end: end)
    }
}

/// Average weekly sets per muscle over a period, kept per exercise so the muscle detail can list Contributing Lifts.
/// Counting follows `WorkoutMetrics.muscleSets`; the average is the period's total divided by its length in weeks.
struct WeeklySets {
    private let byMuscle: [Muscle: [ExerciseID: Double]]
    let totals: [Muscle: Double]
    /// The most-trained muscle's sets, which every bar is scaled against.
    let top: Double

    init(sessions: [WorkoutSession], period: LevelsPeriod, now: Date = .now, calendar: Calendar = .current, catalog: (ExerciseID) -> Exercise?) {
        let interval = period.interval(endingAt: now, calendar: calendar)
        // Whole days rather than seconds, so a daylight-saving change doesn't skew the divisor.
        let days = calendar.dateComponents([.day], from: interval.start, to: interval.end).day!
        let weeks = Double(days) / 7
        var byMuscle: [Muscle: [ExerciseID: Double]] = [:]
        for session in sessions where session.endedAt != nil && session.startedAt > interval.start && session.startedAt <= interval.end {
            for block in session.blocks {
                for item in block.exercises {
                    WorkoutMetrics.forEachMuscleSet(of: item, catalog: catalog, loggedOnly: true) { muscle, count in
                        byMuscle[muscle, default: [:]][item.exerciseID, default: 0] += count / weeks
                    }
                }
            }
        }
        self.byMuscle = byMuscle
        totals = byMuscle.mapValues { $0.values.reduce(0, +) }
        top = totals.values.max() ?? 0
    }

    /// Memoized in `history` until the history, the custom exercises, or the day changes, so rotating the body or
    /// pushing a muscle reuses it. Within a day the window keeps the end it was first computed with.
    @MainActor
    static func memoized(in history: SessionHistory, period: LevelsPeriod, catalog: ExerciseCatalog) -> WeeklySets {
        let key = Key(period: period, day: Calendar.current.startOfDay(for: .now), custom: catalog.custom)
        return history.memo(key) { WeeklySets(sessions: $0, period: period, catalog: catalog.exercise) }
    }

    private struct Key: Hashable {
        let period: LevelsPeriod
        let day: Date
        let custom: [Exercise]
    }

    func sets(_ muscle: Muscle) -> Double { totals[muscle] ?? 0 }

    /// Upper or lower body muscles, most sets first. The sort is stable, so ties keep the muscle order.
    func ranked(_ muscles: [Muscle]) -> [(muscle: Muscle, sets: Double)] {
        muscles.map { (muscle: $0, sets: sets($0)) }.sorted { $0.sets > $1.sets }
    }

    func lifts(for muscle: Muscle) -> [(exerciseID: ExerciseID, sets: Double)] {
        (byMuscle[muscle] ?? [:]).map { (exerciseID: $0.key, sets: $0.value) }.sorted { ($0.sets, $1.exerciseID) > ($1.sets, $0.exerciseID) }
    }

    /// "2 sets", "1 set", "0.5 sets", "6.1 sets": one decimal, dropped when whole, as in the reference.
    static func label(_ sets: Double) -> String {
        let rounded = (sets * 10).rounded() / 10
        return "\(rounded.formatted(.number.precision(.fractionLength(0...1)))) \(rounded == 1 ? "set" : "sets")"
    }
}
