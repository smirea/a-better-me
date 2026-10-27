import Foundation
import Testing
@testable import App

struct FocusOrderTests {
    @Test func walksQuickAddTopToBottomAndStopsAtTheEnds() {
        let order = QuickAddDraft.focusOrder
        #expect(order.field(after: .energy) == .protein)
        #expect(order.field(after: .alcohol) == .name)
        #expect(order.field(after: .name) == nil)
        #expect(order.field(before: .protein) == .energy)
        #expect(order.field(before: .energy) == nil)
        #expect(order.field(after: nil) == nil)
    }

    @Test func aFoodSkipsTheServingFieldsPer100GramsAndCollapsedBreakdowns() {
        var draft = FoodDraft()
        let measure = FoodDraft.MeasureDraft()
        draft.measures = [measure]
        let macros: [FoodDraft.Field] = [.nutrient(.energy), .nutrient(.protein), .nutrient(.fat), .nutrient(.carbs)]
        #expect(draft.focusOrder(expanded: []).fields == [
            .name, .brand, .barcode, .servingWeight, .servingQuantity, .servingName,
            .measureQuantity(measure.id), .measureName(measure.id), .measureSize(measure.id),
        ] + macros)

        draft.basis = .hundredGrams
        draft.measures = []
        let fiber = FoodDraft.Field.nutrient(.fiber)
        #expect(draft.focusOrder(expanded: []).fields == [.name, .brand, .barcode] + macros)
        #expect(draft.focusOrder(expanded: [.carbs]).fields.contains(fiber))
        #expect(draft.focusOrder(expanded: [.carbs]).field(after: .nutrient(.carbs)) == fiber)
    }

    @Test func aRecipeWalksThroughEachIngredientsQuantity() {
        var draft = RecipeDraft()
        let ingredient = RecipeDraft.Ingredient(RecipeIngredient(FoodPortion(.quickAdd([.energy: 100]))))
        draft.ingredients = [ingredient]
        let order = draft.focusOrder
        #expect(order.fields == [.name, .servings, .totalWeight, .ingredientQuantity(ingredient.id), .prepMinutes, .cookMinutes, .link])
        #expect(order.field(after: .totalWeight) == .ingredientQuantity(ingredient.id))
    }
}
