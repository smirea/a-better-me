import Foundation
import GRDB

struct NutritionLogDay: Equatable, Sendable {
    var day: CalendarDay
    var consumed: NutrientAmounts
    var entryCount: Int
    var status: NutritionDay.Status
    var hasOverride: Bool
    /// What the expenditure and energy balance count.
    var intake: DayIntake

    init(day: CalendarDay, entries: [FoodEntry], row: NutritionDay?) {
        self.day = day
        consumed = (row ?? NutritionDay(id: day)).totals(entries)
        entryCount = entries.count
        status = row?.status ?? .none
        hasOverride = row?.override != nil
        intake = DayIntake(entries: entries, day: row)
    }

    /// A day with entries or entered totals counts as logged, even when marked incomplete.
    var isLogged: Bool { entryCount > 0 || hasOverride }

    /// Every day with entries or a day row, oldest first.
    static let all = DatabaseQuery([NutritionLogDay]()) { db in
        let entries = try Dictionary(grouping: FoodEntry.fetchAll(db), by: \.day)
        let rows = try Dictionary(NutritionDay.fetchAll(db).map { ($0.id, $0) }, uniquingKeysWith: { $1 })
        return Set(entries.keys).union(rows.keys).sorted().map { NutritionLogDay(day: $0, entries: entries[$0] ?? [], row: rows[$0]) }
    }
}

/// The expenditure the Dashboard shows and a Strategy check-in freezes, from the log, the weigh-ins, and the settings.
/// Both read it through here, so the two never disagree.
enum NutritionExpenditure {
    /// HealthKit wins on a day it has steps; an imported count fills a day HealthKit lacks.
    static func steps(health: [DatedValue], imported: [BodyMetric], calendar: Calendar) -> [DatedValue] {
        let healthDays = Set(health.map { calendar.startOfDay(for: $0.date) })
        let filled = imported.filter { $0.kind == .steps }
            .map { DatedValue(date: $0.day.date(in: calendar), value: $0.value) }
            .filter { !healthDays.contains($0.date) }
        return (health + filled).sorted { $0.date < $1.date }
    }

    enum ExpenditureStrategy: Equatable {
        case updating, holding, fixed
    }

    struct ExpenditureSetup: Equatable {
        var start: Date
        var initialKcal: Double
    }

    /// The days `DayIntake` counts, with what the incomplete-day screen compares.
    static func countedDays(_ log: [NutritionLogDay], calendar: Calendar) -> [NutritionEngine.CountedDay] {
        log.compactMap { day in
            day.intake.energy.map { kcal in
                NutritionEngine.CountedDay(
                    date: day.day.date(in: calendar), kcal: kcal, proteinG: day.consumed[.protein] ?? 0, entries: day.entryCount,
                    isMarked: day.hasOverride || day.status == .fasted
                )
            }
        }
    }

    /// The days that count toward expenditure: logged days at their kcal, fasted days at zero, less the days the screen
    /// finds almost certainly incomplete.
    static func intake(_ log: [NutritionLogDay], calendar: Calendar) -> [DatedValue] {
        NutritionEngine.Maintenance.screen(countedDays(log, calendar: calendar), calendar: calendar).counted
    }

    /// The maintenance Strategy plans from. Its prior is the owner's initial estimate, else the BMR one at today's
    /// weight, which needs the profile's height and birth date.
    static func maintenance(
        log: [NutritionLogDay], weighIns: [DatedValue], weightKg: Double, settings: NutritionSettings.Expenditure, profile: ProfileSettings,
        steps: [DatedValue], workouts: [DatedValue], now: Date, calendar: Calendar
    ) -> NutritionEngine.Maintenance.Estimate? {
        let prior = settings.initialKcal.map { NutritionEngine.Maintenance.Prior(kcal: $0, source: .initial) }
            ?? initialEstimate(profile: profile, settings: settings, weightKg: weightKg, on: now, calendar: calendar)
            .map { NutritionEngine.Maintenance.Prior(kcal: $0, source: .bmr) }
        return NutritionEngine.Maintenance.estimate(
            days: countedDays(log, calendar: calendar), weighIns: weighIns, weightKg: weightKg, steps: steps, workouts: workouts, prior: prior,
            from: settings.calculationStart?.date(in: calendar), today: now, calendar: calendar
        )
    }

    /// The start is the setting's, else the first counted day, else the last weigh-in. The initial estimate is the owner's,
    /// else the BMR one at the trend weight on the start day, which needs the profile's height and birth date. Nil without
    /// either: the Dashboard says what is missing instead of guessing.
    static func expenditureSetup(
        intake: [DatedValue], weighIns: [DatedValue], trend: [DatedValue], settings: NutritionSettings.Expenditure,
        profile: ProfileSettings, calendar: Calendar
    ) -> ExpenditureSetup? {
        guard let start = expenditureStart(intake: intake, weighIns: weighIns, settings: settings, calendar: calendar) else { return nil }
        if let initial = settings.initialKcal { return ExpenditureSetup(start: start, initialKcal: initial) }
        let weightKg = trend.first { calendar.isDate($0.date, inSameDayAs: start) }?.value ?? trend.first?.value
        guard let weightKg, let initial = initialEstimate(profile: profile, settings: settings, weightKg: weightKg, on: start, calendar: calendar) else { return nil }
        return ExpenditureSetup(start: start, initialKcal: initial)
    }

    /// Not the first weigh-in: the estimate cannot update before intake is logged, and Health can hold weigh-ins from
    /// years before the first log, which seeded the owner's estimate from a 2015 weight and age and held it there for eleven years.
    static func expenditureStart(intake: [DatedValue], weighIns: [DatedValue], settings: NutritionSettings.Expenditure, calendar: Calendar) -> Date? {
        let firstIntake = intake.map(\.date).min().map { calendar.startOfDay(for: $0) }
        let lastWeighIn = weighIns.map(\.date).max().map { calendar.startOfDay(for: $0) }
        return settings.calculationStart?.date(in: calendar) ?? firstIntake ?? lastWeighIn
    }

    /// An unanswered activity or exercise question reads as the cell the engine's factor table is anchored on:
    /// moderately active with 4 to 6 sessions a week. Cunningham needs fat-free mass, which the weigh-ins do not carry
    /// yet, so the MacroFactor Equation is used either way.
    static func initialEstimate(profile: ProfileSettings, settings: NutritionSettings.Expenditure, weightKg: Double, on day: Date, calendar: Calendar) -> Double? {
        guard let height = profile.heightCm, let birth = profile.birthDate,
              let age = calendar.dateComponents([.year], from: birth.date(in: calendar), to: day).year else { return nil }
        let bmr = NutritionEngine.BMR.macroFactor(weightKg: weightKg, heightCm: height, ageYears: age, sex: profile.sex == .female ? .female : .male)
        let activity: NutritionEngine.ActivityLevel = switch settings.activity {
        case .mostlySedentary: .sedentary
        case .veryActive: .veryActive
        case .moderatelyActive, nil: .moderatelyActive
        }
        let exercise: NutritionEngine.ExerciseSessions = switch settings.exercise {
        case .zero: .none
        case .oneToThree: .oneToThree
        case .sevenPlus: .sevenOrMore
        case .fourToSix, nil: .fourToSix
        }
        return NutritionEngine.InitialExpenditure.estimate(bmr: bmr, activity: activity, exercise: exercise)
    }

    /// A static expenditure replaces every day's estimate, never holds, and needs no initial estimate.
    static func expenditure(
        intake: [DatedValue], weighIns: [DatedValue], trend: [DatedValue], settings: NutritionSettings.Expenditure,
        profile: ProfileSettings, plans: [NutritionPlan], steps: [DatedValue], now: Date, calendar: Calendar
    ) -> [NutritionEngine.ExpenditureDay] {
        if let fixed = settings.staticKcal {
            guard let start = expenditureStart(intake: intake, weighIns: weighIns, settings: settings, calendar: calendar), start <= now else { return [] }
            return NutritionEngine.eachDay(from: start, through: now, calendar: calendar).map { .init(date: $0, kcal: fixed, isHolding: false) }
        }
        guard let setup = expenditureSetup(intake: intake, weighIns: weighIns, trend: trend, settings: settings, profile: profile, calendar: calendar),
              setup.start <= now else { return [] }
        return NutritionEngine.Expenditure.daily(
            intake: intake.map { NutritionEngine.IntakeDay(date: $0.date, kcal: $0.value) }, trend: trend, weighIns: weighIns, initial: setup.initialKcal, from: setup.start, through: now, calendar: calendar,
            modifiers: modifiers(settings: settings, plans: plans, steps: steps, calendar: calendar)
        )
    }

    static func modifiers(settings: NutritionSettings.Expenditure, plans: [NutritionPlan], steps: [DatedValue], calendar: Calendar) -> NutritionEngine.Expenditure.Modifiers {
        NutritionEngine.Expenditure.Modifiers(
            steps: settings.stepInformedUpdates ? steps : [],
            goalRates: settings.predictiveGoalAdjustment ? plans.map { DatedValue(date: $0.id.date(in: calendar), value: $0.goal.ratePercentPerWeek) } : []
        )
    }

    static func strategy(_ days: [NutritionEngine.ExpenditureDay], settings: NutritionSettings.Expenditure) -> ExpenditureStrategy? {
        guard let last = days.last else { return nil }
        if settings.staticKcal != nil { return .fixed }
        return last.isHolding ? .holding : .updating
    }
}
