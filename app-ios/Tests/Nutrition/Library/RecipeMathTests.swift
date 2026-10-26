import Foundation
import Testing
@testable import App

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

    @Test func convertingAMeasureKeepsTheAmount() {
        let cup = Measure(name: "cup", quantity: 1, servings: 2.5)
        let tablespoon = Measure(name: "tbsp", quantity: 1, servings: 0.15625)
        let grams = Measure(name: "g", quantity: 1, servings: 0.01)
        #expect(RecipeMath.convert(1, from: cup, to: tablespoon) == 16)
        #expect(RecipeMath.convert(8, from: tablespoon, to: cup) == 0.5)
        #expect(RecipeMath.convert(2, from: banana.nutrition.measures[0], to: grams) == 300)
        #expect(RecipeMath.grams(Serving(measure: banana.nutrition.measures[0], quantity: 2), of: banana) == 300)
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
        draft.ingredients = [large(1)]
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

    @Test func aValidRecipeTrimsItsFields() {
        var draft = RecipeDraft()
        draft.name = " Soup "
        draft.servings = "4"
        draft.ingredients = [large(2)]
        draft.prepMinutes = "10"
        draft.link = "example.com/soup"
        draft.notes = " Warm. "
        draft.steps = [RecipeDraft.Step(text: " Chop "), RecipeDraft.Step(text: "  "), RecipeDraft.Step(text: "Simmer")]

        let valid = draft.valid
        #expect(valid?.name == "Soup")
        #expect(valid?.servings == 4)
        #expect(valid?.cookedGrams == 300)
        #expect(valid?.prepMinutes == 10)
        #expect(valid?.cookMinutes == nil)
        #expect(valid?.link == "https://example.com/soup")
        #expect(valid?.notes == "Warm.")
        #expect(valid?.steps == ["Chop", "Simmer"])
    }

    @Test func invalidRecipeFieldsReportMacroFactorsMessages() {
        var draft = RecipeDraft()
        draft.servings = "0"
        draft.totalWeight = "abc"
        draft.prepMinutes = "1.5"
        draft.link = "not a link"
        #expect(draft.issues == [
            .name: "Recipe name is required",
            .servings: "Serving quantity cannot be zero",
            .totalWeight: "Must be greater than 0",
            .ingredients: "Add at least one ingredient",
            .prepMinutes: "Enter whole minutes",
            .link: "Field must be a valid URL",
        ])
        draft.servings = " "
        #expect(draft.issues[.servings] == "Serving quantity is required")
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

    @Test func amountsAndServingsReadLikeMacroFactor() {
        #expect(LibraryFormat.amount(15.64) == "15.6")
        #expect(LibraryFormat.amount(120.4) == "120")
        #expect(LibraryFormat.macros([.energy: 60.4, .protein: 0.4, .carbs: 15.6]) == "60 kcal · 0P 0F 16C")
        #expect(LibraryFormat.serving(Serving(measure: banana.nutrition.measures[0], quantity: 1), of: banana) == "1 large (150 g)")
        #expect(LibraryFormat.serving(Serving(measure: Measure(name: "g", quantity: 1, servings: 0.01), quantity: 30), of: banana) == "30 g")
    }
}
