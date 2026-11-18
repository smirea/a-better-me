import Foundation

/// Alter's ingredients as the owner edits them: each typed quantity, whether it was removed, and what the recipe held.
struct AlterDraft: Equatable {
    struct Row: Identifiable, Equatable {
        var ingredient: RecipeDraft.Ingredient
        /// The recipe's amount at one serving; nil for a food the owner added.
        let original: Serving?
        var isRemoved = false

        var id: UUID { ingredient.id }

        var alteration: IngredientAlteration {
            let eaten = ingredient.value.serving
            let serving: Serving? = isRemoved ? nil : original.map { IngredientAlteration.same($0, eaten) ? $0 : eaten } ?? eaten
            return IngredientAlteration(id: id, food: ingredient.value.food, original: original, serving: serving)
        }
    }

    var rows: [Row]

    init(_ alterations: [IngredientAlteration]) {
        rows = alterations.compactMap { line in
            guard let serving = line.serving ?? line.original else { return nil }
            var ingredient = RecipeIngredient(FoodPortion(line.food, serving: serving))
            ingredient.id = line.id
            return Row(ingredient: RecipeDraft.Ingredient(ingredient), original: line.original, isRemoved: line.serving == nil)
        }
    }

    var alterations: [IngredientAlteration] { rows.map(\.alteration) }
    var isValid: Bool { rows.allSatisfy { $0.isRemoved || $0.ingredient.isValid } }

    /// An added food goes; one of the recipe's stays, struck through, so Restore can bring it back.
    mutating func remove(_ id: UUID) {
        guard let index = rows.firstIndex(where: { $0.id == id }) else { return }
        if rows[index].original == nil { rows.remove(at: index) } else { rows[index].isRemoved = true }
    }

    /// Back to what the recipe holds.
    mutating func restore(_ id: UUID) {
        guard let index = rows.firstIndex(where: { $0.id == id }), let original = rows[index].original else { return }
        var ingredient = rows[index].ingredient.value
        ingredient.serving = original
        rows[index] = Row(ingredient: RecipeDraft.Ingredient(ingredient), original: original)
    }

    mutating func add(_ portion: FoodPortion) {
        rows.append(Row(ingredient: RecipeDraft.Ingredient(RecipeIngredient(portion)), original: nil))
    }
}
