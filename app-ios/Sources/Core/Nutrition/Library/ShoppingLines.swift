import Foundation
import GRDB

/// One line a recipe puts on a shopping list: an ingredient's short name ("Rolled oats", not the branded name) and its
/// amount as a recipe tile shows it.
struct ShoppingLine: Hashable, Identifiable, Sendable {
    let name: String
    let quantity: String

    var id: String { name.lowercased() }
}

enum ShoppingLines {
    /// ShopALotl's limit for an item's amount.
    static let maxQuantity = 40

    /// The recipe's ingredients as shopping lines, one per name: two lines that shorten to the same name keep the first
    /// one's amount, as ShopALotl itself merges names that share a key.
    static func lines(_ ingredients: [RecipeIngredient], shortNames: [String: String]) -> [ShoppingLine] {
        var seen = Set<String>()
        return ingredients.compactMap { ingredient in
            let name = shortNames[FoodShortName.rowID(for: ingredient.food)] ?? FoodShortName.fallback(ingredient.food)
            let line = ShoppingLine(name: name, quantity: String(NutritionFormat.shortServing(ingredient.serving).prefix(maxQuantity)))
            return seen.insert(line.id).inserted ? line : nil
        }
    }

    /// The stored short names of the ingredients' foods, by `FoodShortName.rowID`.
    static func shortNames(_ db: Database, for ingredients: [RecipeIngredient]) throws -> [String: String] {
        let keys = Set(ingredients.map { FoodShortName.rowID(for: $0.food) })
        return Dictionary(try FoodShortName.filter(keys: keys).fetchAll(db).map { ($0.id, $0.name) }, uniquingKeysWith: { a, _ in a })
    }
}
