import Observation

/// What the Dashboard's nutrition values read besides the workout history and Health: the food log, the plans, the
/// nutrient goals, the settings they use, and the manual body metrics (imported steps among them). `DashboardTab` feeds
/// it from its observations, and values derived from it key on `revision`, as Health values key on
/// `HealthData.revision`.
@MainActor @Observable
final class NutritionData {
    struct Inputs: Equatable {
        var log: [NutritionLogDay] = []
        var plans: [NutritionPlan] = []
        var goals: [NutrientGoal] = []
        var settings = NutritionSettings()
        var profile = ProfileSettings()
        var bodyMetrics: [BodyMetric] = []
    }

    private(set) var inputs = Inputs()
    /// Bumps whenever any input changes.
    private(set) var revision = 0

    var log: [NutritionLogDay] { inputs.log }
    var plans: [NutritionPlan] { inputs.plans }
    var goals: [NutrientGoal] { inputs.goals }
    var settings: NutritionSettings { inputs.settings }
    var profile: ProfileSettings { inputs.profile }
    var bodyMetrics: [BodyMetric] { inputs.bodyMetrics }
    var importedSteps: [BodyMetric] { inputs.bodyMetrics.filter { $0.kind == .steps } }

    func update(_ inputs: Inputs) {
        guard inputs != self.inputs else { return }
        self.inputs = inputs
        revision += 1
    }
}
