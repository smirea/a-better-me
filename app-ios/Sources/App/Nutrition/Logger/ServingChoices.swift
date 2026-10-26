import Foundation

/// The food detail's unit chips: the favorite weight and volume units the food can be measured in, then the food's own
/// servings, MacroFactor's two groups on either side of a divider.
struct ServingChoices: Hashable, Sendable {
    let units: [Measure]
    let servings: [Measure]

    private static let unitNames: Set = ["g", "oz", "lb", "mL", "fl oz", "cup"]

    init(_ nutrition: FoodNutrition, favorites: [String], current: Measure? = nil) {
        let all = nutrition.allMeasures
        var units = favorites.compactMap { name in all.first { $0.name == name } }
        let servings = nutrition.measures.filter { measure in !units.contains { $0.name == measure.name } }
        if let current, !units.contains(current), !servings.contains(current) {
            units.append(current)
        }
        self.units = units
        self.servings = servings
    }

    var all: [Measure] { units + servings }

    /// The same amount in `measure`: whole grams and milliliters, two decimals for anything else.
    static func convert(_ serving: Serving, to measure: Measure) -> Serving {
        let quantity = serving.servings * measure.quantity / measure.servings
        let places = measure.name == "g" || measure.name == "mL" ? 1.0 : 100
        return Serving(measure: measure, quantity: (quantity * places).rounded() / places)
    }

    /// The serving's weight, when the food knows its grams.
    static func grams(_ serving: Serving, _ nutrition: FoodNutrition) -> Double? {
        nutrition.baseGrams.map { $0 * serving.servings }
    }

    /// "large – 8" to 8 7/8" long • 136 g": the unit and, for a named serving, its weight.
    static func detail(_ serving: Serving, _ nutrition: FoodNutrition) -> String {
        guard !unitNames.contains(serving.measure.name), let grams = grams(serving, nutrition) else { return serving.measure.name }
        return "\(serving.measure.name) • \(QuantityText.format(grams.rounded())) g"
    }
}

extension Serving {
    /// "1 medium", "100 g", "1.5 cup".
    var label: String { "\(QuantityText.format(quantity)) \(measure.name)" }
}
