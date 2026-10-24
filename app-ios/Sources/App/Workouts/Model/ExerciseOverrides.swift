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

/// MF's Offset Weight: "Adds the ability to optionally offset the total weight targeted by the weight calculator".
enum PlateOffset: Codable, Hashable {
    case kilograms(Double)
    /// "% target weight", signed.
    case percent(Double)

    /// The weight the calculator loads for a typed `target`, in hundredths of the display unit, the calculator's grain.
    func applied(to target: Double, unit: WeightUnit) -> Double {
        let offset = switch self {
        case let .kilograms(kg): target + unit.fromKg(kg)
        case let .percent(percent): target * (1 + percent / 100)
        }
        return (offset * 100).rounded() / 100
    }

    /// "+10% offset", "-2.5 kg offset".
    func label(unit: WeightUnit) -> String {
        switch self {
        case let .kilograms(kg): "\(Self.signed(unit.fromKg(kg))) \(unit.rawValue) offset"
        case let .percent(percent): "\(Self.signed(percent))% offset"
        }
    }

    private static func signed(_ value: Double) -> String {
        (value < 0 ? "-" : "+") + abs(value).formatted(.number.precision(.fractionLength(0...2)))
    }
}
