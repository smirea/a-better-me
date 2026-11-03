import SwiftUI

struct DatedValue: Hashable, Sendable {
    var date: Date
    var value: Double
}

/// The daily step goal and the streaks it makes. A day meets the goal at or above it; an unfinished today joins the
/// streak once it does, and never breaks it before midnight.
enum StepGoal {
    static let defaultGoal = 10_000
    static let choices = Array(stride(from: 1_000, through: 40_000, by: 500))

    /// Pedometer++'s three colors: met, at least half way, and short of half.
    enum Tier: Equatable {
        case met, near, far

        var color: Color {
            switch self {
            case .met: Theme.goal
            case .near: Theme.accent
            case .far: Theme.destructive
            }
        }
    }

    struct Day: Equatable, Identifiable {
        var date: Date
        var steps: Double
        var tier: Tier
        /// Part of the current streak.
        var inStreak: Bool

        var id: Date { date }
    }

    struct Summary: Equatable {
        var goal: Int
        var today: Double
        /// The last seven days, oldest first, today last.
        var week: [Day]
        var streak: Int
        var best: Int
        var metLast30: Int
        var hasSteps: Bool
    }

    static func tier(_ steps: Double, goal: Int) -> Tier {
        steps >= Double(goal) ? .met : steps * 2 >= Double(goal) ? .near : .far
    }

    /// `steps` holds one total per day, dated at the start of the day.
    static func summary(_ steps: [DatedValue], goal: Int, today: Date, calendar: Calendar) -> Summary {
        let start = calendar.startOfDay(for: today)
        var byDay: [Date: Double] = [:]
        for point in steps { byDay[calendar.startOfDay(for: point.date), default: 0] += point.value }
        func day(_ offset: Int) -> Date { calendar.date(byAdding: .day, value: offset, to: start)! }
        func met(_ date: Date) -> Bool { (byDay[date] ?? 0) >= Double(goal) }

        var streak = 0
        var cursor = met(start) ? 0 : -1
        while met(day(cursor)) {
            streak += 1
            cursor -= 1
        }
        let streakDays = Set((0..<streak).map { day(cursor + 1 + $0) })

        var best = 0
        var run = 0
        var previous: Date?
        for date in byDay.keys.sorted() where met(date) {
            run = previous.map { calendar.date(byAdding: .day, value: 1, to: $0) == date } == true ? run + 1 : 1
            best = max(best, run)
            previous = date
        }

        let week = (-6...0).map { offset in
            let date = day(offset)
            let value = byDay[date] ?? 0
            return Day(date: date, steps: value, tier: tier(value, goal: goal), inStreak: streakDays.contains(date))
        }
        return Summary(
            goal: goal, today: byDay[start] ?? 0, week: week, streak: streak, best: best,
            metLast30: (-29...0).count { met(day($0)) }, hasSteps: !byDay.isEmpty
        )
    }
}

extension Double {
    /// Rounded to a whole number with grouping: "2,345".
    var wholeText: String { Int(rounded()).formatted() }
}
