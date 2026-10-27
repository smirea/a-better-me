#if DEBUG
import Foundation
import GRDB

/// Launch with `-seedStrategy` to give an empty nutrition store ten weeks of weigh-ins and quick-add intake, a profile
/// height and birth date, a manual maintenance plan from ten weeks ago, and a coached loss plan from two weeks ago, so
/// the expenditure has data, Goal History has two goals, and a check-in is due. It does nothing once a plan exists.
enum StrategySeed {
    static let launchArgument = "-seedStrategy"

    @MainActor
    static func seedIfRequested(_ store: LocalStore) {
        guard ProcessInfo.processInfo.arguments.contains(launchArgument) else { return }
        let today = CalendarDay.today
        store.updateSettings { settings in
            if settings.profile.heightCm == nil { settings.profile.heightCm = 180 }
            if settings.profile.birthDate == nil { settings.profile.birthDate = CalendarDay("1990-05-01") }
        }
        store.write { db in
            guard try NutritionPlan.fetchCount(db) == 0 else { return }
            let calendar = Calendar.current
            for offset in (1...70).reversed() {
                let day = today.adding(days: -offset)
                let date = day.date(in: calendar)
                if offset % 9 != 0 {
                    let kg = 92 - 0.04 * Double(70 - offset) + 0.4 * sin(Double(offset))
                    try BodyWeight(weightKg: (kg * 10).rounded() / 10, measuredAt: date.addingTimeInterval(7 * 3600)).insert(db)
                }
                if offset % 11 != 0 {
                    let kcal = 2150 + 150 * cos(Double(offset) * 1.7)
                    let amounts: NutrientAmounts = [.energy: kcal.rounded(), .protein: 160, .fat: 70, .carbs: ((kcal - 640 - 630) / 4).rounded()]
                    try FoodEntry(FoodPortion(.quickAdd(amounts)), day: day, minute: 12 * 60).insert(db)
                }
            }
            let first = today.adding(days: -70)
            try NutritionPlan(
                from: first, kind: .setup, goal: NutritionGoal(kind: .maintain, targetWeightKg: 92, ratePercentPerWeek: 0, startedOn: first),
                coaching: CoachingProgram(style: .manual), targets: WeekTargets(every: DayTarget(energy: 2300, protein: 160, fat: 75, carbs: 240))
            ).insert(db)
            let start = today.adding(days: -15)
            let goal = NutritionGoal(kind: .lose, targetWeightKg: 85, ratePercentPerWeek: -0.5, startedOn: start)
            let coaching = CoachingProgram(highDays: [6])
            let basis = StrategyBasis(weightKg: 90.4, expenditureKcal: 2650, standardFloorKcal: 1200)
            try NutritionPlan(
                from: start, kind: .edit, goal: goal, coaching: coaching,
                targets: StrategyRules.weekTargets(StrategyRules.coachedWeek(coaching, goal: goal, basis: basis))
            ).insert(db)
        }
    }
}
#endif
