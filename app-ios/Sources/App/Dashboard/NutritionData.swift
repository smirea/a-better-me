import Observation

/// What the Dashboard's nutrition values read besides the workout history and Health: the food log, the plans, the
/// nutrient goals, the settings they use, and the body measurements. `DashboardTab` feeds
/// it from its observations, and values derived from it key on `revision`, as Health values key on
/// `HealthData.revision`.
@MainActor @Observable
final class NutritionData {
    /// Only what the derived values compute from. A presentation setting such as the Food Log's timeline lives in
    /// `settings` alone, so toggling it never recomputes the expenditure.
    struct Inputs: Equatable {
        var log: [NutritionLogDay] = []
        var plans: [NutritionPlan] = []
        var goals: [NutrientGoal] = []
        var expenditure = NutritionSettings.Expenditure()
        var heightUnit = NutritionSettings.HeightUnit.feetAndInches
        var profile = ProfileSettings()
        var bodyMetrics: [BodyMetric] = []
    }

    private(set) var inputs = Inputs()
    var settings = NutritionSettings()
    /// Bumps whenever any input changes.
    private(set) var revision = 0

    var log: [NutritionLogDay] { inputs.log }
    var plans: [NutritionPlan] { inputs.plans }
    var goals: [NutrientGoal] { inputs.goals }
    var profile: ProfileSettings { inputs.profile }
    var bodyMetrics: [BodyMetric] { inputs.bodyMetrics }

    func update(_ inputs: Inputs) {
        guard inputs != self.inputs else { return }
        self.inputs = inputs
        revision += 1
    }
}
