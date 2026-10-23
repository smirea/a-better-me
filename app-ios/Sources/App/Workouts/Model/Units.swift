import Foundation

enum WeightUnit: String, CaseIterable, Identifiable {
    case kg, lb

    static let storageKey = "weightUnit"
    static let kgPerLb = 0.45359237

    var id: String { rawValue }

    func fromKg(_ kg: Double) -> Double { self == .kg ? kg : kg / Self.kgPerLb }
    func toKg(_ value: Double) -> Double { self == .kg ? value : value * Self.kgPerLb }

    /// "102.5" style: at most two decimals, no trailing zeros.
    func format(kg: Double) -> String {
        fromKg(kg).formatted(.number.precision(.fractionLength(0...2)))
    }
}

enum WorkoutSettingsKey {
    static let defaultRestSeconds = "defaultRestSeconds"
}
