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
        let plot = plot(range: .oneWeek, averaging: .daily)
        let bars = try #require(plot.steps)
        #expect(bars.flights == [day("2026-10-23", 0): 3, day("2026-10-27", 0): 12, day("2026-10-28", 0): 5])
        #expect(bars.meters == [day("2026-10-23", 0): 7200, day("2026-10-27", 0): 11500, day("2026-10-28", 0): 7700])
        let week = try #require(plot.window(at: plot.initialStart).steps)
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
        #expect(!plot.scrolls)
        let bars = try #require(plot.steps)
        let month = try #require(plot.window(at: plot.initialStart).steps)
        #expect(bars.flights == [day("2026-09-28", 0): 40, day("2026-10-19", 0): 3, day("2026-10-26", 0): 8.5])
        #expect(bars.meters == [day("2026-09-28", 0): 9000, day("2026-10-19", 0): 7200, day("2026-10-26", 0): 9600])
        #expect(month.distance == 35400)
        // Steps start Oct 22, so the month's goal covers those 7 days, not the 30 since Sep 29.
        #expect(month.goalShare == 59950.0 / 70_000)
        #expect(month.tier == .near)
        #expect(plot.scrubDates == [day("2026-10-22", 12), day("2026-10-29", 12)])
        // The domain runs over whole weeks, from the one holding the range's start to the one holding today.
        #expect(plot.xDomain == day("2026-09-28", 0)...day("2026-11-02", 0))
        #expect(plot.months.isEmpty)
    }

    @Test func coarseBarsOpenOnWholeCalendarBins() throws {
        // A week averaged by month opens on its month's bar instead of a window past today.
        let monthly = plot(range: .oneWeek, averaging: .monthly)
        let month = monthly.window(at: monthly.initialStart)
        #expect(month.interval == DateInterval(start: day("2026-10-01", 0), end: day("2026-11-01", 0)))
        #expect(try #require(month.steps).total == 59950)

        // A week across the fall-back change lasts 169 hours and still shows one weekly bar.
        var pacific = Calendar(identifier: .gregorian)
        pacific.timeZone = TimeZone(identifier: "America/Los_Angeles")!
        let start = pacific.date(from: DateComponents(year: 2026, month: 10, day: 20))!
        let points = (0..<16).map { DatedValue(date: pacific.date(byAdding: .day, value: $0, to: start)!, value: 1000) }
        let tab = MetricTab(title: "Steps", points: points, unit: .whole("steps"), averageTitle: "Average Steps", summary: .total, style: .bar, color: Theme.coral, goal: 10_000)
        let now = pacific.date(from: DateComponents(year: 2026, month: 11, day: 4, hour: 12))!
        let weekly = MetricPlot(tab: tab, footer: .months, range: .oneWeek, averaging: .weekly, now: now, calendar: pacific, unit: .kg)
        let week = weekly.window(at: weekly.initialStart).interval
        #expect(week.start == pacific.date(from: DateComponents(year: 2026, month: 11, day: 1)))
        #expect(week.end == pacific.date(from: DateComponents(year: 2026, month: 11, day: 8)))
    }

    @Test func aWeekScrollsBackThroughEveryRecordedDayAndSummarizesTheShownWeek() throws {
        let points = (0..<14).map { DatedValue(date: utc.date(byAdding: .day, value: $0, to: day("2026-10-15", 0))!, value: Double(1000 * ($0 + 1))) }
        let tab = MetricTab(title: "Steps", points: points, unit: .whole("steps"), averageTitle: "Average Steps", summary: .total, style: .bar, color: Theme.coral, goal: 10_000)
        let summary = StepGoal.summary(points, goal: 10_000, today: day("2026-10-28"), calendar: utc)
        let plot = MetricPlot(tab: tab, footer: .steps(summary, flights: [], meters: []), range: .oneWeek, averaging: .daily, now: day("2026-10-28"), calendar: utc, unit: .kg)
        #expect(plot.scrolls)
        #expect(plot.drawn.count == 14)
        #expect(plot.xDomain == day("2026-10-15", 0)...day("2026-10-29", 0))
        #expect(plot.initialStart == day("2026-10-22", 0))
        #expect(try #require(plot.window(at: plot.initialStart).steps).total == 77_000)
        let earlier = plot.window(at: day("2026-10-15", 0))
        #expect(earlier.interval == DateInterval(start: day("2026-10-15", 0), end: day("2026-10-22", 0)))
        #expect(earlier.points.map(\.value) == [1000, 2000, 3000, 4000, 5000, 6000, 7000])
        #expect(earlier.high == 10_000)
        let week = try #require(earlier.steps)
        #expect(week.total == 28_000)
        #expect(week.goalShare == 0.4)
        // A scroll never shows days before the first recorded one.
        #expect(plot.window(at: day("2026-10-01", 0)).interval == earlier.interval)
    }

    @Test func aScrollDrawsOnlyTheBarsAroundItsWindowAndEveryBarItShows() {
        let points = (0..<400).map { DatedValue(date: utc.date(byAdding: .day, value: $0, to: day("2025-10-01", 0))!, value: Double($0 + 1)) }
        let tab = MetricTab(title: "Steps", points: points, unit: .whole("steps"), averageTitle: "Average Steps", summary: .total, style: .bar, color: Theme.coral, goal: 10_000)
        let summary = StepGoal.summary(points, goal: 10_000, today: day("2026-11-04"), calendar: utc)
        for range in [ChartRange.oneWeek, .oneMonth, .threeMonths] {
            let plot = MetricPlot(tab: tab, footer: .steps(summary, flights: [], meters: []), range: range, averaging: .daily, now: day("2026-11-04"), calendar: utc, unit: .kg)
            var start = plot.xDomain.lowerBound
            while start <= plot.initialStart {
                let page = plot.page(at: start)
                let drawn = plot.drawn.within(plot.drawnInterval(page: page))
                let shown = plot.window(at: start).points
                #expect(Set(shown.map(\.date)).isSubset(of: Set(drawn.map(\.date))), "\(range) at \(start)")
                #expect(Double(drawn.count) <= plot.visibleBars * 1.75 + 2, "\(range) draws \(drawn.count) bars")
                start = start.addingTimeInterval(3 * 3600)
            }
        }
    }

    @Test func theLiveWindowSnapsToTheNearestBarEdgeInsideTheHistory() {
        let points = (0..<30).map { DatedValue(date: utc.date(byAdding: .day, value: $0, to: day("2026-10-01", 0))!, value: 1000) }
        let tab = MetricTab(title: "Steps", points: points, unit: .whole("steps"), averageTitle: "Average Steps", summary: .total, style: .bar, color: Theme.coral, goal: 10_000)
        let summary = StepGoal.summary(points, goal: 10_000, today: day("2026-10-30"), calendar: utc)
        let plot = MetricPlot(tab: tab, footer: .steps(summary, flights: [], meters: []), range: .oneWeek, averaging: .daily, now: day("2026-10-30"), calendar: utc, unit: .kg)
        #expect(plot.windowStart(at: day("2026-10-10", 11)) == day("2026-10-10", 0))
        #expect(plot.windowStart(at: day("2026-10-10", 13)) == day("2026-10-11", 0))
        #expect(plot.windowStart(at: day("2026-09-01", 0)) == plot.xDomain.lowerBound)
        #expect(plot.windowStart(at: day("2026-12-01", 0)) == plot.initialStart)
    }

    @Test func withinFindsTheSameDaysAsInside() {
        let points = (0..<20).map { DatedValue(date: utc.date(byAdding: .day, value: 2 * $0, to: day("2026-10-01", 0))!, value: Double($0)) }
        for (from, to) in [(0, 40), (3, 9), (-5, 2), (38, 60), (10, 10), (50, 70)] {
            let interval = DateInterval(start: utc.date(byAdding: .day, value: from, to: day("2026-10-01", 0))!, end: utc.date(byAdding: .day, value: to, to: day("2026-10-01", 0))!)
            #expect(Array(points.within(interval)) == points.inside(interval))
        }
        // Two weigh-ins three weeks apart still draw the segment across a week between them.
        let sparse = [DatedValue(date: day("2026-10-01"), value: 80), DatedValue(date: day("2026-10-22"), value: 81)]
        let week = DateInterval(start: day("2026-10-08", 0), duration: 7 * 86_400)
        #expect(sparse.within(week).isEmpty)
        #expect(Array(sparse.within(week, neighbours: true)) == sparse)
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
