import Foundation

/// The food detail's unit chips: the favorite weight and volume units the food can be measured in, each followed by its
/// neighbour (g brings kg, oz brings lb, as `servingMeasures` pairs them), then the food's own servings, MacroFactor's two
/// groups on either side of a divider.
struct ServingChoices: Hashable, Sendable {
    let units: [Measure]
    let servings: [Measure]

    init(_ nutrition: FoodNutrition, favorites: [String], current: Measure? = nil) {
        let all = Dictionary(nutrition.allMeasures.map { ($0.name, $0) }, uniquingKeysWith: { first, _ in first })
        var units: [Measure] = []
        for favorite in favorites where all[favorite] != nil {
            for name in [favorite] + (NamedUnit(favorite)?.neighbours.map(\.name) ?? []) {
                if let measure = all[name], !units.contains(measure) { units.append(measure) }
            }
        }
        let servings = nutrition.servingMeasures.filter { measure in !units.contains { $0.name == measure.name } }
        if let current, !units.contains(current), !servings.contains(current) {
            units.append(current)
        }
        self.units = units
        self.servings = servings
    }

    /// "large – 8" to 8 7/8" long • 136 g": the unit and, unless it is a weight, its weight.
    static func detail(_ serving: Serving, _ nutrition: FoodNutrition) -> String {
        guard SizeUnit(rawValue: serving.measure.name)?.isVolume != false, let grams = nutrition.grams(serving) else { return serving.measure.name }
        return "\(serving.measure.name) • \(NutritionFormat.amount(grams)) g"
    }
}
