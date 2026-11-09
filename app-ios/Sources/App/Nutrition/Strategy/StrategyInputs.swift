import Foundation

/// The trend weight and expenditure Strategy plans from, computed by the engine from the weigh-ins (merged as the
/// Dashboard merges them) and the log. Nothing here is stored; a check-in freezes what it used in its plan row.
struct StrategyInputs {
    var today: CalendarDay
    var trend: [CalendarDay: Double]
    var expenditure: [CalendarDay: NutritionEngine.ExpenditureDay]
    /// Counted intake: logged days and fasted days, never partial or unlogged ones.
    var intake: [CalendarDay: Double]
    /// Counted days the screen leaves out as almost certainly incomplete.
    var incomplete: [CalendarDay: NutritionEngine.Maintenance.IncompleteDay]
    var statuses: [CalendarDay: NutritionDay.Status]
    var weighInDays: Set<CalendarDay>
    var trendWeightKg: Double?
    /// What the plans are computed from: the static expenditure when one is set, else the maintenance estimate.
    var expenditureKcal: Double?
    var isStaticExpenditure: Bool
    var maintenance: NutritionEngine.Maintenance.Estimate?

    static func make(
        weighIns: [WeighIn], log: [NutritionLogDay], settings: NutritionSettings, profile: ProfileSettings, plans: [NutritionPlan] = [],
        steps: [DatedValue] = [], workouts: [DatedValue] = [], today: CalendarDay, calendar: Calendar
    ) -> StrategyInputs {
        let end = today.date(in: calendar)
        let weights = weighIns.points
        let trendSeries = NutritionEngine.TrendWeight.daily(weighIns: weights, through: end, calendar: calendar)
        let past = log.filter { $0.day <= today }
        let counted = Dictionary(uniqueKeysWithValues: past.compactMap { day in day.intake.energy.map { (day.day, $0) } })
        let screened = NutritionEngine.Maintenance.screen(NutritionExpenditure.countedDays(past, calendar: calendar), calendar: calendar)
        let intake = screened.counted
        let series = NutritionExpenditure.expenditure(
            intake: intake, weighIns: weights, trend: trendSeries, settings: settings.expenditure, profile: profile, plans: plans, steps: steps,
            now: end, calendar: calendar
        )
        let maintenance = trendSeries.last.flatMap { trend in
            NutritionExpenditure.maintenance(
                log: past, weighIns: weights, weightKg: trend.value, settings: settings.expenditure, profile: profile,
                steps: steps, workouts: workouts, now: end, calendar: calendar
            )
        }
        return StrategyInputs(
            today: today,
            trend: Dictionary(trendSeries.map { (CalendarDay($0.date, in: calendar), $0.value) }, uniquingKeysWith: { $1 }),
            expenditure: Dictionary(series.map { (CalendarDay($0.date, in: calendar), $0) }, uniquingKeysWith: { $1 }),
            intake: counted,
            incomplete: Dictionary(screened.incomplete.map { (CalendarDay($0.date, in: calendar), $0) }, uniquingKeysWith: { $1 }),
            statuses: Dictionary(uniqueKeysWithValues: log.map { ($0.day, $0.status) }),
            weighInDays: Set(weighIns.map { CalendarDay($0.date, in: calendar) }),
            trendWeightKg: trendSeries.last?.value,
            expenditureKcal: settings.expenditure.staticKcal ?? maintenance?.kcal,
            isStaticExpenditure: settings.expenditure.staticKcal != nil,
            maintenance: maintenance
        )
    }

    func basis(standardFloorKcal: Int) -> StrategyBasis? {
        guard let trendWeightKg, let expenditureKcal else { return nil }
        return StrategyBasis(weightKg: trendWeightKg, expenditureKcal: expenditureKcal, standardFloorKcal: standardFloorKcal)
    }

    /// The trend on `day`, or the first trend value when `day` precedes every weigh-in.
    func trendWeight(on day: CalendarDay) -> Double? {
        trend[day] ?? (day < (trend.keys.min() ?? day) ? trend[trend.keys.min()!] : nil)
    }
}
