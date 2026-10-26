import Foundation

/// The Nutrition half's settings, encoded whole into `settings.nutrition` and read over these defaults, so a new
/// setting needs no migration. The one Settings screen edits them beside the Workouts settings.
struct NutritionSettings: Codable, Hashable, Sendable {
    enum EnergyUnit: String, Codable, Sendable { case kcal, kj }

    struct Timeline: Codable, Hashable, Sendable {
        var hideEmptyHours = false
        var hourlyTotals = true
    }

    struct Expenditure: Codable, Hashable, Sendable {
        /// A fixed daily expenditure in kcal instead of the computed one.
        var staticKcal: Double?
        /// The owner's own starting estimate in place of the BMR one.
        var initialKcal: Double?
    }

    /// Display only: every stored energy is kcal.
    var energyUnit = EnergyUnit.kcal
    /// ISO weekday, Monday 1.
    var checkInWeekday = 1
    /// Shown first, in this order, on the Dashboard and in food details.
    var pinnedNutrients: [NutrientID] = [.energy, .protein, .fat, .carbs]
    var hideAdditionalNutrients = false
    var searchBranded = true
    var searchOpenFoodFacts = true
    /// Measure names pinned to the front of the serving picker.
    var favoriteMeasures: [String] = []
    var timeline = Timeline()
    var expenditure = Expenditure()
}
