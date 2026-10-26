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

    /// The initial estimate's activity while the Expenditure settings leave it "Not set": moderately active with one to
    /// three sessions a week.
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
            initialEstimate(weightKg: $0.value, profile: profile, expenditure: settings.expenditure, today: today)
        }
        let firstDay = settings.expenditure.calculationStart
            ?? ([weighIns.first.map { CalendarDay($0.date, in: calendar) }] + [counted.keys.min()]).compactMap(\.self).min()
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

    /// BMR times the activity factor; nil until the profile has a height and a birth date. Always the MacroFactor
    /// Equation's height and weight form: Cunningham needs a fat-free mass the profile does not hold.
    static func initialEstimate(
        weightKg: Double, profile: ProfileSettings, expenditure: NutritionSettings.Expenditure = .init(), today: CalendarDay
    ) -> Double? {
        guard let height = profile.heightCm, let birth = profile.birthDate else { return nil }
        let age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day) ? 1 : 0)
        let bmr = NutritionEngine.BMR.macroFactor(weightKg: weightKg, heightCm: height, ageYears: age, sex: profile.sex == .female ? .female : .male)
        let activity: NutritionEngine.ActivityLevel = switch expenditure.activity {
        case .mostlySedentary: .sedentary
        case .moderatelyActive: .moderatelyActive
        case .veryActive: .veryActive
        case nil: assumedActivity
        }
        let exercise: NutritionEngine.ExerciseSessions = switch expenditure.exercise {
        case .zero: .none
        case .oneToThree: .oneToThree
        case .fourToSix: .fourToSix
        case .sevenPlus: .sevenOrMore
        case nil: assumedExercise
        }
        return NutritionEngine.InitialExpenditure.estimate(bmr: bmr, activity: activity, exercise: exercise)
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
