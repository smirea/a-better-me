import Foundation

/// The library's text for amounts, macro lines, and servings.
enum LibraryFormat {
    /// Up to one decimal under 100 and whole numbers above, as MacroFactor prints amounts: 0.5, 15.6, 120.
    static func amount(_ value: Double) -> String {
        let digits = abs(value) < 100 ? 0...1 : 0...0
        return value.formatted(.number.precision(.fractionLength(digits)))
    }

    /// Quantities keep two decimals, so a scaled "0.33 cup" survives.
    static func quantity(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0...2)))
    }

    /// "120 kcal · 1P 0F 31C".
    static func macros(_ amounts: NutrientAmounts) -> String {
        let grams = { (id: NutrientID) in (amounts[id] ?? 0).formatted(.number.precision(.fractionLength(0))) }
        return "\(grams(.energy)) kcal · \(grams(.protein))P \(grams(.fat))F \(grams(.carbs))C"
    }

    /// "1 large (136 g)", "100 g", or "2 portion" for a food without a weight.
    static func serving(_ serving: Serving, of food: FoodSnapshot) -> String {
        let text = "\(quantity(serving.quantity)) \(serving.measure.name)"
        guard !SizeUnit.allCases.contains(where: { $0.rawValue == serving.measure.name }),
              let grams = RecipeMath.grams(serving, of: food) else { return text }
        return "\(text) (\(amount(grams)) g)"
    }

    static func value(_ value: Double, of nutrient: Nutrient) -> String {
        "\(amount(value)) \(nutrient.unit.rawValue)"
    }
}

/// The nutrient sections the food editor and breakdowns show, in MacroFactor's Food Detail order.
enum NutrientSection: String, CaseIterable, Identifiable {
    case macros = "Calories & Macros"
    case carbs = "Carb Breakdown"
    case fats = "Fat Breakdown"
    case protein = "Protein Breakdown"
    case vitamins = "Vitamins"
    case minerals = "Minerals"
    case other = "Other"

    var id: Self { self }

    static let macroIDs: [NutrientID] = [.energy, .protein, .fat, .carbs]

    var nutrients: [Nutrient] {
        let registry = NutrientRegistry.all
        let group: NutrientGroup? = switch self {
        case .macros: nil
        case .carbs: .carbohydrates
        case .fats: .fats
        case .protein: .protein
        case .vitamins: .vitamins
        case .minerals: .minerals
        case .other: .general
        }
        guard let group else { return Self.macroIDs.compactMap(NutrientRegistry.nutrient) }
        return registry.filter { $0.group == group && !Self.macroIDs.contains($0.id) }
    }
}
