import Foundation

enum WeightUnit: String, CaseIterable, Identifiable {
    case kg, lb

    static let kgPerLb = 0.45359237

    var id: String { rawValue }

    func fromKg(_ kg: Double) -> Double { self == .kg ? kg : kg / Self.kgPerLb }
    func toKg(_ value: Double) -> Double { self == .kg ? value : value * Self.kgPerLb }

    /// "102.5" style: at most two decimals, no trailing zeros.
    func format(kg: Double) -> String {
        fromKg(kg).formatted(.number.precision(.fractionLength(0...2)))
    }
}

/// MF's rest-timer groups, each with its own default in Workout settings (`AppSettings`). `CodingKeyRepresentable`
/// makes a dictionary keyed by it encode as a JSON object instead of a flat key-value array.
enum RestCategory: String, CaseIterable, Identifiable, Codable, CodingKeyRepresentable {
    case compoundUpper, compoundLower, upperIsolation, lowerIsolation, core

    var id: String { rawValue }

    var defaultSeconds: Int {
        switch self {
        case .compoundUpper: 120
        case .compoundLower: 180
        case .upperIsolation, .lowerIsolation: 90
        case .core: 60
        }
    }

    var displayName: String {
        switch self {
        case .compoundUpper: "Compound Upper"
        case .compoundLower: "Compound Lower"
        case .upperIsolation: "Upper Isolation"
        case .lowerIsolation: "Lower Isolation"
        case .core: "Core"
        }
    }
}
