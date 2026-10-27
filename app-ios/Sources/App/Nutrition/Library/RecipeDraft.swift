import Foundation

/// Recipe and measure arithmetic. `Recipe.nutrition` owns the per-serving amounts; these add the weights, per-gram
/// amounts, and scaling the editor and Prepare show.
enum RecipeMath {
    /// What `serving` of `food` weighs, when the food's base serving has a weight.
    static func grams(_ serving: Serving, of food: FoodSnapshot) -> Double? {
        food.nutrition.baseGrams.map { serving.servings * $0 }
    }

    /// MacroFactor's "Weight of ingredients": the sum over the ingredients whose weight is known.
    static func ingredientGrams(_ ingredients: [RecipeIngredient]) -> Double {
        ingredients.reduce(0) { $0 + (grams($1.serving, of: $1.food) ?? 0) }
    }

    /// Everything the recipe makes, before dividing into servings.
    static func total(_ ingredients: [RecipeIngredient]) -> NutrientAmounts {
        ingredients.reduce(into: NutrientAmounts()) { $0 = $0 + $1.food.amounts($1.serving) }
    }

    /// Amounts in one gram of the cooked recipe; nil without a cooked weight.
    static func perGram(_ recipe: Recipe) -> NutrientAmounts? {
        guard let cookedGrams = recipe.cookedGrams, cookedGrams > 0 else { return nil }
        return total(recipe.ingredients).scaled(by: 1 / cookedGrams)
    }

    /// The ingredients for `servings` servings of a recipe that makes `yield`, as Prepare lists them.
    static func scaled(_ ingredients: [RecipeIngredient], from yield: Double, to servings: Double) -> [RecipeIngredient] {
        ingredients.map {
            var scaled = $0
            scaled.serving.quantity *= servings / yield
            return scaled
        }
    }
}

/// The recipe editor's fields as typed.
struct RecipeDraft: Equatable, Sendable {
    struct Step: Equatable, Identifiable, Sendable {
        var id = UUID()
        var text = ""
    }

    /// An ingredient and its quantity as typed. Typing a positive number sets the serving; switching the measure
    /// converts the serving at full precision and only displays it rounded, so a round trip never drifts.
    struct Ingredient: Equatable, Identifiable, Sendable {
        private(set) var value: RecipeIngredient
        private(set) var quantity: String

        var id: UUID { value.id }
        var isValid: Bool { (NumberText.parse(quantity) ?? 0) > 0 }

        init(_ value: RecipeIngredient) {
            self.value = value
            quantity = NumberText.text(value.serving.quantity)
        }

        mutating func type(_ text: String) {
            quantity = text
            if let typed = NumberText.parse(text), typed > 0 { value.serving.quantity = typed }
        }

        mutating func switchMeasure(to measure: Measure) {
            value.serving = value.serving.converted(to: measure)
            quantity = NumberText.text(value.serving.quantity)
        }
    }

    enum Field: Hashable, Sendable {
        case name, servings, totalWeight, ingredients, prepMinutes, cookMinutes, link
        case ingredientQuantity(UUID)
    }

    struct Valid: Equatable, Sendable {
        var name: String
        var icon: String?
        var ingredients: [RecipeIngredient]
        var servings: Double
        var cookedGrams: Double?
        var steps: [String]
        var prepMinutes: Int?
        var cookMinutes: Int?
        var link: String?
        var notes: String
    }

    static let notesLimit = 1500
    static let stepLimit = 300

    var icon: String?
    var name = ""
    var servings = "1"
    /// The cooked weight of the whole recipe in grams; blank falls back to the ingredients' weight.
    var totalWeight = ""
    var ingredients: [Ingredient] = []
    var prepMinutes = ""
    var cookMinutes = ""
    var link = ""
    var notes = ""
    var steps: [Step] = []

    init() {}

    /// A cooked weight equal to the ingredients' weight reads back blank, so it keeps following the ingredients.
    init(_ recipe: Recipe) {
        icon = recipe.icon
        name = recipe.name
        servings = NumberText.text(recipe.servings)
        ingredients = recipe.ingredients.map(Ingredient.init)
        if let cookedGrams = recipe.cookedGrams, abs(cookedGrams - RecipeMath.ingredientGrams(recipe.ingredients)) > 0.001 {
            totalWeight = NumberText.text(cookedGrams)
        }
        prepMinutes = recipe.prepMinutes.map(String.init) ?? ""
        cookMinutes = recipe.cookMinutes.map(String.init) ?? ""
        link = recipe.link ?? ""
        notes = recipe.notes
        steps = recipe.steps.map { Step(text: $0) }
    }

    func duplicate() -> RecipeDraft {
        var copy = self
        copy.name = "\(name) (Copy)"
        copy.ingredients = ingredients.map { Ingredient(RecipeIngredient(FoodPortion($0.value.food, serving: $0.value.serving))) }
        copy.steps = steps.map { Step(text: $0.text) }
        return copy
    }

    var ingredientGrams: Double { RecipeMath.ingredientGrams(ingredients.map(\.value)) }

    /// The cooked weight the recipe saves with: the typed total, else the ingredients' weight when any is known.
    var cookedGrams: Double? {
        if let typed = NumberText.parse(totalWeight), typed > 0 { return typed }
        let grams = ingredientGrams
        return grams > 0 ? grams : nil
    }

    /// The draft as a recipe for the live nutrition preview, read leniently while fields are mid-edit.
    var preview: Recipe {
        var recipe = Recipe(name: name, servings: NumberText.parse(servings).flatMap { $0 > 0 ? $0 : nil } ?? 1)
        recipe.icon = icon
        recipe.ingredients = ingredients.map(\.value)
        recipe.cookedGrams = cookedGrams
        return recipe
    }

    var issues: [Field: String] { validate().issues }
    var valid: Valid? { validate().valid }

    private func validate() -> (valid: Valid?, issues: [Field: String]) {
        var issues: [Field: String] = [:]
        let name = self.name.trimmingCharacters(in: .whitespaces)
        if name.isEmpty { issues[.name] = "Recipe name is required" }
        let servings = NumberText.parse(self.servings)
        if self.servings.trimmingCharacters(in: .whitespaces).isEmpty {
            issues[.servings] = "Serving quantity is required"
        } else if (servings ?? 0) <= 0 {
            issues[.servings] = "Serving quantity cannot be zero"
        }
        if !totalWeight.trimmingCharacters(in: .whitespaces).isEmpty, (NumberText.parse(totalWeight) ?? 0) <= 0 {
            issues[.totalWeight] = "Must be greater than 0"
        }
        if ingredients.isEmpty { issues[.ingredients] = "Add at least one ingredient" }
        for ingredient in ingredients where !ingredient.isValid {
            issues[.ingredientQuantity(ingredient.id)] = "Must be greater than 0"
        }
        let prep = Self.minutes(self.prepMinutes)
        if prep == nil { issues[.prepMinutes] = "Enter whole minutes" }
        let cook = Self.minutes(self.cookMinutes)
        if cook == nil { issues[.cookMinutes] = "Enter whole minutes" }
        let link = Self.link(self.link)
        if link == nil { issues[.link] = "Field must be a valid URL" }

        guard issues.isEmpty, let servings, let prep, let cook, let link else { return (nil, issues) }
        let steps = self.steps.map { String($0.text.trimmingCharacters(in: .whitespacesAndNewlines).prefix(Self.stepLimit)) }.filter { !$0.isEmpty }
        return (
            Valid(
                name: name, icon: icon, ingredients: ingredients.map(\.value), servings: servings, cookedGrams: cookedGrams, steps: steps,
                prepMinutes: prep, cookMinutes: cook, link: link,
                notes: String(notes.trimmingCharacters(in: .whitespacesAndNewlines).prefix(Self.notesLimit))
            ),
            [:]
        )
    }

    /// Blank is `.some(nil)`; a whole number of 0 or more is itself; anything else is nil.
    private static func minutes(_ text: String) -> Int?? {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return .some(nil) }
        guard let minutes = Int(trimmed), minutes >= 0 else { return nil }
        return .some(minutes)
    }

    /// Blank is `.some(nil)`. A link without a scheme gets https, as a pasted "example.com/soup" should work.
    private static func link(_ text: String) -> String?? {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return .some(nil) }
        let candidate = trimmed.contains("://") ? trimmed : "https://\(trimmed)"
        guard let url = URL(string: candidate), let scheme = url.scheme, ["http", "https"].contains(scheme),
              let host = url.host(), host.contains(".") else { return nil }
        return .some(candidate)
    }
}

extension RecipeDraft.Valid {
    func write(into recipe: inout Recipe) {
        recipe.name = name
        recipe.icon = icon
        recipe.ingredients = ingredients
        recipe.servings = servings
        recipe.cookedGrams = cookedGrams
        recipe.steps = steps
        recipe.prepMinutes = prepMinutes
        recipe.cookMinutes = cookMinutes
        recipe.link = link
        recipe.notes = notes
    }

    func newRecipe() -> Recipe {
        var recipe = Recipe(name: name, servings: servings)
        write(into: &recipe)
        return recipe
    }
}
