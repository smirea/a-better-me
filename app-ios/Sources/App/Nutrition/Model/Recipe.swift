import Foundation
import GRDB

struct RecipeIngredient: Hashable, Codable, Identifiable, Sendable {
    var id = UUID()
    var food: FoodSnapshot
    var serving: Serving

    init(_ portion: FoodPortion) {
        food = portion.food
        serving = portion.serving
    }
}

/// A row of the synced `recipes` table. Ingredients are snapshots, so a recipe survives its foods being edited or
/// deleted. Its nutrition is derived from them, never stored.
struct Recipe: SyncedRecord {
    static let table = "recipes"

    var id: UUID
    var name: String
    var ingredients: [RecipeIngredient] = []
    /// How many servings the whole recipe makes.
    var servings: Double = 1
    /// What everything the recipe makes weighs once cooked.
    var cookedGrams: Double?
    var steps: [String] = []
    var prepMinutes: Int?
    var cookMinutes: Int?
    var notes = ""
    var isArchived = false
    var createdAt: Date
    var updatedAt: Date

    init(name: String, servings: Double = 1) {
        id = UUID()
        self.name = name
        self.servings = servings
        createdAt = .now
        updatedAt = .now
    }

    /// Per one serving of the yield, weighable when the cooked weight is known.
    var nutrition: FoodNutrition {
        let total = ingredients.reduce(into: NutrientAmounts()) { $0 = $0 + $1.food.amounts($1.serving) }
        return FoodNutrition(
            nutrients: total.scaled(by: 1 / servings),
            baseGrams: cookedGrams.map { $0 / servings },
            measures: [Measure(name: "serving", quantity: 1, servings: 1)]
        )
    }

    var snapshot: FoodSnapshot {
        FoodSnapshot(foodID: key, source: .recipe, name: name, nutrition: nutrition)
    }

    init(row: Row) throws {
        id = try row.uuid("id")
        name = row["name"]
        ingredients = try row.json("ingredients")
        servings = row["servings"] ?? 1
        cookedGrams = row["cooked_grams"]
        steps = try row.json("steps")
        prepMinutes = row["prep_minutes"]
        cookMinutes = row["cook_minutes"]
        notes = row["notes"] ?? ""
        isArchived = row.flag("archived")
        createdAt = try row.instant("created_at")
        updatedAt = try row.instant("updated_at")
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = key
        container["name"] = name
        container["ingredients"] = try RowJSON.text(ingredients)
        container["servings"] = servings
        container["cooked_grams"] = cookedGrams
        container["steps"] = try RowJSON.text(steps)
        container["prep_minutes"] = prepMinutes
        container["cook_minutes"] = cookMinutes
        container["notes"] = notes
        container["archived"] = isArchived ? 1 : 0
        container["created_at"] = Instant.text(createdAt)
        container["updated_at"] = Instant.text(updatedAt)
    }
}
