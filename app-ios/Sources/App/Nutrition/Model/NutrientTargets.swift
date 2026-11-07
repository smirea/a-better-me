import Foundation

/// The ranges a day's rows draw: calories and macros from the plan, every other nutrient from its goal. Net carbs
/// without a goal of their own get the carbs target less fiber's, the net carbs left once fiber is eaten.
struct NutrientTargets {
    let target: DayTarget?
    let goals: [NutrientGoal]
    let day: CalendarDay
    let sex: BodySex
    let weightKg: Double?

    /// Every screen's targets for `day`. Only the per-kilogram amino acids read a weight: the latest weigh-in, else the
    /// profile's weight.
    static func of(
        _ day: CalendarDay, plans: [NutritionPlan], goals: [NutrientGoal], profile: ProfileSettings, latestWeightKg: Double?
    ) -> NutrientTargets {
        NutrientTargets(
            target: NutritionPlan.effective(on: day, in: plans)?.target(on: day), goals: goals, day: day,
            sex: profile.sex, weightKg: latestWeightKg ?? profile.bodyWeightKg
        )
    }

    func range(_ id: NutrientID) -> NutrientRange {
        switch id {
        case .energy: NutrientRange(target: target?.energy)
        case .protein: NutrientRange(target: target?.protein)
        case .fat: NutrientRange(target: target?.fat)
        case .carbs: NutrientRange(target: target?.carbs)
        case .netCarbs where NutrientGoal.mode(id, on: day, goals: goals) ?? .auto == .auto:
            NutrientRange(target: target.map { max(0, $0.carbs - (range(.fiber).goal ?? 0)) })
        default: NutrientGoal.range(id, on: day, goals: goals, sex: sex, weightKg: weightKg)
        }
    }

    /// What each of `ids` fills its bar against, leaving out those with no bounds.
    func goals(_ ids: [NutrientID]) -> NutrientAmounts {
        Dictionary(uniqueKeysWithValues: ids.compactMap { id in range(id).goal.map { (id, $0) } })
    }
}
