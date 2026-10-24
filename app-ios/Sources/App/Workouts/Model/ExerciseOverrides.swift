import Foundation

/// Exercise Settings > Exercise Overrides, encoded whole into `exercise_settings.overrides`. Every field is "Default"
/// when nil, so Reset Defaults is `ExerciseOverrides()` and the column is `{}`. The Rest Timer override is
/// `ExerciseSettings.restSeconds`.
struct ExerciseOverrides: Codable, Hashable {
    /// Replaces the gym profile's weights for this exercise, per equipment id. Availability still comes from the gym.
    var equipment: [EquipmentID: EquipmentLoad]?
    var restBetweenSides: Bool?
    var expandRepRange: Bool?
    var weightMatch: Bool?
    var warmUpAutomation: WarmUpAutomation?
    var warmUpScheme: [WarmUpStep]?
}
