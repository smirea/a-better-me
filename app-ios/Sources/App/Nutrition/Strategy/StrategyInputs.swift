import Foundation
import GRDB

/// The log as the expenditure algorithm reads it, one value per day that has entries or a day row.
struct IntakeLog: Equatable, Sendable {
    var days: [CalendarDay: DayIntake] = [:]
    var status: [CalendarDay: NutritionDay.Status] = [:]

    static let all = DatabaseQuery(IntakeLog()) { db in
        let entries = Dictionary(grouping: try FoodEntry.fetchAll(db), by: \.day)
        let rows = Dictionary(uniqueKeysWithValues: try NutritionDay.fetchAll(db).map { ($0.id, $0) })
        var log = IntakeLog()
        for day in Set(entries.keys).union(rows.keys) {
            log.days[day] = DayIntake(entries: entries[day] ?? [], day: rows[day])
            log.status[day] = rows[day]?.status ?? NutritionDay.Status.none
        }
        return log
    }
}

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
        weighIns: [WeighIn], log: IntakeLog, settings: NutritionSettings, profile: ProfileSettings, today: CalendarDay, calendar: Calendar
    ) -> StrategyInputs {
        let end = date(today, calendar)
        let weights = weighIns.map { DatedValue(date: $0.date, value: $0.kg) }
        let trendSeries = NutritionEngine.TrendWeight.daily(weighIns: weights, through: end, calendar: calendar)
        let counted = log.days.compactMapValues(\.energy).filter { $0.key <= today }
        let intake = counted.keys.sorted().map { DatedValue(date: date($0, calendar), value: counted[$0]!) }
        let series = NutritionMetrics.expenditure(
            intake: intake, weighIns: weights, trend: trendSeries, settings: settings.expenditure, profile: profile, now: end, calendar: calendar
        )
        let initial = NutritionMetrics.expenditureSetup(
            intake: intake, weighIns: weights, trend: trendSeries, settings: settings.expenditure, profile: profile, calendar: calendar
        )?.initialKcal
        return StrategyInputs(
            today: today,
            trend: Dictionary(trendSeries.map { (CalendarDay($0.date, in: calendar), $0.value) }, uniquingKeysWith: { $1 }),
            expenditure: Dictionary(series.map { (CalendarDay($0.date, in: calendar), $0) }, uniquingKeysWith: { $1 }),
            intake: counted,
            statuses: log.status,
            weighInDays: Set(weighIns.map { CalendarDay($0.date, in: calendar) }),
            trendWeightKg: trendSeries.last?.value,
            expenditureKcal: series.last?.kcal ?? initial,
            isStaticExpenditure: settings.expenditure.staticKcal != nil
        )
    }

    static func date(_ day: CalendarDay, _ calendar: Calendar) -> Date {
        calendar.date(from: DateComponents(year: day.year, month: day.month, day: day.day))!
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
