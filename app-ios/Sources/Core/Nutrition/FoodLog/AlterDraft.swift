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

}

extension AlterDraft {
    /// What the logger lists: every ingredient not removed.
    var ingredientList: IngredientList {
        IngredientList(rows.filter { !$0.isRemoved }.map(\.ingredient.listItem))
    }

    /// The logger's list applied back. A row it dropped is removed as Remove does, so one of the recipe's stays struck
    /// through for Restore; a row whose amount it changed takes the new amount; a new item is an added food.
    mutating func setIngredients(_ list: IngredientList) {
        let listed = Dictionary(list.items.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        for row in rows where !row.isRemoved && listed[row.id] == nil { remove(row.id) }
        for item in list.items {
            if let index = rows.firstIndex(where: { $0.id == item.id }) {
                if rows[index].ingredient.listItem != item { rows[index].ingredient = RecipeDraft.Ingredient(item) }
            } else {
                rows.append(Row(ingredient: RecipeDraft.Ingredient(item), original: nil))
            }
        }
    }
}
