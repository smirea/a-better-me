import Foundation
import Testing
@testable import App

private func start(_ text: String) -> Date { utc.startOfDay(for: day(text)) }

private func logDay(_ text: String, kcal: [Double] = [], row: NutritionDay? = nil) -> NutritionLogDay {
    let calendarDay = CalendarDay(text)!
    let entries = kcal.map { FoodEntry(FoodPortion(.quickAdd([.energy: $0, .protein: $0 / 20])), day: calendarDay, minute: 720) }
    return NutritionLogDay(day: calendarDay, entries: entries, row: row)
}

private func row(_ text: String, _ status: NutritionDay.Status = .none, override: NutrientAmounts? = nil) -> NutritionDay {
    var row = NutritionDay(id: CalendarDay(text)!)
    row.status = status
    row.override = override
    return row
}

private func plan(_ text: String, kcal: Double, goal: NutritionGoal? = nil) -> NutritionPlan {
    NutritionPlan(
        from: CalendarDay(text)!, kind: .setup,
        goal: goal ?? NutritionGoal(kind: .lose, targetWeightKg: 80, ratePercentPerWeek: -0.5, startedOn: CalendarDay(text)!),
        coaching: CoachingProgram(), targets: WeekTargets(every: DayTarget(energy: kcal, protein: 150, fat: 60, carbs: 200))
    )
}

struct NutritionMetricsTests {
    @Test func healthStepsWinTheirDaysAndImportedStepsFillTheRest() {
        let health = [DatedValue(date: start("2026-10-01"), value: 9000), DatedValue(date: start("2026-10-02"), value: 4000)]
        let imported = [
            BodyMetric(.steps, on: CalendarDay("2026-10-02")!, value: 12000),
            BodyMetric(.steps, on: CalendarDay("2026-09-30")!, value: 7000),
            BodyMetric(.waist, on: CalendarDay("2026-09-29")!, value: 80),
        ]
        let steps = NutritionMetrics.steps(health: health, imported: imported, calendar: utc)
        #expect(steps == [
            DatedValue(date: start("2026-09-30"), value: 7000),
            DatedValue(date: start("2026-10-01"), value: 9000),
            DatedValue(date: start("2026-10-02"), value: 4000),
        ])
    }

    @Test func logDaysCountOverridesFastsAndSkipIncompleteDays() {
        let log = [
            logDay("2026-10-01", kcal: [500, 700]),
            logDay("2026-10-02", kcal: [900], row: row("2026-10-02", override: [.energy: 2100])),
            logDay("2026-10-03", kcal: [400], row: row("2026-10-03", .partial)),
            logDay("2026-10-04", row: row("2026-10-04", .fasted)),
            logDay("2026-10-05", row: row("2026-10-05")),
        ]
        #expect(log.map { $0.consumed[.energy] ?? 0 } == [1200, 2100, 400, 0, 0])
        #expect(NutritionMetrics.intake(log, calendar: utc) == [
            DatedValue(date: start("2026-10-01"), value: 1200),
            DatedValue(date: start("2026-10-02"), value: 2100),
            DatedValue(date: start("2026-10-04"), value: 0),
        ])
        #expect(log.map(NutritionMetrics.logState) == [.tracked, .tracked, .tracked, .fasting, .untracked])
    }

    @Test func foodLoggingHabitCountsTrackedAndFastingDaysAndTheStreak() {
        let log = [
            logDay("2026-10-20", kcal: [500]),
            logDay("2026-10-22", kcal: [500]),
            logDay("2026-10-23", row: row("2026-10-23", .fasted)),
            logDay("2026-10-24", kcal: [500]),
            logDay("2026-10-25", row: row("2026-10-25", .partial)),
        ]
        let dates = NutritionMetrics.loggedDates(log, calendar: utc)
        #expect(dates == [start("2026-10-20"), start("2026-10-22"), start("2026-10-23"), start("2026-10-24")])
        // 2026-10-26 is a Monday; utc starts weeks on Monday, so nothing is logged this week yet.
        #expect(DashboardMetrics.daysThisWeek(dates, now: day("2026-10-26", 9), calendar: utc) == 0)
        #expect(DashboardMetrics.daysThisWeek(dates, now: day("2026-10-25", 9), calendar: utc) == 4)
        #expect(NutritionMetrics.streak(dates, now: day("2026-10-25", 9), calendar: utc) == 3)
        #expect(NutritionMetrics.streak(dates, now: day("2026-10-24", 9), calendar: utc) == 3)
        #expect(NutritionMetrics.streak(dates, now: day("2026-10-27", 9), calendar: utc) == 0)
        #expect(DashboardMetrics.habitDays(dates, count: 7, now: day("2026-10-25", 9), calendar: utc) == [false, true, false, true, true, true, false])
    }

    @Test func energyBalanceIsIntakeMinusTheReferenceOnSharedDays() {
        let intake = [
            DatedValue(date: start("2026-10-20"), value: 1800),
            DatedValue(date: start("2026-10-21"), value: 2600),
            DatedValue(date: start("2026-10-23"), value: 2230),
        ]
        let expenditure = (20...22).map { DatedValue(date: start("2026-10-\($0)"), value: 2200) }
        let differences = NutritionMetrics.differences(intake: intake, reference: expenditure, calendar: utc)
        #expect(differences == [DatedValue(date: start("2026-10-20"), value: -400), DatedValue(date: start("2026-10-21"), value: 400)])
        #expect(NutritionMetrics.trailingMean(differences, days: 7, now: day("2026-10-23"), calendar: utc) == 0)
        #expect(NutritionMetrics.trailingMean(differences, days: 3, now: day("2026-10-23"), calendar: utc) == 400)
        #expect(NutritionMetrics.trailingMean(differences, days: 1, now: day("2026-10-23"), calendar: utc) == nil)
        #expect([0, 49, -49.9, 50, -120].map(NutritionMetrics.balance) == [.balanced, .balanced, .balanced, .above, .below])
    }

    @Test func energyTargetsFollowThePlanInForceEachDay() {
        let plans = [plan("2026-10-01", kcal: 2000), plan("2026-10-03", kcal: 1800)]
        #expect(NutritionMetrics.energyTargets(plans, through: CalendarDay("2026-10-04")!, calendar: utc).map(\.value) == [2000, 2000, 1800, 1800])
        #expect(NutritionMetrics.energyTargets([], through: CalendarDay("2026-10-04")!, calendar: utc).isEmpty)
    }

    @Test func goalProgressIsTheShareOfTheWayToTheTarget() {
        #expect(NutritionMetrics.goalPercent(startKg: 90, currentKg: 86, targetKg: 80) == 40)
        #expect(NutritionMetrics.goalPercent(startKg: 70, currentKg: 73, targetKg: 75) == 60)
        #expect(NutritionMetrics.goalPercent(startKg: 90, currentKg: 92, targetKg: 80) == 0)
        #expect(NutritionMetrics.goalPercent(startKg: 90, currentKg: 79, targetKg: 80) == 100)
        #expect(NutritionMetrics.goalPercent(startKg: 80, currentKg: 80, targetKg: 80) == 100)
    }

    @Test func goalWaterfallSplitsTheDistanceByMonth() {
        let goal = NutritionGoal(kind: .lose, targetWeightKg: 80, ratePercentPerWeek: -0.5, startedOn: CalendarDay("2026-01-01")!)
        let points = [("2026-01-01", 90.0), ("2026-02-01", 88), ("2026-03-01", 89), ("2026-03-15", 87)].map { DatedValue(date: start($0.0), value: $0.1) }
        let bars = NutritionMetrics.waterfall(points, goal: goal, now: day("2026-03-15", 12), calendar: utc)
        #expect(bars == [
            .init(month: 0, kind: .start, low: 0, high: 10),
            .init(month: 1, kind: .towards, low: 8, high: 10),
            .init(month: 2, kind: .away, low: 8, high: 9),
            .init(month: 3, kind: .towards, low: 7, high: 9),
            .init(month: 3, kind: .remaining, low: 0, high: 7),
        ])
        var maintain = goal
        maintain.kind = .maintain
        #expect(NutritionMetrics.waterfall(points, goal: maintain, now: day("2026-03-15"), calendar: utc).isEmpty)
    }

    @Test func weightInsightsUseTheLastThreeWeeksOfTrend() throws {
        let trend = (0...21).map { DatedValue(date: utc.date(byAdding: .day, value: $0, to: start("2026-10-01"))!, value: 90 - 0.03 * Double($0)) }
        let insights = try #require(NutritionMetrics.weightInsights(trend: trend, now: day("2026-10-22", 20), calendar: utc))
        #expect(abs(insights.currentKg - 89.37) < 1e-9)
        #expect(abs(insights.weeklyChangeKg! - -0.21) < 1e-9)
        #expect(abs(insights.energyBalanceKcal! - -231.4853) < 1e-3)
        #expect(abs(insights.projectionKg! - 88.47) < 1e-9)
        #expect(NutritionMetrics.weightInsights(trend: trend, now: day("2026-10-23"), calendar: utc) == nil)
    }

    @Test func changesCompareTodayWithEachSpanBack() {
        let daily = (0...10).map { DatedValue(date: utc.date(byAdding: .day, value: $0, to: start("2026-10-01"))!, value: 2000 + 10 * Double($0)) }
        let changes = NutritionMetrics.changes(daily, now: day("2026-10-11", 15), calendar: utc, spans: [3, 7, 14])
        #expect(changes.map(\.delta) == [30, 70, nil])
        #expect(changes[0].values == [2070, 2080, 2090, 2100])
        #expect(changes[2].values.count == 11)
        #expect(NutritionMetrics.direction(0.4, tolerance: 0.5) == .noChange)
        #expect(NutritionMetrics.direction(-3, tolerance: 0.5) == .decrease)
        #expect(NutritionMetrics.direction(nil, tolerance: 0.5) == .noChange)
    }

    @Test func weeklyNutritionRunsMondayToSundayWithRemainingAgainstTargets() {
        let log = [logDay("2026-10-26", kcal: [1500, 700]), logDay("2026-10-27", kcal: [300])]
        let plans = [plan("2026-10-27", kcal: 2000)]
        let week = NutritionMetrics.week(of: CalendarDay("2026-10-28")!, log: log, plans: plans)
        #expect(week.map(\.day.description) == ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"])
        #expect(week[0].consumed(.energy) == 2200)
        #expect(week[0].target(.energy) == nil)
        #expect(week[1].target(.protein) == 150)
        #expect(week[1].remaining(.energy, overages: true) == 1700)
        let over = NutritionMetrics.day(CalendarDay("2026-10-26")!, log: log, plans: [plan("2026-10-20", kcal: 2000)])
        #expect(over.remaining(.energy, overages: true) == -200)
        #expect(over.remaining(.energy, overages: false) == 0)
    }

    @Test func expenditureStartsAtTheFirstDataAndNeedsAnInitialEstimate() throws {
        let log = [logDay("2026-10-05", kcal: [2000])]
        let weighIns = [DatedValue(date: day("2026-10-03"), value: 80)]
        let trend = NutritionEngine.TrendWeight.daily(weighIns: weighIns, through: day("2026-10-06"), calendar: utc)
        var settings = NutritionSettings.Expenditure()
        let none = NutritionMetrics.expenditureSetup(log: log, weighIns: weighIns, trend: trend, settings: settings, profile: ProfileSettings(), calendar: utc)
        #expect(none == nil)
        var profile = ProfileSettings()
        profile.heightCm = 180
        profile.birthDate = CalendarDay("1990-06-01")
        let bmr = try #require(NutritionMetrics.expenditureSetup(log: log, weighIns: weighIns, trend: trend, settings: settings, profile: profile, calendar: utc))
        #expect(bmr.start == start("2026-10-03"))
        // MacroFactor BMR at 80 kg, 180 cm, 36 years: 129.6 × 80^0.55 + 0.011 × 180² − 1.96 × 36 = 1729.0, × 1.55.
        #expect(bmr.initialKcal == 2680)
        settings.activity = .mostlySedentary
        settings.exercise = .zero
        let sedentary = try #require(NutritionMetrics.expenditureSetup(log: log, weighIns: weighIns, trend: trend, settings: settings, profile: profile, calendar: utc))
        // 1729.0 × 1.2.
        #expect(sedentary.initialKcal == 2075)
        settings.initialKcal = 2500
        settings.calculationStart = CalendarDay("2026-10-04")
        let manual = NutritionMetrics.expenditureSetup(log: log, weighIns: weighIns, trend: trend, settings: settings, profile: ProfileSettings(), calendar: utc)
        #expect(manual == .init(start: start("2026-10-04"), initialKcal: 2500))
        settings.staticKcal = 2300
        settings.initialKcal = nil
        let fixed = NutritionMetrics.expenditure(log: log, weighIns: weighIns, trend: trend, settings: settings, profile: ProfileSettings(), now: day("2026-10-06"), calendar: utc)
        #expect(fixed.map(\.kcal) == [2300, 2300, 2300])
        #expect(NutritionMetrics.strategy(fixed, settings: settings) == .fixed)
    }

    @Test func savedLayoutsAdoptTheNutritionCardsOnce() throws {
        let old = #"{"primaryFocus":["recentRecords"],"insights":["workouts","weightTrend"],"habits":["weighIn","workouts"]}"#
        let adopted = try RowJSON.decoder.decode(DashboardLayout.self, from: Data(old.utf8))
        #expect(adopted.primaryFocus == [.recentRecords, .weeklyNutrition, .energyBalance, .dailyNutrition])
        #expect(adopted.insights == [.workouts, .weightTrend, .expenditure, .energyBalance, .goalProgress])
        #expect(adopted.habits == [.weighIn, .foodLogging, .workouts])
        #expect(adopted.revision == 2)
        let trimmed = #"{"revision":1,"insights":["weightTrend"],"habits":["weighIn"],"primaryFocus":[]}"#
        let kept = try RowJSON.decoder.decode(DashboardLayout.self, from: Data(trimmed.utf8))
        #expect(kept.insights == [.weightTrend])
        #expect(kept.habits == [.weighIn])
        #expect(kept.primaryFocus.isEmpty)
        let encoded = try RowJSON.text(kept)
        #expect(encoded.contains(#""revision":2"#))
        var reset = DashboardLayout()
        reset.insights.removeAll { $0 == .expenditure }
        let reread = try RowJSON.decoder.decode(DashboardLayout.self, from: Data(RowJSON.text(reset.saved).utf8))
        #expect(reread.insights == [.workouts, .weightTrend, .energyBalance, .goalProgress])
    }
}
