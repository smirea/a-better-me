import Foundation
import GRDB
import Testing
@testable import App

/// A catalog in the generator's shape over a few rows, with the priors the generator gives them.
func fixtureCatalog(_ rows: [(id: Int, name: String, prior: Double, nutrition: String)]) throws -> USDACatalog {
    let database = try DatabaseQueue()
    try database.write { db in
        try db.execute(sql: "CREATE TABLE foods (fdc_id INTEGER PRIMARY KEY, name TEXT NOT NULL, prior REAL NOT NULL, nutrition TEXT NOT NULL)")
        for row in rows {
            try db.execute(sql: "INSERT INTO foods VALUES (?, ?, ?, ?)", arguments: [row.id, row.name, row.prior, row.nutrition])
        }
    }
    return try USDACatalog(database)
}

private let per100g = #"{"nutrients":{"k":100},"baseGrams":100,"measures":[{"name":"g","quantity":100,"servings":1}]}"#
private let bananaNutrition = #"{"nutrients":{"k":89,"p":1.09,"f":0.33,"c":22.84,"291":2.6},"baseGrams":100,"measures":[{"name":"medium (7\" to 7-7/8\" long)","quantity":1,"servings":1.18},{"name":"cup, sliced","quantity":1,"servings":1.5}]}"#

private let catalogRows: [(id: Int, name: String, prior: Double, nutrition: String)] = [
    (167629, "Melon, banana (Navajo)", 0, per100g),
    (168185, "Pepper, banana, raw", 0, per100g),
    (169078, "Bananas, dehydrated, or banana powder", 0, per100g),
    (173944, "Bananas, raw", 8, bananaNutrition),
    (172183, "Egg, white, raw, fresh", 5, per100g),
    (171287, "Egg, whole, raw, fresh", 8, per100g),
    (169228, "Eggplant, raw", 0, per100g),
    (171477, "Chicken, broilers or fryers, breast, meat only, cooked, roasted", 8, per100g),
    (171078, "Chicken, broilers or fryers, breast, meat only, cooked, fried", 0, per100g),
    (174608, "Chicken breast tenders, breaded, cooked, microwaved", 0, per100g),
    (175139, "Fish, salmon, Atlantic, farmed, cooked, dry heat", 8, per100g),
    (173687, "Salmon, sockeye, canned, total can contents", 0, per100g),
]

private let chobani = Food(
    .openFoodFacts(barcode: "0894700010137"), name: "Nonfat Greek Yogurt", brand: "Chobani",
    nutrition: FoodNutrition(
        nutrients: [.energy: 52.9, .protein: 9.41], baseGrams: 100,
        measures: [Measure(name: "serving", quantity: 1, servings: 1.7), Measure(name: "g", quantity: 100, servings: 1)]
    )
)

/// Answers from fixed foods, or fails like a phone without a network.
struct StubBranded: BrandedFoodSource {
    var products: [String: Food] = [:]
    var hits: [Food] = []
    var offline = false

    func food(barcode: String) async throws -> Food? {
        if offline { throw URLError(.notConnectedToInternet) }
        return products[barcode]
    }

    func search(_ query: String, limit: Int) async throws -> [Food] {
        if offline { throw URLError(.notConnectedToInternet) }
        return hits
    }
}

@MainActor
struct FoodSearchTests {
    let store: LocalStore
    let catalog: USDACatalog
    let monday = calendarDay("2026-10-26")

    init() throws {
        store = try LocalStore(unsyncedAt: FileManager.default.temporaryDirectory.appending(path: "food-search-\(UUID().uuidString)/a.sqlite"))
        catalog = try fixtureCatalog(catalogRows)
    }

    func search(_ branded: StubBranded = StubBranded()) async throws -> FoodSearch {
        try await store.write { _ in }.value
        return try FoodSearch(store: store, catalog: catalog, branded: branded)
    }

    func names(_ results: [FoodSearchResult]) -> [String] {
        results.map { "\($0.group) \($0.portion.food.name)" }
    }

    @Test func plainFoodsRankFirst() async throws {
        let search = try await search()
        #expect(names(try search.local("banana")) == [
            "common Bananas, raw", "common Bananas, dehydrated, or banana powder", "common Pepper, banana, raw", "common Melon, banana (Navajo)",
        ])
        #expect(names(try search.local("egg")) == ["common Egg, whole, raw, fresh", "common Egg, white, raw, fresh", "common Eggplant, raw"])
        #expect(names(try search.local("chicken breast")).first == "common Chicken, broilers or fryers, breast, meat only, cooked, roasted")
        #expect(names(try search.local("salmon")).first == "common Fish, salmon, Atlantic, farmed, cooked, dry heat")
        #expect(names(try search.local("bananas raw")) == ["common Bananas, raw", "common Pepper, banana, raw"])
        #expect(names(try search.local("ban")).first == "common Bananas, raw")
        #expect(try search.local("kiwi").isEmpty)
    }

    @Test func aCommonResultIsTheCachedFoodAtItsDefaultServing() async throws {
        let banana = try #require(try await search().local("banana").first)
        #expect(banana.food?.id == "usda-173944")
        #expect(banana.food?.source == .usda)
        #expect(banana.portion.serving.measure.name == "medium (7\" to 7-7/8\" long)")
        #expect(banana.portion.amounts[.energy] == 89 * 1.18)
        #expect(banana.portion.amounts.amount(of: .netCarbs) == 22.84 * 1.18 - 2.6 * 1.18)
        let ounce = try #require(banana.portion.food.nutrition.allMeasures.first { $0.name == "oz" })
        #expect(FoodPortion(banana.portion.food, serving: Serving(measure: ounce, quantity: 4)).amounts[.energy] == 89 * (28.349523125 / 100 * 4))
    }

    @Test func historyComesFirstAtItsLastServingAndHidesTheSameFoodBelow() async throws {
        let banana = try #require(try catalog.foods([173944])[173944])
        let cup = banana.nutrition.measures[1]
        store.log([FoodPortion(banana.snapshot)], on: calendarDay("2026-10-20"), minute: 480)
        store.log([FoodPortion(banana.snapshot, serving: Serving(measure: cup, quantity: 2))], on: monday, minute: 480)
        store.quickAdd([.energy: 300], name: "Banana split", on: monday, minute: 900)
        let bread = Food(name: "Banana bread", nutrition: FoodNutrition(nutrients: [.energy: 300], measures: [Measure(name: "slice", quantity: 1, servings: 1)]))
        store.saveFood(bread)
        store.log([FoodPortion(yogurt)], on: monday, minute: 420)
        let search = try await search()

        let results = try search.local("banana")
        #expect(names(results) == [
            "history Bananas, raw", "custom Banana bread", "common Bananas, dehydrated, or banana powder", "common Pepper, banana, raw",
            "common Melon, banana (Navajo)",
        ])
        #expect(results[0].portion.serving == Serving(measure: cup, quantity: 2))
        #expect(results[0].food == nil)
        #expect(names(try search.local("")) == ["history Bananas, raw", "history Yogurt"])
    }

    @Test func favoritesRecipesAndCustomFoodsMatchTheirNamesAndBrands() async throws {
        var recipe = Recipe(name: "Overnight oats", servings: 2)
        recipe.ingredients = [RecipeIngredient(FoodPortion(yogurt))]
        store.saveRecipe(recipe)
        store.addFavorite(FoodPortion(yogurt, serving: Serving(measure: yogurt.nutrition.measures[0], quantity: 2)))
        store.saveFood(Food(name: "Protein bar", brand: "Barebells", nutrition: FoodNutrition(nutrients: [.energy: 200], measures: [Measure(name: "bar", quantity: 1, servings: 1)])))
        let search = try await search()

        #expect(names(try search.local("oats")) == ["recipes Overnight oats"])
        #expect(try search.local("yogurt").map(\.group) == [.favorites])
        #expect(try search.local("yogurt")[0].portion.serving.quantity == 2)
        #expect(names(try search.local("barebells")) == ["custom Protein bar"])
    }

    @Test func brandedResultsJoinOnlineAndOfflineSearchKeepsLocalResultsWithoutAnError() async throws {
        store.saveFood(chobani)
        let other = Food(.openFoodFacts(barcode: "5000000000017"), name: "Greek Yogurt Honey", brand: "Fage", nutrition: chobani.nutrition)
        let online = try await search(StubBranded(hits: [chobani, other]))
        #expect(names(try await online.search("greek yogurt")) == ["branded Nonfat Greek Yogurt", "branded Greek Yogurt Honey"])
        let fetched = try #require(try await online.search("greek yogurt").last)
        #expect(fetched.food?.id == "off-5000000000017")
        #expect(fetched.portion.serving.measure.name == "serving")

        let offline = try await search(StubBranded(offline: true))
        #expect(names(try await offline.search("greek yogurt")) == ["branded Nonfat Greek Yogurt"])
        #expect(names(try await offline.search("greek yogurt", branded: false)) == ["branded Nonfat Greek Yogurt"])
    }

    @Test func aBarcodeLooksUpOnceAndIsCachedForOffline() async throws {
        let online = try await search(StubBranded(products: [chobani.barcode!: chobani]))
        #expect(try await online.lookup(barcode: "0000000000000") == nil)
        let found = try #require(try await online.lookup(barcode: chobani.barcode!))
        #expect(found.id == "off-0894700010137")
        try await store.write { _ in }.value
        #expect(try store.read { try Food.fetchOne($0, key: "off-0894700010137") }?.nutrition == chobani.nutrition)

        let offline = try await search(StubBranded(offline: true))
        #expect(try await offline.lookup(barcode: chobani.barcode!)?.name == "Nonfat Greek Yogurt")
        await #expect(throws: URLError.self) { try await offline.lookup(barcode: "4000000000006") }
    }

    @Test func cachingALoggedResultSavesItsFood() async throws {
        let search = try await search()
        let banana = try #require(try search.local("banana").first)
        search.cache(banana)
        store.log([banana.portion], on: monday, minute: 600)
        try await store.write { _ in }.value
        try search.reload()
        #expect(try store.read { try Food.fetchOne($0, key: "usda-173944") }?.name == "Bananas, raw")
        #expect(names(try search.local("banana")).first == "history Bananas, raw")
    }

    @Test func aPhotoNameMatchesItsExactDescriptionOrOnlyWordsThatCount() async throws {
        let search = try await search()
        #expect(try search.match("Chicken, broilers or fryers, breast, meat only, cooked, fried")?.portion.food.name == "Chicken, broilers or fryers, breast, meat only, cooked, fried")
        #expect(try search.match("skinless chicken breast cooked")?.portion.food.name == "Chicken, broilers or fryers, breast, meat only, cooked, roasted")
        #expect(try search.match("grilled salmon")?.portion.food.name == "Fish, salmon, Atlantic, farmed, cooked, dry heat")
        #expect(try search.match("rice cooked") == nil)
        #expect(try search.match("") == nil)
    }
}
