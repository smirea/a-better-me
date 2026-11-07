import Foundation

/// The trend weight and expenditure Strategy plans from, computed by the engine from the weigh-ins (merged as the
/// Dashboard merges them) and the log. Nothing here is stored; a check-in freezes what it used in its plan row.
struct StrategyInputs {
    var today: CalendarDay
    var trend: [CalendarDay: Double]
    var expenditure: [CalendarDay: NutritionEngine.ExpenditureDay]
    /// Counted intake: logged days and fasted days, never partial or unlogged ones.
    var intake: [CalendarDay: Double]
    var statuses: [CalendarDay: NutritionDay.Status]
    var weighInDays: Set<CalendarDay>
    var trendWeightKg: Double?
    /// The static expenditure when one is set, else today's dynamic estimate, else the initial estimate.
    var expenditureKcal: Double?
    var isStaticExpenditure: Bool


    static func make(
        weighIns: [WeighIn], log: [NutritionLogDay], settings: NutritionSettings, profile: ProfileSettings, plans: [NutritionPlan] = [],
        steps: [DatedValue] = [], today: CalendarDay, calendar: Calendar
    ) -> StrategyInputs {
        let end = today.date(in: calendar)
        let weights = weighIns.points
        let trendSeries = NutritionEngine.TrendWeight.daily(weighIns: weights, through: end, calendar: calendar)
        let counted = Dictionary(uniqueKeysWithValues: log.filter { $0.day <= today }.compactMap { day in day.intake.energy.map { (day.day, $0) } })
        let intake = counted.keys.sorted().map { DatedValue(date: $0.date(in: calendar), value: counted[$0]!) }
        let series = NutritionExpenditure.expenditure(
            intake: intake, weighIns: weights, trend: trendSeries, settings: settings.expenditure, profile: profile, plans: plans, steps: steps,
            now: end, calendar: calendar
        )
        let initial = NutritionExpenditure.expenditureSetup(
            intake: intake, weighIns: weights, trend: trendSeries, settings: settings.expenditure, profile: profile, calendar: calendar
        )?.initialKcal
        return StrategyInputs(
            today: today,
            trend: Dictionary(trendSeries.map { (CalendarDay($0.date, in: calendar), $0.value) }, uniquingKeysWith: { $1 }),
            expenditure: Dictionary(series.map { (CalendarDay($0.date, in: calendar), $0) }, uniquingKeysWith: { $1 }),
            intake: counted,
            statuses: Dictionary(uniqueKeysWithValues: log.map { ($0.day, $0.status) }),
            weighInDays: Set(weighIns.map { CalendarDay($0.date, in: calendar) }),
            trendWeightKg: trendSeries.last?.value,
            expenditureKcal: settings.expenditure.staticKcal ?? series.last?.kcal ?? initial,
            isStaticExpenditure: settings.expenditure.staticKcal != nil
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
