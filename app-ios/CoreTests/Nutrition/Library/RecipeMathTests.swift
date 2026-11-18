import Foundation
import Testing
@testable import Core

/// 100 kcal, 2 g protein, and 20 g carbs per 100 g; a large one is 150 g.
private let banana = FoodSnapshot(
    foodID: "banana", source: .custom, name: "Banana", brand: nil,
    nutrition: FoodNutrition(nutrients: [.energy: 100, .protein: 2, .carbs: 20], baseGrams: 100, measures: [Measure(name: "large", quantity: 1, servings: 1.5)])
)

private func large(_ quantity: Double) -> RecipeIngredient {
    RecipeIngredient(FoodPortion(banana, serving: Serving(measure: banana.nutrition.measures[0], quantity: quantity)))
}

struct RecipeMathTests {
    @Test func aRecipeDividesIntoServingsAndGramsOfItsCookedWeight() {
        var recipe = Recipe(name: "Banana Bread", servings: 2)
        recipe.ingredients = [large(1), RecipeIngredient(FoodPortion(.quickAdd([.energy: 50, .fat: 5])))]
        recipe.cookedGrams = 128

        #expect(RecipeMath.ingredientGrams(recipe.ingredients) == 150)
        #expect(RecipeMath.total(recipe.ingredients) == [.energy: 200, .protein: 3, .carbs: 30, .fat: 5])
        #expect(recipe.nutrition.nutrients == [.energy: 100, .protein: 1.5, .carbs: 15, .fat: 2.5])
        #expect(recipe.nutrition.baseGrams == 64)
        #expect(RecipeMath.perGram(recipe) == [.energy: 1.5625, .protein: 0.0234375, .carbs: 0.234375, .fat: 0.0390625])

        recipe.cookedGrams = nil
        #expect(RecipeMath.perGram(recipe) == nil)
    }

    @Test func measuresScaleByTheirServings() {
        let cup = Measure(name: "cup", quantity: 1, servings: 2.5)
        let tablespoon = Measure(name: "tbsp", quantity: 1, servings: 0.15625)
        #expect(Serving(measure: cup, quantity: 2).servings == 5)
        #expect(Serving(measure: tablespoon, quantity: 8).servings == 1.25)
        #expect(banana.nutrition.grams(Serving(measure: banana.nutrition.measures[0], quantity: 2)) == 300)
    }

    @Test func prepareScalesIngredientsToTheServingsCooked() {
        let scaled = RecipeMath.scaled([large(1.5)], from: 2, to: 3)
        #expect(scaled.map(\.serving.quantity) == [2.25])
        #expect(scaled.map(\.serving.measure.name) == ["large"])
    }

    @Test func aBlankTotalWeightFollowsTheIngredients() {
        var draft = RecipeDraft()
        draft.name = "Bread"
        draft.servings = "2"
        draft.ingredients = [.init(large(1))]
        #expect(draft.cookedGrams == 150)
        #expect(draft.preview.nutrition.baseGrams == 75)

        draft.totalWeight = "120"
        #expect(draft.valid?.cookedGrams == 120)

        var recipe = draft.valid!.newRecipe()
        recipe.cookedGrams = 150
        #expect(RecipeDraft(recipe).totalWeight == "")
        recipe.cookedGrams = 120
        #expect(RecipeDraft(recipe).totalWeight == "120")
    }
}

struct LibraryFilterTests {
    private func food(_ name: String, brand: String? = nil, created: TimeInterval) -> Food {
        var food = Food(name: name, brand: brand, nutrition: FoodNutrition(nutrients: [:], measures: [Measure(name: "serving", quantity: 1, servings: 1)]))
        food.createdAt = Date(timeIntervalSince1970: created)
        food.updatedAt = Date(timeIntervalSince1970: 1000 - created)
        return food
    }

    @Test func everyWordOfTheQueryMatchesTheNameOrBrandAndTheSortOrders() {
        let foods = [food("Greek Yogurt", brand: "Fage", created: 1), food("apple", created: 3), food("Égg Whites", created: 2)]
        #expect(LibraryFilter.foods(foods, matching: "", sort: .aToZ).map(\.name) == ["apple", "Égg Whites", "Greek Yogurt"])
        #expect(LibraryFilter.foods(foods, matching: "", sort: .zToA).map(\.name) == ["Greek Yogurt", "Égg Whites", "apple"])
        #expect(LibraryFilter.foods(foods, matching: "", sort: .created).map(\.name) == ["apple", "Égg Whites", "Greek Yogurt"])
        #expect(LibraryFilter.foods(foods, matching: "", sort: .modified).map(\.name) == ["Greek Yogurt", "Égg Whites", "apple"])
        #expect(LibraryFilter.foods(foods, matching: "yog fage").map(\.name) == ["Greek Yogurt"])
        #expect(LibraryFilter.foods(foods, matching: "egg").map(\.name) == ["Égg Whites"])
        #expect(LibraryFilter.foods(foods, matching: "yogurt apple").isEmpty)
    }

    @Test func oneServingOfARecipeIsItsTotalOverItsYield() {
        var sauce = Recipe(name: "Pasta sauce", servings: 4)
        sauce.ingredients = [large(8)]
        sauce.cookedGrams = 1460
        let portion = FoodPortion(sauce.snapshot)

        #expect(portion.amounts == [.energy: 300, .protein: 6, .carbs: 60])
        #expect(NutritionFormat.listed(portion.serving, of: sauce.snapshot) == "1 serving (365 g)")
        #expect(NutritionFormat.listed(Serving(measure: banana.nutrition.measures[0], quantity: 1), of: banana) == "1 large")

        sauce.servings = 1
        #expect(FoodPortion(sauce.snapshot).amounts == [.energy: 1200, .protein: 24, .carbs: 240])
        #expect(NutritionFormat.listed(FoodPortion(sauce.snapshot).serving, of: sauce.snapshot) == "1 serving (1,460 g)")
    }
}
