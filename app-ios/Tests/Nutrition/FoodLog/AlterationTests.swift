import Foundation
import GRDB
import Testing
@testable import App

/// Alter: a logged recipe keeps its name and recipe while its nutrition, tile, Explode, and copies follow the
/// alterations, against a real store.
@MainActor
struct AlterationTests {
    let monday = calendarDay("2025-03-03")
    let store: LocalStore
    let grams = Measure(name: "g", quantity: 100, servings: 1)
    let beef: FoodSnapshot
    let tomato: FoodSnapshot
    let basil: FoodSnapshot
    let recipe: Recipe

    init() throws {
        store = try LocalStore(unsyncedAt: FileManager.default.temporaryDirectory.appending(path: "alter-\(UUID().uuidString)/a.sqlite"))
        beef = FoodSnapshot(source: .usda, name: "Beef", nutrition: FoodNutrition(nutrients: [.energy: 200, .protein: 20], baseGrams: 100, measures: [grams]))
        tomato = FoodSnapshot(source: .usda, name: "Tomato", nutrition: FoodNutrition(nutrients: [.energy: 20], baseGrams: 100, measures: [grams]))
        basil = FoodSnapshot(source: .usda, name: "Basil", nutrition: FoodNutrition(nutrients: [.energy: 25], baseGrams: 100, measures: [grams]))
        var recipe = Recipe(name: "Pasta sauce", servings: 2)
        let measure = grams
        recipe.ingredients = [(beef, 400.0), (tomato, 200)].map { food, grams in RecipeIngredient(FoodPortion(food, serving: Serving(measure: measure, quantity: grams))) }
        recipe.cookedGrams = 600
        self.recipe = recipe
    }

    func portion(_ food: FoodSnapshot, _ grams: Double) -> FoodPortion {
        FoodPortion(food, serving: Serving(measure: self.grams, quantity: grams))
    }

    func logged(servings: Double = 1) -> FoodEntry {
        FoodEntry(FoodPortion(recipe.snapshot, serving: Serving(measure: recipe.nutrition.measures[0], quantity: servings)), day: monday, minute: 600)
    }

    /// Beef up from 200 g to 250 g a serving, the tomato out, basil in.
    func altered() -> [IngredientAlteration] {
        var draft = AlterDraft(.unaltered(recipe))
        draft.rows[0].ingredient.type("250")
        draft.remove(draft.rows[1].id)
        draft.add(portion(basil, 20))
        return draft.alterations
    }

    func stored(_ id: UUID) async throws -> FoodEntry? {
        try await store.write { _ in }.value
        return try store.readBlocking { try FoodEntry.fetchOne($0, key: FoodEntry.key(id)) }
    }

    @Test func alteringKeepsTheRecipeAndEatsTheAlterations() async throws {
        let entry = logged(servings: 2)
        try await store.write { [entry] db in try entry.insert(db) }.value

        store.alter(entry.id, to: altered())
        let saved = try #require(try await stored(entry.id))
        #expect(saved.food.name == "Pasta sauce")
        #expect(saved.food.foodID == recipe.snapshot.foodID)
        #expect(saved.alterations?.map(\.change) == [.changed, .removed, .added])
        // 250 g of beef and 20 g of basil a serving, two servings eaten.
        let energy = try #require(saved.amounts[.energy])
        let protein = try #require(saved.amounts[.protein])
        #expect(abs(energy - 2 * (500 + 5)) < 1e-6)
        #expect(abs(protein - 100) < 1e-6)
        // 300 g a serving, plus 50 g of beef and 20 g of basil, less 100 g of tomato.
        #expect(saved.food.nutrition.baseGrams == 270)

        store.alter(entry.id, to: .unaltered(recipe))
        let reverted = try #require(try await stored(entry.id))
        #expect(reverted.alterations == nil)
        #expect(reverted.food.nutrition == recipe.snapshot.nutrition)
    }

    @Test func savingAnUnalteredRecipeWithoutAChangeWritesNothing() async throws {
        var entry = logged()
        entry.food.nutrition.nutrients = [.energy: 1]
        try await store.write { [entry] db in try entry.insert(db) }.value

        store.alter(entry.id, to: .unaltered(recipe))
        let saved = try #require(try await stored(entry.id))
        #expect(saved.food == entry.food)
        #expect(saved.alterations == nil)
    }

    @Test func theTileListsTheAlterationsAtTheAmountEaten() {
        let entry = logged(servings: 2).altered(to: altered())
        // The recipe is never read: the tile, the entry editor, and Explode take an altered entry's own list.
        let ingredients = FoodLog.ingredients(entry.serving, of: entry, recipe: nil)
        #expect(ingredients.map(\.change) == [.changed, .removed, .added])
        let tile = FoodLog.tileIngredients(ingredients)
        #expect(tile.isAltered)
        #expect(tile.lines == [
            .init(name: "Beef", amount: "500 g", change: .changed, was: "400 g"),
            .init(name: "Tomato", amount: "200 g", change: .removed),
            .init(name: "Basil", amount: "40 g", change: .added),
        ])
        #expect(tile.spoken == "Alterations: Beef changed from 400 g to 500 g, removed Tomato, added Basil, 40 g")
    }

    @Test func anAlteredRecipeExplodesIntoWhatWasEatenWithoutItsRecipe() async throws {
        var entry = logged(servings: 0.5).altered(to: altered())
        entry.section = "lunch"
        try await store.write { [entry] db in try entry.insert(db) }.value

        #expect(try await store.explode(entry.id).value)
        try await store.write { _ in }.value
        let exploded = try store.readBlocking(FoodEntry.on(monday).fetch)
        #expect(exploded.map(\.food.name) == ["Beef", "Basil"])
        #expect(exploded.map(\.serving.quantity) == [125, 10])
        #expect(exploded.allSatisfy { $0.section == "lunch" && $0.alterations == nil })
    }

    @Test func aCopyOfAnAlteredRecipeStaysAltered() async throws {
        let entry = logged().altered(to: altered())
        try await store.write { [entry] db in try entry.insert(db) }.value

        _ = store.relocate([entry], .copy, to: .days([monday.adding(days: 1)]))
        try await store.write { _ in }.value
        let copy = try #require(try store.readBlocking(FoodEntry.on(monday.adding(days: 1)).fetch).first)
        #expect(copy.id != entry.id)
        #expect(copy.alterations == entry.alterations)
        #expect(copy.amounts == entry.amounts)
    }

    @Test func aRemovedIngredientRestoresAndAnAddedOneGoes() {
        var draft = AlterDraft(.unaltered(recipe))
        draft.rows[0].ingredient.type("50")
        #expect(draft.alterations[0].change == .changed)
        draft.restore(draft.rows[0].id)
        #expect(!draft.alterations.isAltered)

        draft.remove(draft.rows[1].id)
        #expect(draft.rows.count == 2)
        #expect(draft.alterations[1].serving == nil)
        draft.restore(draft.rows[1].id)
        #expect(draft.alterations[1].change == .kept)

        draft.add(portion(basil, 5))
        draft.remove(draft.rows[2].id)
        #expect(draft.rows.count == 2)

        draft.rows[0].ingredient.type("")
        #expect(!draft.isValid)
    }

    @Test func theColumnHoldsWhatTheServerValidates() throws {
        let id = try #require(UUID(uuidString: "5D4F2C1A-0000-4000-8000-000000000001"))
        let line = IngredientAlteration(id: id, food: beef, original: Serving(measure: grams, quantity: 50), serving: nil)
        #expect(try RowJSON.text([line]) == """
        [{"food":{"name":"Beef","nutrition":{"baseGrams":100,"measures":[{"name":"g","quantity":100,"servings":1}],"nutrients":{"k":200,"p":20}},"source":"usda"},"id":"5D4F2C1A-0000-4000-8000-000000000001","original":{"measure":{"name":"g","quantity":100,"servings":1},"quantity":50}}]
        """)
    }

    /// An edited day's calories win over what is logged, so Alter's plate there is part of them, not on top of them.
    @Test func aPlateOnAnEditedDayIsPartOfItsEditedTotals() {
        var day = NutritionDay(id: monday)
        let entry = logged()
        #expect(PlateDayTotals.logged(day, [entry], plate: [.energy: 300])[.energy] == entry.amounts[.energy])
        day.override = [.energy: 2000]
        let totals = PlateDayTotals.logged(day, [entry], plate: [.energy: 300, .protein: 20])
        #expect(totals[.energy] == 1700)
        #expect(totals[.protein] == entry.amounts[.protein])
    }
}
