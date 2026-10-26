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

    /// MacroFactor's onboarding asks for activity; until a settings unit stores those answers, the initial estimate
    /// assumes moderately active with one to three sessions a week.
    static let assumedActivity = NutritionEngine.ActivityLevel.moderatelyActive
    static let assumedExercise = NutritionEngine.ExerciseSessions.oneToThree

    static func make(
        weighIns: [WeighIn], log: IntakeLog, settings: NutritionSettings, profile: ProfileSettings, today: CalendarDay, calendar: Calendar
    ) -> StrategyInputs {
        let end = date(today, calendar)
        let weights = weighIns.map { DatedValue(date: $0.date, value: $0.kg) }
        let trendSeries = NutritionEngine.TrendWeight.daily(weighIns: weights, through: end, calendar: calendar)
        let counted = log.days.compactMapValues(\.energy).filter { $0.key <= today }
        let initial = settings.expenditure.initialKcal ?? weights.first.flatMap {
            initialEstimate(weightKg: $0.value, profile: profile, today: today)
        }
        let firstDay = ([weighIns.first.map { CalendarDay($0.date, in: calendar) }] + [counted.keys.min()]).compactMap(\.self).min()
        var series: [NutritionEngine.ExpenditureDay] = []
        if let initial, let firstDay, firstDay <= today {
            series = NutritionEngine.Expenditure.daily(
                intake: counted.map { NutritionEngine.IntakeDay(date: date($0.key, calendar), kcal: $0.value) },
                trend: trendSeries, weighIns: weights, initial: initial,
                from: date(firstDay, calendar), through: end, calendar: calendar
            )
        }
        return StrategyInputs(
            today: today,
            trend: Dictionary(trendSeries.map { (CalendarDay($0.date, in: calendar), $0.value) }, uniquingKeysWith: { $1 }),
            expenditure: Dictionary(series.map { (CalendarDay($0.date, in: calendar), $0) }, uniquingKeysWith: { $1 }),
            intake: counted,
            statuses: log.status,
            weighInDays: Set(weighIns.map { CalendarDay($0.date, in: calendar) }),
            trendWeightKg: trendSeries.last?.value,
            expenditureKcal: settings.expenditure.staticKcal ?? series.last?.kcal ?? initial,
            isStaticExpenditure: settings.expenditure.staticKcal != nil
        )
    }

    /// BMR (MacroFactor Equation) times the activity factor; nil until the profile has a height and a birth date.
    static func initialEstimate(weightKg: Double, profile: ProfileSettings, today: CalendarDay) -> Double? {
        guard let height = profile.heightCm, let birth = profile.birthDate else { return nil }
        let age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day) ? 1 : 0)
        let bmr = NutritionEngine.BMR.macroFactor(weightKg: weightKg, heightCm: height, ageYears: age, sex: profile.sex == .female ? .female : .male)
        return NutritionEngine.InitialExpenditure.estimate(bmr: bmr, activity: assumedActivity, exercise: assumedExercise)
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
