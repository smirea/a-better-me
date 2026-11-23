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

    /// "102.5" / "1.25" style: up to two decimals under 10 (keeping fractional plates like 1.25 kg exact), and at most
    /// one decimal from 10 up so converted weights never show hundredths noise (187.4 lb, not 187.39 lb).
    func format(kg: Double) -> String {
        let value = fromKg(kg)
        let decimals = abs(value) < 10 ? 2 : 1
        return value.formatted(.number.precision(.fractionLength(0...decimals)))
    }

    /// The step a weight moves by when no loading says which weights exist: the smallest common plate pair. The watch's
    /// crown steps by half of it, since a crown has no keypad to type a weight in between.
    var plateIncrement: Double { self == .kg ? 2.5 : 5 }

    /// "102.5 lb", kept on one line.
    func label(kg: Double) -> String { "\(format(kg: kg))\u{00A0}\(rawValue)" }
}
