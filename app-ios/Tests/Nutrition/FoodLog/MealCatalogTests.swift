import Foundation
import FoundationModels
import Testing
@testable import App

/// Answers one name for every meal and records the foods it was asked about.
final class StubMealNameModel: MealNameModel, @unchecked Sendable {
    let isAvailable: Bool
    let answer: String
    private(set) var asked: [[String]] = []

    init(isAvailable: Bool = true, answer: String) {
        self.isAvailable = isAvailable
        self.answer = answer
    }

    func name(for foods: [String]) async throws -> String {
        asked.append(foods)
        return answer
    }
}

private func food(_ id: String, _ name: String) -> FoodSnapshot {
    var food = yogurt
    food.foodID = id
    food.source = .custom
    food.name = name
    return food
}

private let granola = food("granola", "Granola")
private let milk = food("milk", "Oat milk")

private func portion(_ food: FoodSnapshot, _ quantity: Double) -> FoodPortion {
    FoodPortion(food, serving: Serving(measure: food.nutrition.measures[0], quantity: quantity))
}

struct MealComponentsTests {
    @Test func aMealIsItsDistinctFoodsInAnyOrderAtAnyServing() throws {
        let meal = try #require(MealComponents([granola, yogurt, milk, yogurt]))
        #expect(meal.keys == ["granola", "milk", "usda-171304"])
        #expect(meal.hash == "63e148afdf56fd5963fb803e94e94a5a")
        #expect(MealComponents([milk, yogurt, granola]) == meal)
    }

    @Test func fewerThanThreeFoodsIsNoMealAndQuickAddsDoNotCount() {
        #expect(MealComponents([granola, yogurt, yogurt]) == nil)
        #expect(MealComponents([granola, yogurt, .quickAdd([.energy: 300])]) == nil)
        #expect(MealComponents([granola, yogurt, milk, .quickAdd([.energy: 300])])?.keys == ["granola", "milk", "usda-171304"])
    }

    @Test func theModelsAnswerLosesQuotesAndAClosingPeriod() {
        #expect(MealCatalog.cleaned(" \"Matcha  Granola Bowl.\"\n") == "Matcha Granola Bowl")
    }
}

@MainActor
struct MealCatalogTests {
    let store: LocalStore
    let monday = calendarDay("2026-10-26")
    let tuesday = calendarDay("2026-10-27")

    init() throws {
        store = try LocalStore(unsyncedAt: FileManager.default.temporaryDirectory.appending(path: "meals-\(UUID().uuidString)/a.sqlite"))
    }

    func breakfast(on day: CalendarDay) async throws -> (MealComponents, [FoodEntry]) {
        try await store.write { _ in }.value
        let entries = try store.readBlocking { try FoodEntry.fetchAll($0) }.filter { $0.day == day }
        return (try #require(MealComponents(entries.map(\.food))), entries)
    }

    @Test func aNewMealIsNamedOnceStoredAndCreatedAsARecipeThatCountsLaterDays() async throws {
        store.log([portion(granola, 1), portion(yogurt, 1), portion(milk, 1)], on: monday, minute: 8 * 60)
        let model = StubMealNameModel(answer: "Yogurt Granola Bowl.")
        let catalog = MealCatalog(model: model)
        catalog.start(store: store)
        let (meal, entries) = try await breakfast(on: monday)

        catalog.suggest(meal, from: entries)
        await catalog.idle()
        #expect(model.asked.map { $0.sorted() } == [["Granola, 1 container (150 g)", "Oat milk, 1 container (150 g)", "Yogurt, 1 container (150 g)"]])
        #expect(catalog.index.line(for: meal) == .suggested("Yogurt Granola Bowl"))
        let search = try await FoodSearch.load(store: store, catalog: try fixtureCatalog([]), branded: StubBranded())
        #expect(try search.local("Yogurt Granola Bowl").isEmpty)

        let relaunched = MealCatalog(model: model)
        relaunched.start(store: store)
        relaunched.suggest(meal, from: entries)
        await relaunched.idle()
        #expect(model.asked.count == 1)
        #expect(relaunched.index.line(for: meal) == .suggested("Yogurt Granola Bowl"))

        let recipe = FoodLog.mealRecipe("Yogurt Granola Bowl", from: entries)
        store.saveRecipe(recipe)
        await catalog.idle()
        #expect(catalog.index.line(for: meal) == .saved(.init(id: recipe.id, name: "Yogurt Granola Bowl"), count: 1))
        #expect(recipe.servings == 1)
        #expect(recipe.cookedGrams == 450)

        store.log([portion(milk, 2), portion(granola, 0.5), portion(yogurt, 1)], on: tuesday, minute: 9 * 60)
        await catalog.idle()
        #expect(try await breakfast(on: tuesday).0 == meal)
        #expect(catalog.index.line(for: meal) == .saved(.init(id: recipe.id, name: "Yogurt Granola Bowl"), count: 2))

        store.log([FoodPortion(recipe.snapshot)], on: tuesday, minute: 19 * 60)
        await catalog.idle()
        #expect(catalog.index.line(for: meal) == .saved(.init(id: recipe.id, name: "Yogurt Granola Bowl"), count: 3))
    }

    @Test func withoutTheModelAnUnnamedMealHasNoLine() async throws {
        store.log([portion(granola, 1), portion(yogurt, 1), portion(milk, 1)], on: monday, minute: 8 * 60)
        let model = StubMealNameModel(isAvailable: false, answer: "Yogurt Granola Bowl")
        let catalog = MealCatalog(model: model)
        catalog.start(store: store)
        let (meal, entries) = try await breakfast(on: monday)

        catalog.suggest(meal, from: entries)
        await catalog.idle()
        #expect(model.asked.isEmpty)
        #expect(catalog.index.line(for: meal) == nil)
    }

    /// The real model on the owner's breakfast, when this simulator or device can run it (CI's simulators can't).
    @Test(.enabled(if: SystemLanguageModel.default.isAvailable))
    func theOnDeviceModelNamesAMealInAFewWords() async throws {
        let name = MealCatalog.cleaned(try await OnDeviceMealNameModel().name(for: [
            "Matcha latte, 1 cup", "Whole milk, 120 ml", "Oat milk, 100 ml", "Granola, 45 g", "Chia seeds, 1 tbsp", "Blueberries, 0.5 cup",
        ]))
        print("Named the breakfast \(name)")
        #expect((1...5).contains(name.split(separator: " ").count))
    }
}
