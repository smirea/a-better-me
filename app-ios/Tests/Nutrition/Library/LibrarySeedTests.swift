import Foundation
import GRDB
import Testing
@testable import App

@MainActor
struct LibrarySeedTests {
    @Test func everySeededIconIsAFoodIconName() {
        let icons = LibrarySeed.foods.map(\.icon) + LibrarySeed.recipes.map(\.icon) + LibrarySeed.recipes.flatMap(\.ingredients).map(\.food.icon)
            + FoodLogSeed.days.flatMap { $0.map(\.1.icon) }
        #expect(icons.filter { FoodIconChoice.named($0) == nil }.isEmpty)
    }

    @Test func recipesDivideTheirIngredientsIntoServings() {
        #expect(LibrarySeed.overnightOats.nutrition.nutrients[.energy] == 312.5)
        #expect(LibrarySeed.chickenRiceBowl.nutrition.baseGrams == 295)
        #expect(LibrarySeed.recipes.map(\.ingredients.count) == [4, 3, 3, 4])
    }

    @Test func favoritesKeepTheirNamedServings() {
        #expect(LibrarySeed.favorites.map { NutritionFormat.serving($0.serving) } == ["1 medium", "0.5 cup", "1.5 oz", "1 scoop", "1 serving"])
    }

    @Test func seedingAgainAfterTheRecipesAreDeletedConverges() async throws {
        let store = try LocalStore(unsyncedAt: FileManager.default.temporaryDirectory.appending(path: "seed-\(UUID().uuidString)/a.sqlite"))
        try await store.write { try DevSeed.seed(in: $0) }.value
        try await store.write { db in
            _ = try Recipe.deleteAll(db)
            _ = try FoodFavorite.deleteAll(db)
            try DevSeed.seed(in: db)
        }.value
        let counts = try store.read { db in
            try [Recipe.fetchCount(db), Food.filter(Column("source") == "custom").fetchCount(db), FoodFavorite.fetchCount(db)]
        }
        #expect(counts == [4, 4, 5])
        let recipeEntries = try store.read { db in
            try FoodEntry.fetchAll(db).filter { $0.food.source == .recipe && $0.day != .today }.map(\.serving.quantity).sorted()
        }
        #expect(recipeEntries == [0.5, 0.5, 0.75, 1, 1.5])
    }
}
