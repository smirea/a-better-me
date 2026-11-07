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
        let meters = days([("2026-10-01", 9000), ("2026-10-23", 7200), ("2026-10-27", 11500), ("2026-10-28", 7700)])
        let summary = StepGoal.summary(points, goal: 10_000, today: day("2026-10-28"), calendar: utc)
        return MetricPlot(tab: tab, footer: .steps(summary, flights: flights, meters: meters), range: range, averaging: averaging, now: day("2026-10-28"), calendar: utc, unit: .kg)
    }

    @Test func dailyBarsCarryTheirFlightsAndDistanceAndTheWeeksShareOfTheGoal() throws {
        let week = try #require(plot(range: .oneWeek, averaging: .daily).steps)
        #expect(week.flights == [day("2026-10-23", 0): 3, day("2026-10-27", 0): 12, day("2026-10-28", 0): 5])
        #expect(week.meters == [day("2026-10-23", 0): 7200, day("2026-10-27", 0): 11500, day("2026-10-28", 0): 7700])
        #expect(week.total == 59950)
        #expect(week.distance == 26400)
        // 59,950 of 7 × 10,000, so the bracket reads 86% of Goal in the near tier, as Pedometer++'s 83% week does.
        #expect((week.goalShare * 100).rounded() == 86)
        #expect(week.tier == .near)
        #expect(NutritionSettings.DistanceUnit.miles.text(meters: week.distance) == "16.4 mi")
        #expect(NutritionSettings.DistanceUnit.kilometers.text(meters: 7200, separator: "") == "7.2km")
    }

    @Test func weeklyBarsAverageFlightsAndDistanceAndTheGoalCountsFromTheFirstRecordedDay() throws {
        let plot = plot(range: .oneMonth, averaging: .weekly)
        let month = try #require(plot.steps)
        #expect(month.flights == [day("2026-09-29", 0): 40, day("2026-10-19", 0): 3, day("2026-10-26", 0): 8.5])
        #expect(month.meters == [day("2026-09-29", 0): 9000, day("2026-10-19", 0): 7200, day("2026-10-26", 0): 9600])
        #expect(month.distance == 35400)
        // Steps start Oct 22, so the month's goal covers those 7 days, not the 30 since Sep 29.
        #expect(month.goalShare == 59950.0 / 70_000)
        #expect(month.tier == .near)
        #expect(plot.scrubDates == [day("2026-10-22", 12), day("2026-10-29", 12)])
        // The range ends Oct 28, inside the last week, so the domain runs to that week's end.
        #expect(plot.xDomain == day("2026-09-29", 0)...day("2026-11-02", 0))
        #expect(plot.months.isEmpty)
    }

    @Test func detailsDropFirstThenCountsShortenThenHide() {
        let bars = [StepBar(steps: 10009, flights: "4", distance: "3.3mi"), StepBar(steps: 6612, flights: "", distance: "12.0mi"), StepBar(steps: 18116, flights: "16", distance: "")]
        let width = { (text: String) in CGFloat(text.count * 6) }
        #expect(BarLabelStyle.fitting(bars, slot: 45, barWidth: 45, count: width, detail: width) == .detailed)
        #expect(BarLabelStyle.fitting(bars, slot: 45, barWidth: 40, count: width, detail: width) == .full)
        #expect(BarLabelStyle.fitting(bars, slot: 30, barWidth: 30, count: width, detail: width) == .compact)
        #expect(BarLabelStyle.fitting(bars, slot: 10, barWidth: 10, count: width, detail: width) == .hidden)
        #expect(bars.map { BarLabelStyle.detailed.text($0.steps) } == ["10,009", "6,612", "18,116"])
        #expect(bars.map { BarLabelStyle.compact.text($0.steps) } == ["10K", "6.6K", "18K"])
    }
}
