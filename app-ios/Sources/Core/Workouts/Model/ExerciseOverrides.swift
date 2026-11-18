import Foundation

/// Exercise Settings > Exercise Overrides, encoded whole into `exercise_settings.overrides`. Every field is "Default"
/// when nil, so Reset Defaults is `ExerciseOverrides()` and the column is `{}`. The Rest Timer override is
/// `ExerciseSettings.restSeconds`.
struct ExerciseOverrides: Codable, Hashable {
    /// Replaces the gym profile's weights for this exercise, per equipment id. Availability still comes from the gym.
    var equipment: [EquipmentID: EquipmentLoad]?
    /// The bar weight the plate calculator loads on, per bar (MF's `barWeightById`). A bar without one, or whose
    /// choice it no longer lists, loads its heaviest.
    var barWeightKg: [EquipmentID: Double]?
    /// What the plate calculator targets instead of the typed weight, where the gym turns Offset Weight on.
    var plateOffset: PlateOffset?
    var restBetweenSides: Bool?
    var expandRepRange: Bool?
    var weightMatch: Bool?
    var warmUpAutomation: WarmUpAutomation?
    var warmUpScheme: [WarmUpStep]?
}
