import Foundation

enum WeightUnit: String, CaseIterable, Identifiable, Codable {
    case kg, lb

    static let kgPerLb = 0.45359237

    var id: String { rawValue }

    func fromKg(_ kg: Double) -> Double { self == .kg ? kg : kg / Self.kgPerLb }
    func toKg(_ value: Double) -> Double { self == .kg ? value : value * Self.kgPerLb }

    /// The unit a stored weight reads as a whole quarter in: 45 lb is 20.41 kg, 1.25 kg is 2.76 lb. `nil` when it is
    /// tidy in neither.
    static func native(toKg kg: Double) -> WeightUnit? {
        allCases.first { unit in
            let quarters = unit.fromKg(kg) * 4
            return abs(quarters - quarters.rounded()) < 0.001
        }
    }

    /// "102.5" style: at most two decimals, no trailing zeros.
    func format(kg: Double) -> String {
        fromKg(kg).formatted(.number.precision(.fractionLength(0...2)))
    }

    /// "102.5 lb", kept on one line.
    func label(kg: Double) -> String { "\(format(kg: kg))\u{00A0}\(rawValue)" }
}
