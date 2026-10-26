import Foundation

/// A unit the serving weight or a measure's size is typed in. Weights set the food's grams, volumes its milliliters.
enum SizeUnit: String, CaseIterable, Identifiable, Sendable {
    case g, oz, lb, mL, flOz = "fl oz", cup

    var id: Self { self }

    var isVolume: Bool { self == .mL || self == .flOz || self == .cup }

    /// Grams or milliliters in one of the unit.
    var size: Double {
        switch self {
        case .g, .mL: 1
        case .oz: 28.349523125
        case .lb: 453.59237
        case .flOz: 29.5735295625
        case .cup: 236.5882365
        }
    }
}

/// What the food's nutrition is entered for, MacroFactor's Serving | 100 g | 100 ml. All three become a base serving
/// with its size, so the log scales them the same way.
enum NutritionBasis: String, CaseIterable, Identifiable, Sendable {
    case serving = "Serving", hundredGrams = "100 g", hundredMilliliters = "100 ml"

    var id: Self { self }
}

/// Parses a typed number, accepting a comma decimal separator. Empty text is nil, as is anything that is not a
/// number; `isNumber` tells the two apart.
enum NumberText {
    static func parse(_ text: String) -> Double? {
        let trimmed = text.trimmingCharacters(in: .whitespaces).replacing(",", with: ".")
        return trimmed.isEmpty ? nil : Double(trimmed)
    }

    static func isBlankOrNumber(_ text: String) -> Bool {
        text.trimmingCharacters(in: .whitespaces).isEmpty || parse(text) != nil
    }

    static func text(_ value: Double?) -> String {
        value.map { $0.formatted(.number.precision(.fractionLength(0...3)).grouping(.never).locale(Locale(identifier: "en_US_POSIX"))) } ?? ""
    }
}

/// The custom food editor's fields as typed, so the form binds text and validation and conversion stay testable.
struct FoodDraft: Equatable, Sendable {
    /// A named measure beyond the base serving: `quantity` `name` is `size`, in the food's size unit or, for a food
    /// with no weight or volume, in base servings.
    struct MeasureDraft: Equatable, Identifiable, Sendable {
        var id = UUID()
        var quantity = "1"
        var name = ""
        var size = ""
    }

    enum Field: Hashable, Sendable {
        case name, servingWeight, servingQuantity, servingName
        case measureQuantity(UUID), measureName(UUID), measureSize(UUID)
        case nutrient(NutrientID)
    }

    /// A draft that passed validation, in the model's terms.
    struct Valid: Equatable, Sendable {
        var name: String
        var brand: String?
        var barcode: String?
        var icon: String?
        var nutrition: FoodNutrition
    }

    var icon: String?
    var name = ""
    var brand = ""
    var barcode = ""
    var basis = NutritionBasis.serving
    var servingWeight = ""
    var servingWeightUnit = SizeUnit.g
    var servingQuantity = "1"
    var servingName = "portion"
    var measures: [MeasureDraft] = []
    /// Energy is typed in this unit and stored in kcal.
    var energyUnit = NutritionSettings.EnergyUnit.kcal
    var nutrients: [NutrientID: String] = [:]

    static let kilojoulesPerKilocalorie = 4.184

    init() {}

    /// Reads a saved food back into its fields. A base serving of exactly 100 g or 100 mL named for its unit is the
    /// 100 g or 100 ml basis. Anything else is the default measure as the serving, with the nutrients rescaled to it
    /// when the food's base serving differs (an imported food may default to 1 container of 1.5 base servings).
    init(_ food: Food) {
        icon = food.icon
        name = food.name
        brand = food.brand ?? ""
        barcode = food.barcode ?? ""
        let nutrition = food.nutrition
        let base = nutrition.measures.first ?? Measure(name: "serving", quantity: 1, servings: 1)
        var factor = 1.0
        if base.name == "g", base.quantity == 100, base.servings == 1, nutrition.baseGrams == 100 {
            basis = .hundredGrams
        } else if base.name == "mL", base.quantity == 100, base.servings == 1, nutrition.baseMilliliters == 100 {
            basis = .hundredMilliliters
        } else {
            basis = .serving
            factor = base.servings
            servingQuantity = NumberText.text(base.quantity)
            servingName = base.name
            if let grams = nutrition.baseGrams {
                servingWeight = NumberText.text(grams * factor)
            } else if let milliliters = nutrition.baseMilliliters {
                servingWeight = NumberText.text(milliliters * factor)
                servingWeightUnit = .mL
            }
        }
        let sizePerServing = nutrition.baseGrams ?? nutrition.baseMilliliters
        measures = nutrition.measures.dropFirst().map { measure in
            let size = sizePerServing.map { measure.servings * $0 } ?? measure.servings / factor
            return MeasureDraft(quantity: NumberText.text(measure.quantity), name: measure.name, size: NumberText.text(size))
        }
        nutrients = nutrition.nutrients.mapValues { NumberText.text($0 * factor) }
    }

    /// A copy for Duplicate: the same fields under a new name.
    func duplicate() -> FoodDraft {
        var copy = self
        copy.name = "\(name) (Copy)"
        copy.measures = measures.map { MeasureDraft(quantity: $0.quantity, name: $0.name, size: $0.size) }
        return copy
    }

    /// The base serving's grams and milliliters as the fields stand.
    var baseSize: (grams: Double?, milliliters: Double?) {
        switch basis {
        case .hundredGrams: return (100, nil)
        case .hundredMilliliters: return (nil, 100)
        case .serving:
            guard let weight = NumberText.parse(servingWeight), weight > 0 else { return (nil, nil) }
            let size = weight * servingWeightUnit.size
            return servingWeightUnit.isVolume ? (nil, size) : (size, nil)
        }
    }

    /// What a measure's size is typed in: grams, milliliters, or base servings when the food has neither.
    var measureSizeUnit: String {
        let size = baseSize
        if size.grams != nil { return "g" }
        if size.milliliters != nil { return "mL" }
        return "servings"
    }

    /// The serving the nutrients describe, as the editor's header shows it: "1 portion (50 g)", "100 g".
    var basisLabel: String {
        switch basis {
        case .hundredGrams: return "100 g"
        case .hundredMilliliters: return "100 ml"
        case .serving:
            let serving = "\(servingQuantity.trimmingCharacters(in: .whitespaces)) \(servingName.trimmingCharacters(in: .whitespaces))"
            guard let weight = NumberText.parse(servingWeight), weight > 0 else { return serving }
            return "\(serving) (\(NumberText.text(weight)) \(servingWeightUnit.rawValue))"
        }
    }

    var issues: [Field: String] { validate().issues }
    var valid: Valid? { validate().valid }

    private func validate() -> (valid: Valid?, issues: [Field: String]) {
        var issues: [Field: String] = [:]
        let name = self.name.trimmingCharacters(in: .whitespaces)
        if name.isEmpty { issues[.name] = "Food name is required" }

        let size = baseSize
        var base = Measure(name: "g", quantity: 100, servings: 1)
        switch basis {
        case .hundredGrams: break
        case .hundredMilliliters: base.name = "mL"
        case .serving:
            if !servingWeight.trimmingCharacters(in: .whitespaces).isEmpty, (NumberText.parse(servingWeight) ?? 0) <= 0 {
                issues[.servingWeight] = "Must be greater than 0"
            }
            let quantity = NumberText.parse(servingQuantity)
            if servingQuantity.trimmingCharacters(in: .whitespaces).isEmpty {
                issues[.servingQuantity] = "Serving quantity is required"
            } else if (quantity ?? 0) <= 0 {
                issues[.servingQuantity] = "Serving quantity cannot be zero"
            }
            let servingName = self.servingName.trimmingCharacters(in: .whitespaces)
            if servingName.isEmpty { issues[.servingName] = "Serving name is required" }
            base = Measure(name: servingName, quantity: quantity ?? 1, servings: 1)
        }

        let sizePerServing = size.grams ?? size.milliliters ?? 1
        var all = [base]
        for measure in measures {
            let quantity = NumberText.parse(measure.quantity) ?? 0
            let amount = NumberText.parse(measure.size) ?? 0
            let name = measure.name.trimmingCharacters(in: .whitespaces)
            if quantity <= 0 { issues[.measureQuantity(measure.id)] = "Must be greater than 0" }
            if name.isEmpty { issues[.measureName(measure.id)] = "Serving name is required" }
            if amount <= 0 { issues[.measureSize(measure.id)] = "Must be greater than 0" }
            all.append(Measure(name: name, quantity: quantity, servings: amount / sizePerServing))
        }

        var amounts = NutrientAmounts()
        for (id, text) in nutrients where !text.trimmingCharacters(in: .whitespaces).isEmpty {
            guard let value = NumberText.parse(text), value >= 0 else {
                issues[.nutrient(id)] = "Enter a number of 0 or more"
                continue
            }
            amounts[id] = id == .energy && energyUnit == .kj ? value / Self.kilojoulesPerKilocalorie : value
        }

        guard issues.isEmpty else { return (nil, issues) }
        let nutrition = FoodNutrition(nutrients: amounts, baseGrams: size.grams, baseMilliliters: size.milliliters, measures: all)
        return (Valid(name: name, brand: Self.optional(brand), barcode: Self.optional(barcode), icon: icon, nutrition: nutrition), [:])
    }

    private static func optional(_ text: String) -> String? {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        return trimmed.isEmpty ? nil : trimmed
    }
}

extension FoodDraft.Valid {
    func write(into food: inout Food) {
        food.name = name
        food.brand = brand
        food.barcode = barcode
        food.icon = icon
        food.nutrition = nutrition
    }

    func newFood() -> Food {
        var food = Food(name: name, nutrition: nutrition)
        write(into: &food)
        return food
    }
}
