import Foundation
import GRDB

/// One day of the food log as the Dashboard reads it: what was eaten and what the owner said about the day.
struct NutritionLogDay: Equatable, Sendable {
    var day: CalendarDay
    /// The override when the day has one, else the entries' sum.
    var consumed: NutrientAmounts
    var entryCount: Int
    var status: NutritionDay.Status
    var hasOverride: Bool
    /// What the expenditure and energy balance count.
    var intake: DayIntake

    init(day: CalendarDay, entries: [FoodEntry], row: NutritionDay?) {
        self.day = day
        let total = entries.reduce(into: NutrientAmounts()) { $0 = $0 + $1.amounts }
        consumed = row?.override ?? total
        entryCount = entries.count
        status = row?.status ?? .none
        hasOverride = row?.override != nil
        intake = DayIntake(entries: entries, day: row)
    }

    /// Every day with entries or a day row, oldest first.
    static let all = DatabaseQuery([NutritionLogDay]()) { db in
        let entries = try Dictionary(grouping: FoodEntry.fetchAll(db), by: \.day)
        let rows = try Dictionary(NutritionDay.fetchAll(db).map { ($0.id, $0) }, uniquingKeysWith: { $1 })
        return Set(entries.keys).union(rows.keys).sorted().map { NutritionLogDay(day: $0, entries: entries[$0] ?? [], row: rows[$0]) }
    }
}

extension CalendarDay {
    /// The start of the day in `calendar`, where the Dashboard's series live.
    func date(in calendar: Calendar) -> Date {
        calendar.date(from: DateComponents(year: year, month: month, day: day))!
    }
}

/// The nutrition numbers on the Dashboard, as pure functions over the log, the plans, and the engine's series, so tests
/// pin each to literal values. See docs/decisions/nutrition.md "Dashboard".
enum NutritionMetrics {
    static let macros: [NutrientID] = [.energy, .protein, .fat, .carbs]

    // MARK: Steps

    /// HealthKit wins on a day it has steps; an imported count fills a day HealthKit lacks.
    static func steps(health: [DatedValue], imported: [BodyMetric], calendar: Calendar) -> [DatedValue] {
        let healthDays = Set(health.map { calendar.startOfDay(for: $0.date) })
        let filled = imported.filter { $0.kind == .steps }
            .map { DatedValue(date: $0.day.date(in: calendar), value: $0.value) }
            .filter { !healthDays.contains($0.date) }
        return (health + filled).sorted { $0.date < $1.date }
    }

    // MARK: Expenditure

    enum ExpenditureStrategy: Equatable {
        case updating, holding, fixed
    }

    /// The days the expenditure runs over and the estimate it starts from.
    struct ExpenditureSetup: Equatable {
        var start: Date
        var initialKcal: Double
    }

    /// The days that count toward expenditure: logged days at their kcal, fasted days at zero.
    static func intake(_ log: [NutritionLogDay], calendar: Calendar) -> [DatedValue] {
        log.compactMap { day in day.intake.energy.map { DatedValue(date: day.day.date(in: calendar), value: $0) } }
    }

    /// The start is the setting's, else the first counted day or weigh-in. The initial estimate is the owner's, else the
    /// BMR one at the trend weight on the start day, which needs the profile's height and birth date. Nil without
    /// either: the Dashboard says what is missing instead of guessing.
    static func expenditureSetup(
        log: [NutritionLogDay], weighIns: [DatedValue], trend: [DatedValue], settings: NutritionSettings.Expenditure,
        profile: ProfileSettings, calendar: Calendar
    ) -> ExpenditureSetup? {
        let firstIntake = intake(log, calendar: calendar).first?.date
        let firstWeighIn = weighIns.map(\.date).min().map { calendar.startOfDay(for: $0) }
        guard let start = settings.startOn?.date(in: calendar) ?? [firstIntake, firstWeighIn].compactMap({ $0 }).min() else { return nil }
        if let initial = settings.initialKcal { return ExpenditureSetup(start: start, initialKcal: initial) }
        let weightKg = trend.first { calendar.isDate($0.date, inSameDayAs: start) }?.value ?? trend.first?.value
        guard let weightKg, let initial = initialEstimate(profile: profile, weightKg: weightKg, on: start, calendar: calendar) else { return nil }
        return ExpenditureSetup(start: start, initialKcal: initial)
    }

    /// The activity answers are not settings yet, so they are the ones the decision file anchors the factor table on:
    /// moderately active with 4 to 6 sessions a week.
    static func initialEstimate(profile: ProfileSettings, weightKg: Double, on day: Date, calendar: Calendar) -> Double? {
        guard let height = profile.heightCm, let birth = profile.birthDate,
              let age = calendar.dateComponents([.year], from: birth.date(in: calendar), to: day).year else { return nil }
        let bmr = NutritionEngine.BMR.macroFactor(weightKg: weightKg, heightCm: height, ageYears: age, sex: profile.sex == .female ? .female : .male)
        return NutritionEngine.InitialExpenditure.estimate(bmr: bmr, activity: .moderatelyActive, exercise: .fourToSix)
    }

    /// A static expenditure replaces every day's estimate and never holds.
    static func expenditure(
        log: [NutritionLogDay], weighIns: [DatedValue], trend: [DatedValue], settings: NutritionSettings.Expenditure,
        profile: ProfileSettings, now: Date, calendar: Calendar
    ) -> [NutritionEngine.ExpenditureDay] {
        guard let setup = expenditureSetup(log: log, weighIns: weighIns, trend: trend, settings: settings, profile: profile, calendar: calendar),
              setup.start <= now else { return [] }
        if let fixed = settings.staticKcal {
            return NutritionEngine.eachDay(from: setup.start, through: now, calendar: calendar).map { .init(date: $0, kcal: fixed, isHolding: false) }
        }
        let intake = intake(log, calendar: calendar).map { NutritionEngine.IntakeDay(date: $0.date, kcal: $0.value) }
        return NutritionEngine.Expenditure.daily(
            intake: intake, trend: trend, weighIns: weighIns, initial: setup.initialKcal, from: setup.start, through: now, calendar: calendar
        )
    }

    static func strategy(_ days: [NutritionEngine.ExpenditureDay], settings: NutritionSettings.Expenditure) -> ExpenditureStrategy? {
        guard let last = days.last else { return nil }
        if settings.staticKcal != nil { return .fixed }
        return last.isHolding ? .holding : .updating
    }

    // MARK: Changes over the last days

    struct Change: Equatable {
        var days: Int
        /// Today's value minus the value `days` days before; nil when either is missing.
        var delta: Double?
        /// The values from `days` days ago through today, for the row's sparkline.
        var values: [Double]
    }

    static let changeSpans = [3, 7, 14, 30, 90]

    /// `daily` holds one value per day, such as the trend or the expenditure.
    static func changes(_ daily: [DatedValue], now: Date, calendar: Calendar, spans: [Int] = changeSpans) -> [Change] {
        let byDay = Dictionary(daily.map { (calendar.startOfDay(for: $0.date), $0.value) }, uniquingKeysWith: { $1 })
        let today = calendar.startOfDay(for: now)
        func value(_ offset: Int) -> Double? { byDay[calendar.date(byAdding: .day, value: -offset, to: today)!] }
        return spans.map { span in
            let delta = value(0).flatMap { end in value(span).map { end - $0 } }
            return Change(days: span, delta: delta, values: (0...span).reversed().compactMap(value))
        }
    }

    enum Direction: Equatable {
        case increase, decrease, noChange
    }

    /// A change smaller than `tolerance`, which is what the row would round to zero, is no change.
    static func direction(_ delta: Double?, tolerance: Double) -> Direction {
        guard let delta, abs(delta) >= tolerance else { return .noChange }
        return delta > 0 ? .increase : .decrease
    }

    // MARK: Weight Trend insights

    struct WeightInsights: Equatable {
        var currentKg: Double
        /// Per week, over the last three weeks of trend.
        var weeklyChangeKg: Double?
        /// Per day, negative for a deficit: the weekly change at 3500 kcal per lb.
        var energyBalanceKcal: Double?
        var projectionKg: Double?
    }

    static let insightWeeks = 3

    /// MacroFactor's tiles agree with energy = weekly change × 3500 / 7 kcal per lb and projection = trend + weekly
    /// change × 30 / 7 (docs/research/macrofactor/README.md §3.4).
    static func weightInsights(trend: [DatedValue], now: Date, calendar: Calendar) -> WeightInsights? {
        let byDay = Dictionary(trend.map { (calendar.startOfDay(for: $0.date), $0.value) }, uniquingKeysWith: { $1 })
        let today = calendar.startOfDay(for: now)
        guard let current = byDay[today] else { return nil }
        let weekly = byDay[calendar.date(byAdding: .day, value: -7 * insightWeeks, to: today)!].map { (current - $0) / Double(insightWeeks) }
        return WeightInsights(
            currentKg: current,
            weeklyChangeKg: weekly,
            energyBalanceKcal: weekly.map { $0 / NutritionEngine.kgPerLb * NutritionEngine.Targets.kcalPerLbPerWeek / 7 },
            projectionKg: weekly.map { current + $0 * 30 / 7 }
        )
    }

    // MARK: Energy balance

    /// Intake minus the reference on each day that has both.
    static func differences(intake: [DatedValue], reference: [DatedValue], calendar: Calendar) -> [DatedValue] {
        let byDay = Dictionary(reference.map { (calendar.startOfDay(for: $0.date), $0.value) }, uniquingKeysWith: { $1 })
        return intake.compactMap { day in byDay[calendar.startOfDay(for: day.date)].map { DatedValue(date: day.date, value: day.value - $0) } }
    }

    /// The mean of the points on the `days` days ending today; nil without any.
    static func trailingMean(_ points: [DatedValue], days: Int, now: Date, calendar: Calendar) -> Double? {
        let end = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now))!
        let start = calendar.date(byAdding: .day, value: -days, to: end)!
        return points.inside(DateInterval(start: start, end: end)).average
    }

    enum Balance: Equatable {
        case balanced, above, below
    }

    /// MacroFactor does not say how close counts as balanced; a difference that small is noise in a day's log.
    static let balanceToleranceKcal = 50.0

    static func balance(_ difference: Double) -> Balance {
        if abs(difference) < balanceToleranceKcal { return .balanced }
        return difference > 0 ? .above : .below
    }

    /// Each day's calorie target from the plan in force, from the first plan's day through `end`.
    static func energyTargets(_ plans: [NutritionPlan], through end: CalendarDay, calendar: Calendar) -> [DatedValue] {
        guard var day = plans.map(\.id).min() else { return [] }
        var result: [DatedValue] = []
        while day <= end {
            if let target = NutritionPlan.effective(on: day, in: plans)?.target(on: day) {
                result.append(DatedValue(date: day.date(in: calendar), value: target.energy))
            }
            day = day.adding(days: 1)
        }
        return result
    }

    // MARK: Daily and weekly nutrition

    struct DayNutrition: Equatable {
        var day: CalendarDay
        var consumed: NutrientAmounts
        var target: DayTarget?

        func consumed(_ id: NutrientID) -> Double { consumed[id] ?? 0 }

        func target(_ id: NutrientID) -> Double? {
            guard let target else { return nil }
            return switch id {
            case .energy: target.energy
            case .protein: target.protein
            case .fat: target.fat
            case .carbs: target.carbs
            default: nil
            }
        }

        /// Stops at zero past the target unless overages show.
        func remaining(_ id: NutrientID, overages: Bool) -> Double? {
            target(id).map { overages ? $0 - consumed(id) : max($0 - consumed(id), 0) }
        }
    }

    static func day(_ day: CalendarDay, log: [NutritionLogDay], plans: [NutritionPlan]) -> DayNutrition {
        DayNutrition(
            day: day,
            consumed: log.first { $0.day == day }?.consumed ?? [:],
            target: NutritionPlan.effective(on: day, in: plans)?.target(on: day)
        )
    }

    /// Monday through Sunday of the week holding `today`, as MacroFactor's Weekly Nutrition grid.
    static func week(of today: CalendarDay, log: [NutritionLogDay], plans: [NutritionPlan]) -> [DayNutrition] {
        let monday = today.adding(days: 1 - today.weekday)
        return (0..<7).map { day(monday.adding(days: $0), log: log, plans: plans) }
    }

    // MARK: Goal progress

    /// Percent of the way from the start weight to the target, 0 when the weight moved away and 100 once there.
    static func goalPercent(startKg: Double, currentKg: Double, targetKg: Double) -> Double {
        guard startKg != targetKg else { return 100 }
        return min(max((startKg - currentKg) / (startKg - targetKg) * 100, 0), 100)
    }

    /// The last value on or before `date`, else the first value after it.
    static func value(_ points: [DatedValue], on date: Date) -> Double? {
        (points.last { $0.date <= date } ?? points.first)?.value
    }

    struct WaterfallBar: Equatable {
        enum Kind: Equatable { case start, towards, away, remaining }

        /// Months since the goal started; the remaining bar has the last month's index.
        var month: Int
        var kind: Kind
        /// Distances to the target in kg, drawn from `low` to `high`.
        var low: Double
        var high: Double
    }

    /// MacroFactor's Goal Progress waterfall: the distance to the target at the start, then one bar per month of change
    /// toward or away from it, then the distance left. A distance is signed toward the goal, so passing the target
    /// makes it negative.
    static func waterfall(_ points: [DatedValue], goal: NutritionGoal, now: Date, calendar: Calendar) -> [WaterfallBar] {
        guard let target = goal.targetWeightKg, goal.kind != .maintain else { return [] }
        let start = goal.startedOn.date(in: calendar)
        func distance(_ date: Date) -> Double? {
            value(points, on: date).map { goal.kind == .lose ? $0 - target : target - $0 }
        }
        guard let first = distance(start) else { return [] }
        var bars = [WaterfallBar(month: 0, kind: .start, low: min(0, first), high: max(0, first))]
        var previous = first
        var month = 1
        while true {
            let next = calendar.date(byAdding: .month, value: month, to: start)!
            let date = min(next, now)
            guard date > start, let current = distance(date) else { break }
            bars.append(WaterfallBar(month: month, kind: current < previous ? .towards : .away, low: min(previous, current), high: max(previous, current)))
            previous = current
            if next >= now { break }
            month += 1
        }
        bars.append(WaterfallBar(month: bars[bars.count - 1].month, kind: .remaining, low: min(0, previous), high: max(0, previous)))
        return bars
    }

    // MARK: Food Logging habit

    enum LogState: Equatable {
        case tracked, fasting, untracked
    }

    /// A day with entries or entered totals is tracked, even when marked incomplete; a day marked fasted without them
    /// is fasting.
    static func logState(_ day: NutritionLogDay?) -> LogState {
        guard let day else { return .untracked }
        if day.entryCount > 0 || day.hasOverride { return .tracked }
        return day.status == .fasted ? .fasting : .untracked
    }

    /// The days the habit counts: tracked and fasting days.
    static func loggedDates(_ log: [NutritionLogDay], calendar: Calendar) -> [Date] {
        log.filter { logState($0) != .untracked }.map { $0.day.date(in: calendar) }
    }

    /// Consecutive counted days ending today, or ending yesterday while today is not logged yet.
    static func streak(_ dates: [Date], now: Date, calendar: Calendar) -> Int {
        let days = Set(dates.map { calendar.startOfDay(for: $0) })
        var day = calendar.startOfDay(for: now)
        if !days.contains(day) { day = calendar.date(byAdding: .day, value: -1, to: day)! }
        var count = 0
        while days.contains(day) {
            count += 1
            day = calendar.date(byAdding: .day, value: -1, to: day)!
        }
        return count
    }
}
