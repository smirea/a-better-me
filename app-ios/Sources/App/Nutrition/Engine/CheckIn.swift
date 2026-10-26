import Foundation

extension NutritionEngine {
    /// The weekly check-in of a coached program: the budget the goal asks for at the latest expenditure and trend
    /// weight, smoothed against last week's so a 500 kcal expenditure swing moves targets about 200-300 kcal over
    /// three weeks, as MacroFactor's help describes. The smoothing factor is inferred: 0.5 per week gives 250 after
    /// two steps and 310 after three. Maintenance holds within 0.7 kg of the target and nudges at 0.15% per week
    /// outside it (help, "dynamic maintenance"). Nothing here was observed in the app: the owner's program is manual.
    enum CheckIn {
        static let budgetSmoothing = 0.5
        static let maintenanceBandKg = 0.7
        static let maintenanceNudgePercent = 0.15

        static func plan(
            program: CoachedProgram, goal: Goal, expenditure: Double, trendWeightKg: Double, previousAverageKcal: Double?
        ) -> WeeklyPlan {
            let asked = Targets.dailyBudget(expenditure: expenditure, goal: effectiveGoal(goal, trendWeightKg: trendWeightKg), weightKg: trendWeightKg)
            let smoothed = previousAverageKcal.map { $0 + budgetSmoothing * (asked - $0) } ?? asked
            let fixedGoal = Goal(kind: smoothed < expenditure ? .lose : .gain, ratePercentPerWeek: abs(expenditure - smoothed) * 7 / Targets.kcalPerLbPerWeek * kgPerLb / trendWeightKg * 100)
            return Targets.weekly(program: program, goal: fixedGoal, expenditure: expenditure, weightKg: trendWeightKg)
        }

        /// Maintenance becomes a slow loss or gain once the trend leaves the band around the target.
        static func effectiveGoal(_ goal: Goal, trendWeightKg: Double) -> Goal {
            guard goal.kind == .maintain, let target = goal.targetWeightKg, abs(trendWeightKg - target) > maintenanceBandKg else { return goal }
            return Goal(kind: trendWeightKg > target ? .lose : .gain, ratePercentPerWeek: maintenanceNudgePercent, targetWeightKg: target)
        }
    }
}
