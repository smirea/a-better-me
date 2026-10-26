import Foundation
import Testing
@testable import App

/// The bundled SR Legacy file itself: what the owner sees first for the foods logged most, and the nutrients and
/// servings a USDA row decodes to.
struct USDACatalogTests {
    let catalog = USDACatalog.bundled

    func top(_ query: String, _ count: Int = 3) -> [String] {
        catalog.search(FoodText.terms(query), limit: count).map(\.entry.name)
    }

    @Test func commonQueriesFindThePlainFoodFirst() {
        #expect(catalog.entries.count == 7283)
        #expect(top("banana") == ["Bananas, raw", "Bananas, dehydrated, or banana powder", "Pepper, banana, raw"])
        #expect(top("egg") == ["Egg, whole, raw, fresh", "Egg, white, raw, fresh", "Egg, whole, cooked, fried"])
        #expect(top("chicken breast", 2) == [
            "Chicken, broilers or fryers, breast, meat only, cooked, roasted",
            "Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw",
        ])
        #expect(top("rice cooked", 2) == ["Rice, white, long-grain, regular, enriched, cooked", "Rice, brown, long-grain, cooked"])
        #expect(top("greek yogurt", 1) == ["Yogurt, Greek, plain, nonfat"])
        #expect(top("salmon", 1) == ["Fish, salmon, Atlantic, farmed, cooked, dry heat"])
    }

    @Test func aRowDecodesToRegistryNutrientsAndHouseholdMeasures() throws {
        let banana = try #require(try catalog.foods([173944])[173944])
        #expect(banana.id == "usda-173944")
        #expect(banana.name == "Bananas, raw")
        let nutrients = banana.nutrition.nutrients
        #expect([nutrients[.energy], nutrients[.protein], nutrients[.fat], nutrients[.carbs], nutrients[.fiber]] == [89, 1.09, 0.33, 22.84, 2.6])
        #expect([nutrients["306"], nutrients["401"], nutrients["255"], nutrients["901"], nutrients["902"]] == [358, 8.7, 74.91, 0.027, 0.046])
        #expect(nutrients.allSatisfy { NutrientRegistry.nutrient($0.key) != nil })
        #expect(banana.nutrition.baseGrams == 100)
        #expect(banana.nutrition.measures.prefix(2) == [
            Measure(name: "medium (7\" to 7-7/8\" long)", quantity: 1, servings: 1.18),
            Measure(name: "cup, mashed", quantity: 1, servings: 2.25),
        ])
        let medium = FoodPortion(banana.snapshot)
        #expect(medium.amounts[.energy] == 89 * 1.18)
        #expect(medium.serving.servings * banana.nutrition.baseGrams! == 118)
    }
}
