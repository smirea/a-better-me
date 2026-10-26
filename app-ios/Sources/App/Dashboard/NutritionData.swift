import Observation

/// What the Dashboard's nutrition values read besides the workout history and Health: the food log, the plans, the
/// settings they use, and the imported steps. `DashboardTab` feeds it from its observations, and values derived from
/// it key on `revision`, as Health values key on `HealthData.revision`.
@MainActor @Observable
final class NutritionData {
    private(set) var log: [NutritionLogDay] = []
    private(set) var plans: [NutritionPlan] = []
    private(set) var settings = NutritionSettings()
    private(set) var profile = ProfileSettings()
    private(set) var importedSteps: [BodyMetric] = []
    /// Bumps whenever any input changes.
    private(set) var revision = 0

    func update(log: [NutritionLogDay], plans: [NutritionPlan], settings: NutritionSettings, profile: ProfileSettings, importedSteps: [BodyMetric]) {
        guard log != self.log || plans != self.plans || settings != self.settings || profile != self.profile || importedSteps != self.importedSteps else { return }
        self.log = log
        self.plans = plans
        self.settings = settings
        self.profile = profile
        self.importedSteps = importedSteps
        revision += 1
    }
}
