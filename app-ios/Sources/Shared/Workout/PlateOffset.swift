import Foundation

/// MF's Offset Weight: "Adds the ability to optionally offset the total weight targeted by the weight calculator".
enum PlateOffset: Codable, Hashable, Sendable {
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
