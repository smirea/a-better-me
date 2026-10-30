import Foundation
import Testing
@testable import App

private func steps(_ days: [(String, Double)]) -> [DatedValue] {
    days.map { DatedValue(date: utc.startOfDay(for: day($0.0)), value: $0.1) }
}

struct StepGoalTests {
    /// Oct 22-28 2026 from the owner's Pedometer++ screenshot.
    private let week = steps([
        ("2026-10-22", 7392), ("2026-10-23", 9733), ("2026-10-24", 7611), ("2026-10-25", 3041),
        ("2026-10-26", 6542), ("2026-10-27", 15423), ("2026-10-28", 10208),
    ])

    @Test func colorsEachDayAndBracketsTheStreakEndingToday() {
        let summary = StepGoal.summary(week, goal: 10_000, today: day("2026-10-28"), calendar: utc)
        #expect(summary.today == 10208)
        #expect(summary.streak == 2)
        #expect(summary.best == 2)
        #expect(summary.metLast30 == 2)
        #expect(summary.week.map(\.tier) == [.near, .near, .near, .far, .near, .met, .met])
        #expect(summary.week.map(\.inStreak) == [false, false, false, false, false, true, true])
    }

    @Test func anUnfinishedTodayKeepsYesterdaysStreak() {
        let summary = StepGoal.summary(week + steps([("2026-10-29", 1200)]), goal: 10_000, today: day("2026-10-29"), calendar: utc)
        #expect(summary.streak == 2)
        #expect(summary.week.map(\.inStreak) == [false, false, false, false, true, true, false])
    }

    @Test func aMissedDayEndsTheStreakAndBestKeepsTheLongestRun() {
        let history = steps([
            ("2026-10-01", 11000), ("2026-10-02", 12000), ("2026-10-03", 10000), ("2026-10-04", 2000), ("2026-10-05", 10500),
        ])
        let summary = StepGoal.summary(history, goal: 10_000, today: day("2026-10-07"), calendar: utc)
        #expect(summary.streak == 0)
        #expect(summary.best == 3)
        #expect(summary.week.map(\.inStreak) == Array(repeating: false, count: 7))
    }

    @Test func aLowerGoalTurnsTheWholeWeekIntoAStreak() {
        let summary = StepGoal.summary(week, goal: 3_000, today: day("2026-10-28"), calendar: utc)
        #expect(summary.streak == 7)
        #expect(summary.week.map(\.inStreak) == Array(repeating: true, count: 7))
    }
}
