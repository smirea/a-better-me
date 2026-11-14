import Foundation
import GRDB
import Testing
@testable import App

private let per100g = #"{"nutrients":{"k":89},"baseGrams":100,"measures":[{"name":"medium","quantity":1,"servings":1.18}]}"#

private let kefir = Food(
    .openFoodFacts(barcode: "0017077001328"), name: "Organic Kefir cultured lowfat milk", brand: "Lifeway",
    nutrition: FoodNutrition(
        nutrients: [.energy: 46, .protein: 4.6], baseMilliliters: 100,
        measures: [Measure(name: "serving", quantity: 1, servings: 2.4)]
    )
)

@MainActor
struct FoodCorrectionTests {
    let store: LocalStore
    let catalog: USDACatalog
    let today = CalendarDay.today

    init() throws {
        store = try LocalStore(unsyncedAt: FileManager.default.temporaryDirectory.appending(path: "food-correction-\(UUID().uuidString)/a.sqlite"))
        catalog = try fixtureCatalog([(173944, "Bananas, raw", 8, per100g)])
    }

    func search(_ branded: StubBranded = StubBranded()) async throws -> FoodSearch {
        try await store.write { _ in }.value
        return try await FoodSearch.load(store: store, catalog: catalog, branded: branded)
    }

    func update(_ food: FoodSnapshot) async throws -> FoodUpdate {
        try await store.write { _ in }.value
        return try await store.read { try FoodUpdate.of(food, in: $0) }
    }

    /// The copy Update saves after the owner reads a new label: 120 kcal and 10 g protein in a 240 mL serving.
    func corrected(_ update: FoodUpdate) throws -> Food {
        guard case let .replace(copy) = update else { throw CancellationError() }
        var draft = FoodDraft(copy)
        draft.nutrients = [.energy: "120", .protein: "10"]
        var food = copy
        try #require(draft.valid).write(into: &food)
        return food
    }

    @Test func updatingADatabaseFoodSavesACopyThatSearchScansAndPicksReturnInstead() async throws {
        store.saveFood(kefir)
        let logged = FoodEntry(FoodPortion(kefir.snapshot), day: today, minute: 480)
        store.log([logged])
        let copy = try corrected(try await update(kefir.snapshot))
        #expect(copy.source == .custom)
        #expect(copy.replaces == "off-0017077001328")
        #expect(copy.barcode == "0017077001328")
        store.correctFood(copy)

        let search = try await search(StubBranded(products: [kefir.barcode!: kefir], hits: [kefir]))
        for results in [try search.local(""), try search.local("kefir"), try await search.search("kefir"), search.picks(.hour(8))] {
            #expect(results.map(\.portion.food.foodID) == [copy.id])
            #expect(results.first?.portion.amounts[.energy] == 120)
            #expect(results.first?.food == nil)
        }
        #expect(try await search.lookup(barcode: kefir.barcode!)?.id == copy.id)
        #expect(try store.readBlocking { try FoodEntry.fetchOne($0, key: FoodEntry.key(logged.id)) }?.food == kefir.snapshot)
    }

    @Test func updatingAgainEditsTheCopyAndDeletingItBringsTheDatabaseFoodBack() async throws {
        store.saveFood(kefir)
        store.log([FoodEntry(FoodPortion(kefir.snapshot), day: today, minute: 480)])
        let copy = try corrected(try await update(kefir.snapshot))
        store.correctFood(copy)

        guard case let .edit(again) = try await update(kefir.snapshot) else { Issue.record("A corrected food gained a second copy"); return }
        #expect(again.id == copy.id)

        store.deleteFood(copy.id)
        let search = try await search()
        #expect(try search.local("kefir").map(\.portion.food.foodID) == ["off-0017077001328"])
        #expect(try search.local("kefir").first?.portion.amounts[.energy] == 46 * 2.4)
    }

    @Test func aCorrectedCatalogFoodReplacesItsCommonResult() async throws {
        let banana = try #require(try catalog.foods([173944])[173944])
        guard case var .replace(copy) = try await update(banana.snapshot) else { Issue.record("A catalog food was edited"); return }
        copy.nutrition.nutrients[.energy] = 105
        store.correctFood(copy)
        let results = try await search().local("banana")
        #expect(results.map { "\($0.group) \($0.portion.food.foodID ?? "")" } == ["custom \(copy.id)"])
    }

    @Test func aCorrectionReachesFavoritesAndRecipeIngredientsAtTheSameQuantityOfTheirMeasure() async throws {
        store.saveFood(kefir)
        let serving = Serving(measure: kefir.nutrition.measures[0], quantity: 2)
        store.addFavorite(FoodPortion(kefir.snapshot, serving: serving))
        var smoothie = Recipe(name: "Smoothie", servings: 1)
        smoothie.ingredients = [RecipeIngredient(FoodPortion(kefir.snapshot, serving: serving)), RecipeIngredient(FoodPortion(yogurt))]
        store.saveRecipe(smoothie)
        let copy = try corrected(try await update(kefir.snapshot))
        store.correctFood(copy)
        try await store.write { _ in }.value

        let favorite = try #require(try store.readBlocking { try FoodFavorite.fetchAll($0) }.first)
        #expect(favorite.food.foodID == copy.id)
        #expect(favorite.portion.amounts[.energy] == 240)
        let recipe = try #require(try store.readBlocking { try Recipe.fetchOne($0, key: Recipe.key(smoothie.id)) })
        #expect(recipe.ingredients.map(\.food.foodID) == [copy.id, yogurt.foodID])
        #expect(recipe.ingredients[0].food.amounts(recipe.ingredients[0].serving)[.energy] == 240)
    }

    @Test func anEditedCustomFoodOffersItsNewValuesFromTheHistory() async throws {
        let bar = Food(name: "Protein bar", nutrition: FoodNutrition(nutrients: [.energy: 200], measures: [Measure(name: "bar", quantity: 1, servings: 1)]))
        store.saveFood(bar)
        store.log([FoodPortion(bar.snapshot, serving: Serving(measure: bar.nutrition.measures[0], quantity: 2))], on: today, minute: 600)
        guard case var .edit(edited) = try await update(bar.snapshot) else { Issue.record("A custom food was copied"); return }
        edited.nutrition.nutrients[.energy] = 210
        store.correctFood(edited)

        let latest = try await search().local("")
        #expect(latest.map(\.portion.food.foodID) == [bar.id])
        #expect(latest.first?.portion.amounts[.energy] == 420)
    }

    @Test func aServingFollowsItsMeasureByNameElseTakesTheDefault() {
        let corrected = FoodNutrition(nutrients: [:], baseMilliliters: 240, measures: [Measure(name: "serving", quantity: 1, servings: 1)])
        let mL = Measure(name: "mL", quantity: 1, servings: 0.01)
        #expect(Serving(measure: mL, quantity: 240).fitted(to: corrected) == Serving(measure: Measure(name: "mL", quantity: 1, servings: 1 / 240), quantity: 240))
        #expect(Serving(measure: Measure(name: "cup", quantity: 1, servings: 3), quantity: 2).fitted(to: FoodNutrition(nutrients: [:], measures: corrected.measures))
            == Serving(measure: corrected.measures[0], quantity: 1))
    }
}
