import Foundation

/// The food detail's unit chips: the favorite weight and volume units the food can be measured in, then the food's own
/// servings, MacroFactor's two groups on either side of a divider.
struct ServingChoices: Hashable, Sendable {
    let units: [Measure]
    let servings: [Measure]

    init(_ nutrition: FoodNutrition, favorites: [String], current: Measure? = nil) {
        let all = nutrition.allMeasures
        var units = favorites.compactMap { name in all.first { $0.name == name } }
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
