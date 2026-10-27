import Foundation
import Testing
@testable import App

struct FoodDraftTests {
    @Test func aServingWithAWeightBecomesTheBaseServingWithItsGrams() {
        var draft = FoodDraft()
        draft.name = "  Greek Yogurt "
        draft.brand = " "
        draft.barcode = "0123"
        draft.servingWeight = "170"
        draft.servingQuantity = "1"
        draft.servingName = "container"
        draft.nutrients = [.energy: "150", .protein: "15", .fat: "", .fiber: "0,5"]

        #expect(draft.issues.isEmpty)
        #expect(draft.basisLabel == "1 container (170 g)")
        #expect(draft.valid == FoodDraft.Valid(
            name: "Greek Yogurt", brand: nil, barcode: "0123", icon: nil,
            nutrition: FoodNutrition(
                nutrients: [.energy: 150, .protein: 15, .fiber: 0.5], baseGrams: 170, baseMilliliters: nil,
                measures: [Measure(name: "container", quantity: 1, servings: 1)]
            )
        ))
    }

    @Test func servingWeightUnitsConvertToGramsOrMilliliters() {
        var draft = FoodDraft()
        draft.name = "Juice"
        draft.servingWeight = "2"
        draft.servingWeightUnit = .cup
        #expect(draft.valid?.nutrition.baseMilliliters == 473.176473)
        #expect(draft.valid?.nutrition.baseGrams == nil)
        #expect(draft.measureSizeUnit == "mL")

        draft.servingWeightUnit = .lb
        #expect(draft.valid?.nutrition.baseGrams == 907.18474)
        #expect(draft.measureSizeUnit == "g")
    }

    @Test func perHundredGramsHasAGramBaseAndMeasuresSizedInGrams() {
        var draft = FoodDraft()
        draft.name = "Bread"
        draft.basis = .hundredGrams
        draft.servingName = ""
        draft.measures = [FoodDraft.MeasureDraft(quantity: "1", name: "slice", size: "30")]
        draft.nutrients = [.energy: "250"]

        let nutrition = draft.valid?.nutrition
        #expect(nutrition?.baseGrams == 100)
        #expect(nutrition?.measures == [Measure(name: "g", quantity: 100, servings: 1), Measure(name: "slice", quantity: 1, servings: 0.3)])
        #expect(draft.basisLabel == "100 g")
    }

    @Test func kilojoulesAreStoredAsKilocalories() {
        var draft = FoodDraft()
        draft.name = "Bar"
        draft.energyUnit = .kj
        draft.nutrients = [.energy: "4184", .protein: "10"]
        #expect(draft.valid?.nutrition.nutrients == [.energy: 1000, .protein: 10])
    }

    @Test func invalidFieldsReportMacroFactorsMessages() {
        var draft = FoodDraft()
        draft.name = " "
        draft.servingWeight = "-1"
        draft.servingQuantity = "0"
        draft.servingName = ""
        let measure = FoodDraft.MeasureDraft(quantity: "1", name: "", size: "x")
        draft.measures = [measure]
        draft.nutrients = [.protein: "abc", .fat: "-2"]

        #expect(draft.valid == nil)
        #expect(draft.issues == [
            .name: "Food name is required",
            .servingWeight: "Must be greater than 0",
            .servingQuantity: "Serving quantity cannot be zero",
            .servingName: "Serving name is required",
            .measureName(measure.id): "Serving name is required",
            .measureSize(measure.id): "Must be greater than 0",
            .nutrient(.protein): "Enter a number of 0 or more",
            .nutrient(.fat): "Enter a number of 0 or more",
        ])

        draft.servingQuantity = ""
        #expect(draft.issues[.servingQuantity] == "Serving quantity is required")
    }

    @Test func aSavedFoodReadsBackIntoTheSameFields() {
        var draft = FoodDraft()
        draft.name = "Bread"
        draft.brand = "Bakery"
        draft.icon = "bread"
        draft.basis = .hundredGrams
        draft.measures = [FoodDraft.MeasureDraft(quantity: "1", name: "slice", size: "30")]
        draft.nutrients = [.energy: "250", .protein: "8.5"]
        let food = draft.valid!.newFood()

        let read = FoodDraft(food)
        #expect(read.basis == .hundredGrams)
        #expect(read.name == "Bread")
        #expect(read.brand == "Bakery")
        #expect(read.icon == "bread")
        #expect(read.measures.map { [$0.quantity, $0.name, $0.size] } == [["1", "slice", "30"]])
        #expect(read.nutrients == [.energy: "250", .protein: "8.5"])
        #expect(read.valid?.nutrition == food.nutrition)
    }

    @Test func aFoodWhoseDefaultMeasureIsNotTheBaseServingIsRescaledToIt() {
        let food = Food(
            name: "Yogurt",
            nutrition: FoodNutrition(
                nutrients: [.energy: 120, .protein: 10], baseGrams: 100,
                measures: [Measure(name: "container", quantity: 1, servings: 1.5), Measure(name: "spoon", quantity: 1, servings: 0.2)]
            )
        )
        let draft = FoodDraft(food)
        #expect(draft.basis == .serving)
        #expect(draft.servingQuantity == "1")
        #expect(draft.servingName == "container")
        #expect(draft.servingWeight == "150")
        #expect(draft.nutrients == [.energy: "180", .protein: "15"])
        #expect(draft.measures.map { [$0.quantity, $0.name, $0.size] } == [["1", "spoon", "20"]])
        #expect(draft.duplicate().name == "Yogurt (Copy)")
    }
}
