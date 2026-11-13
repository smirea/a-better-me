import Foundation

/// One ingredient of a logged recipe that was altered, at one serving of the recipe: the recipe's amount (`original`)
/// and what was eaten (`serving`). An added food has no original and a removed one no serving. The entry keeps the
/// whole list, unchanged ingredients too, so it explodes and draws without its recipe, and a later edit to the recipe
/// never changes what the entry says was eaten.
struct IngredientAlteration: Hashable, Codable, Identifiable, Sendable {
    enum Change: Hashable, Sendable {
        case kept
        case changed
        case removed
        case added
    }

    var id: UUID
    var food: FoodSnapshot
    var original: Serving?
    var serving: Serving?

    init(id: UUID = UUID(), food: FoodSnapshot, original: Serving?, serving: Serving?) {
        self.id = id
        self.food = food
        self.original = original
        self.serving = serving
    }

    /// The line for `factor` servings of the recipe.
    func scaled(by factor: Double) -> IngredientAlteration {
        let scale = { (serving: Serving) in Serving(measure: serving.measure, quantity: serving.quantity * factor) }
        return IngredientAlteration(id: id, food: food, original: original.map(scale), serving: serving.map(scale))
    }

    var change: Change {
        switch (original, serving) {
        case let (original?, serving?): Self.same(original, serving) ? .kept : .changed
        case (nil, _?): .added
        default: .removed
        }
    }

    /// The same amount, whatever measure it is written in.
    static func same(_ lhs: Serving, _ rhs: Serving) -> Bool {
        abs(lhs.servings - rhs.servings) <= 1e-9 * max(abs(lhs.servings), abs(rhs.servings), 1)
    }
}

extension [IngredientAlteration] {
    /// Alter's starting point for an entry that was not altered: the recipe's ingredients at one serving, each kept.
    static func unaltered(_ recipe: Recipe) -> Self {
        RecipeMath.scaled(recipe.ingredients, from: recipe.servings, to: 1).map {
            IngredientAlteration(id: $0.id, food: $0.food, original: $0.serving, serving: $0.serving)
        }
    }

    var isAltered: Bool { contains { $0.change != .kept } }

    /// What one serving was made of as eaten.
    var eaten: [FoodPortion] { compactMap { line in line.serving.map { FoodPortion(line.food, serving: $0) } } }

    /// What one serving of the recipe holds.
    var originals: [FoodPortion] { compactMap { line in line.original.map { FoodPortion(line.food, serving: $0) } } }

    /// How many grams the alterations add to one serving, counting only ingredients whose weight is known.
    var gramsAdded: Double {
        reduce(0) { total, line in
            let eaten = line.serving.flatMap { line.food.nutrition.grams($0) } ?? 0
            let original = line.original.flatMap { line.food.nutrition.grams($0) } ?? 0
            return total + eaten - original
        }
    }
}

extension FoodEntry {
    /// The entry with `alterations` in place of its current ones: the recipe's name and id stay, and the nutrition
    /// becomes the sum of what one serving now holds, so the day's totals follow. The weight of a serving moves by
    /// the weight the ingredients gained or lost. An empty or unchanged list returns the recipe as it was.
    func altered(to alterations: [IngredientAlteration]) -> FoodEntry {
        var entry = self
        let isAltered = alterations.isAltered
        let portions = isAltered ? alterations.eaten : alterations.originals
        entry.food.nutrition.nutrients = portions.reduce(into: NutrientAmounts()) { $0 = $0 + $1.amounts }
        if let grams = food.nutrition.baseGrams {
            let base = grams - (self.alterations?.gramsAdded ?? 0)
            let next = base + (isAltered ? alterations.gramsAdded : 0)
            entry.food.nutrition.baseGrams = next > 0 ? next : nil
        }
        entry.alterations = isAltered ? alterations : nil
        return entry
    }

    /// A new entry eating the same thing at another time: copies, Duplicate, and Undo keep an altered recipe altered.
    func copy(day: CalendarDay, minute: Int, section: String?) -> FoodEntry {
        var copy = FoodEntry(portion, day: day, minute: minute, section: section)
        copy.alterations = alterations
        return copy
    }
}
