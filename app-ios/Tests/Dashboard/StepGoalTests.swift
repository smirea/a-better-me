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
        #expect(summary.streakDays == utc.startOfDay(for: day("2026-10-27"))...utc.startOfDay(for: day("2026-10-28")))
        #expect(summary.best == 2)
        #expect(summary.metLast30 == 2)
        #expect(summary.week.map(\.tier) == [.near, .near, .near, .far, .near, .met, .met])
        #expect(summary.week.map(\.inStreak) == [false, false, false, false, false, true, true])
    }

    @Test func anUnfinishedTodayKeepsYesterdaysStreak() {
        let summary = StepGoal.summary(week + steps([("2026-10-29", 1200)]), goal: 10_000, today: day("2026-10-29"), calendar: utc)
        #expect(summary.streak == 2)
        #expect(summary.streakDays == utc.startOfDay(for: day("2026-10-27"))...utc.startOfDay(for: day("2026-10-28")))
        #expect(summary.week.map(\.inStreak) == [false, false, false, false, true, true, false])
    }

    @Test func aMissedDayEndsTheStreakAndBestKeepsTheLongestRun() {
        let history = steps([
            ("2026-10-01", 11000), ("2026-10-02", 12000), ("2026-10-03", 10000), ("2026-10-04", 2000), ("2026-10-05", 10500),
        ])
        let summary = StepGoal.summary(history, goal: 10_000, today: day("2026-10-07"), calendar: utc)
        #expect(summary.streak == 0)
        #expect(summary.streakDays == nil)
        #expect(summary.best == 3)
        #expect(summary.week.map(\.inStreak) == Array(repeating: false, count: 7))
    }

    @Test func aLowerGoalTurnsTheWholeWeekIntoAStreak() {
        let summary = StepGoal.summary(week, goal: 3_000, today: day("2026-10-28"), calendar: utc)
        #expect(summary.streak == 7)
        #expect(summary.week.map(\.inStreak) == Array(repeating: true, count: 7))
    }
}

struct StepsPlotTests {
    private func days(_ values: [(String, Double)]) -> [DatedValue] {
        values.map { DatedValue(date: day($0.0, 0), value: $0.1) }
    }

    private let steps = [
        ("2026-10-22", 7392.0), ("2026-10-23", 9733), ("2026-10-24", 7611), ("2026-10-25", 3041),
        ("2026-10-26", 6542), ("2026-10-27", 15423), ("2026-10-28", 10208),
    ]

    private func plot(range: ChartRange, averaging: Averaging) -> MetricPlot {
        let points = days(steps)
        let tab = MetricTab(title: "Steps", points: points, unit: .whole("steps"), averageTitle: "Average Steps", summary: .total, style: .bar, color: Theme.coral, goal: 10_000)
        let flights = days([("2026-10-01", 40), ("2026-10-23", 3), ("2026-10-27", 12), ("2026-10-28", 5)])
        let summary = StepGoal.summary(points, goal: 10_000, today: day("2026-10-28"), calendar: utc)
        return MetricPlot(tab: tab, footer: .steps(summary, flights: flights), range: range, averaging: averaging, now: day("2026-10-28"), calendar: utc, unit: .kg)
    }

    @Test func dailyBarsCarryTheirFlightsAndTheStreakSpan() {
        let week = plot(range: .oneWeek, averaging: .daily)
        #expect(week.flightsTotal == 20)
        #expect(week.flights == [day("2026-10-23", 0): 3, day("2026-10-27", 0): 12, day("2026-10-28", 0): 5])
        #expect(week.streak?.first == day("2026-10-27", 12))
        #expect(week.streak?.last == day("2026-10-28", 12))
        #expect(week.months.isEmpty)
    }

    @Test func weeklyBarsAverageFlightsAndDropTheStreak() {
        let month = plot(range: .oneMonth, averaging: .weekly)
        #expect(month.flightsTotal == 60)
        #expect(month.flights == [day("2026-09-29", 0): 40, day("2026-10-19", 0): 3, day("2026-10-26", 0): 8.5])
        #expect(month.streak == nil)
    }

    @Test func barLabelsShortenThenHideAsBarsNarrow() {
        let values = [10009.0, 6612, 18116]
        let width = { (text: String) in CGFloat(text.count * 6) }
        #expect(BarLabelStyle.fitting(values, slot: 45, width: width) == .full)
        #expect(BarLabelStyle.fitting(values, slot: 30, width: width) == .compact)
        #expect(BarLabelStyle.fitting(values, slot: 10, width: width) == .hidden)
        #expect(values.map(BarLabelStyle.full.text) == ["10,009", "6,612", "18,116"])
        #expect(values.map(BarLabelStyle.compact.text) == ["10K", "6.6K", "18K"])
    }
}
