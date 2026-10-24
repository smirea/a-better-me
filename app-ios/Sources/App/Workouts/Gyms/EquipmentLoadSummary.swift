import Foundation

extension EquipmentLoad {
    /// "2.5 lb, 5 lb", "0 - 500 lb, 10 lb increments", "118 lb", or "Orange, Red, Blue".
    func summary(in unit: WeightUnit) -> String {
        switch self {
        case .weights(let options):
            options.map { unit.label(kg: $0.kg) + Self.quantity($0.count) }.joined(separator: ", ")
        case .ranges(let options):
            options.map { "\(unit.format(kg: $0.minKg)) - \(unit.label(kg: $0.maxKg)), \(unit.label(kg: $0.incrementKg)) increments" }
                .joined(separator: "; ")
        case .base(let kg):
            unit.label(kg: kg)
        case .bands(let options):
            options.map { $0.color + Self.quantity($0.count) }.joined(separator: ", ")
        }
    }

    var editTitle: String {
        switch self {
        case .weights: "Edit Weights"
        case .ranges: "Edit Machine"
        case .base: "Edit Base Weight"
        case .bands: "Edit Inventory"
        }
    }

    private static func quantity(_ count: Int?) -> String { count.map { " ×\($0)" } ?? "" }
}

extension WeightUnit {
    /// "102.5 lb".
    func label(kg: Double) -> String { "\(format(kg: kg)) \(rawValue)" }
}
