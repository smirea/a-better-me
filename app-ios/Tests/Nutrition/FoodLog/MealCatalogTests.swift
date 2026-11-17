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

    @Test func twoFoodsMakeAMealAndQuickAddsDoNotCount() {
        #expect(MealComponents([granola, granola]) == nil)
        #expect(MealComponents([granola, .quickAdd([.energy: 300])]) == nil)
        #expect(MealComponents([granola, yogurt, yogurt])?.keys == ["granola", "usda-171304"])
        #expect(MealComponents([granola, yogurt, milk, .quickAdd([.energy: 300])])?.keys == ["granola", "milk", "usda-171304"])
    }

    @Test func theFallbackNameIsTheTwoFoodsWithTheMostCaloriesUpToTheirFirstComma() {
        var beef = food("beef", "Beef, top sirloin, steak, separable lean only")
        beef.nutrition.nutrients[.energy] = 400
        var potatoes = food("potatoes", "Potatoes, baked, flesh and skin")
        potatoes.nutrition.nutrients[.energy] = 93
        #expect(MealComponents.fallbackName([portion(potatoes, 3), portion(beef, 1), FoodPortion(.quickAdd([.energy: 900]))]) == "Beef and Potatoes")
        #expect(MealComponents.fallbackName([portion(potatoes, 5), portion(beef, 1), portion(granola, 0.5)]) == "Potatoes and Beef")
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
        #expect(catalog.index.line(for: meal, fallback: "") == .suggested("Yogurt Granola Bowl"))
        let search = try await FoodSearch.load(store: store, catalog: try fixtureCatalog([]), branded: StubBranded())
        #expect(try search.local("Yogurt Granola Bowl").isEmpty)

        let relaunched = MealCatalog(model: model)
        relaunched.start(store: store)
        relaunched.suggest(meal, from: entries)
        await relaunched.idle()
        #expect(model.asked.count == 1)
        #expect(relaunched.index.line(for: meal, fallback: "") == .suggested("Yogurt Granola Bowl"))

        let recipe = FoodLog.mealRecipe("Yogurt Granola Bowl", from: entries)
        store.saveRecipe(recipe)
        await catalog.idle()
        #expect(catalog.index.line(for: meal, fallback: "") == .saved(.init(id: recipe.id, name: "Yogurt Granola Bowl"), count: 1))
        #expect(recipe.servings == 1)
        #expect(recipe.cookedGrams == 450)

        store.log([portion(milk, 2), portion(granola, 0.5), portion(yogurt, 1)], on: tuesday, minute: 9 * 60)
        await catalog.idle()
        #expect(try await breakfast(on: tuesday).0 == meal)
        #expect(catalog.index.line(for: meal, fallback: "") == .saved(.init(id: recipe.id, name: "Yogurt Granola Bowl"), count: 2))

        store.log([FoodPortion(recipe.snapshot)], on: tuesday, minute: 19 * 60)
        await catalog.idle()
        #expect(catalog.index.line(for: meal, fallback: "") == .saved(.init(id: recipe.id, name: "Yogurt Granola Bowl"), count: 3))
    }

    @Test func createReplacesTheFoodsWithOneServingOfTheMealAndUndoTakesItAllBack() async throws {
        store.log([portion(granola, 1), portion(yogurt, 2), portion(milk, 1)], on: monday, minute: 8 * 60)
        store.log([FoodPortion(.quickAdd([.energy: 50]))], on: monday, minute: 8 * 60 + 5)
        let catalog = MealCatalog(model: StubMealNameModel(answer: "Yogurt Granola Bowl"))
        catalog.start(store: store)
        let (meal, entries) = try await breakfast(on: monday)
        let state = FoodLogState()

        await state.createMeal("Yogurt Granola Bowl", from: entries, in: store).value
        await catalog.idle()
        let replaced = try store.readBlocking(FoodEntry.on(monday).fetch)
        #expect(replaced.map(\.food.name) == ["Yogurt Granola Bowl", "Quick Add"])
        #expect(replaced.map(\.minute) == [8 * 60, 8 * 60 + 5])
        #expect(replaced.totals[.energy] == entries.totals[.energy])
        #expect(replaced[0].serving.servings == 1)
        let recipe = try #require(try store.readBlocking { try Recipe.fetchAll($0) }.first)
        #expect(catalog.index.line(for: meal, fallback: "") == .saved(.init(id: recipe.id, name: "Yogurt Granola Bowl"), count: 1))
        #expect(state.notice?.message == "Replaced 3 foods with Yogurt Granola Bowl")
        let lines = try #require(try store.readBlocking(FoodEntry.recipeIngredients(on: monday).fetch)[replaced[0].id]).lines
        #expect(lines.first?.name == "Yogurt")
        #expect(Set(lines.dropFirst().map(\.name)) == ["Granola", "Oat milk"])

        state.undo(in: store)
        try await store.write { _ in }.value
        let restored = try store.readBlocking(FoodEntry.on(monday).fetch)
        #expect(restored.map(\.food.name).sorted() == ["Granola", "Oat milk", "Quick Add", "Yogurt"])
        #expect(restored.totals[.energy] == entries.totals[.energy])
        #expect(try store.readBlocking { try Recipe.fetchCount($0) } == 0)
    }

    @Test func aMealShownWhileItsRecipeIsDeletedIsNamedThen() async throws {
        let model = StubMealNameModel(answer: "Yogurt Granola Bowl")
        let catalog = MealCatalog(model: model)
        catalog.start(store: store)
        store.log([portion(granola, 1), portion(yogurt, 1), portion(milk, 1)], on: monday, minute: 8 * 60)
        let (meal, entries) = try await breakfast(on: monday)
        let recipe = FoodLog.mealRecipe("Breakfast Bowl", from: entries)
        store.saveRecipe(recipe)
        await catalog.idle()

        catalog.suggest(meal, from: entries)
        await catalog.idle()
        #expect(model.asked.isEmpty)
        #expect(catalog.index.line(for: meal, fallback: "") == .saved(.init(id: recipe.id, name: "Breakfast Bowl"), count: 1))

        store.deleteRecipe(recipe.id)
        await catalog.idle()
        #expect(model.asked.count == 1)
        #expect(catalog.index.line(for: meal, fallback: "") == .suggested("Yogurt Granola Bowl"))
    }

    @Test func withoutTheModelAnUnnamedMealShowsItsFallbackName() async throws {
        store.log([portion(granola, 1), portion(yogurt, 1), portion(milk, 1)], on: monday, minute: 8 * 60)
        let model = StubMealNameModel(isAvailable: false, answer: "Yogurt Granola Bowl")
        let catalog = MealCatalog(model: model)
        catalog.start(store: store)
        let (meal, entries) = try await breakfast(on: monday)

        catalog.suggest(meal, from: entries)
        await catalog.idle()
        #expect(model.asked.isEmpty)
        #expect(catalog.index.line(for: meal, fallback: "Granola and Yogurt") == .suggested("Granola and Yogurt"))
    }

    /// The real model on meals as the owner logs them, the first two from the owner's log on 2026-11-17, when this
    /// simulator or device can run it (CI's simulators can't). A CI runner once reported the model available and then
    /// failed to load its assets (ModelManagerError 1026), so a load failure from the framework is a known,
    /// intermittent issue of the machine rather than of the naming.
    @Test(.enabled(if: SystemLanguageModel.default.isAvailable))
    func theOnDeviceModelNamesEachMealFromTwoOfItsFoods() async throws {
        let meals: [[String]] = [
            ["Pomegranate Arils By POM Wonderful, 70 g", "Matcha Granola Bowl, 1 serving (129 g)"],
            ["Rotini By Carbe Diem!, 56 g", "Pasta sauce, 1 serving (292 g)"],
            ["Chicken, broilers or fryers, breast, meat only, cooked, roasted, 150 g", "Rice, white, long-grain, regular, enriched, cooked, 1 cup", "Broccoli, raw, 100 g"],
            ["Yogurt, Greek, plain, nonfat, 200 g", "Blueberries By Fruitist Jumbo, 0.5 cup", "Homemade Granola, 45 g", "Syrups, maple, 1 tbsp"],
            ["Egg, Whole, Raw, 2 large", "Sourdough Bread, 1 slice", "Avocados, raw, all commercial varieties, 0.5 avocado"],
            ["Whey Protein By Optimum Nutrition, 1 scoop", "Bananas, raw, 1 medium", "Milk, reduced fat, fluid, 2% milkfat, 1 cup"],
            ["Salmon, Atlantic, farmed, cooked, dry heat, 150 g", "Sweet potato, cooked, baked in skin, flesh, without salt, 1 medium", "Spinach, raw, 50 g"],
            ["Bagels, plain, enriched, 1 bagel", "Cream cheese, 2 tbsp", "Salmon, smoked, 50 g"],
            ["Matcha latte, 1 cup", "Whole milk, 120 ml", "Oat milk, 100 ml", "Granola, 45 g", "Chia seeds, 1 tbsp", "Blueberries, 0.5 cup"],
            ["Ground turkey, 93% lean, 7% fat, pan-broiled crumbles, 150 g", "Tortillas, ready-to-bake or -fry, flour, 2 tortilla", "Cheese, cheddar, 30 g"],
            ["Coca-Cola Zero Sugar, 1 can", "Quest Protein Bar Cookies & Cream, 1 bar"],
            ["Oatmeal Bowl, 1 serving (350 g)", "Cold Brew with Oat Milk By Chamberlain, 1 bottle"],
            ["Protein Boost Fusilli no. 34 By De Cecco, 85 g", "Hamburger or Ground Beef, 120 g", "San Marzano Tomatoes, 200 g"],
            ["Peanut butter, smooth style, with salt, 2 tbsp", "Dave's Killer Bread 21 Whole Grains and Seeds, 2 slices", "Bananas, raw, 1 medium"],
        ]
        try await withKnownIssue("The on-device model can be listed before its assets load", isIntermittent: true) {
            var names: [String] = []
            var fromOne: [String] = []
            for foods in meals {
                let name = MealCatalog.cleaned(try await OnDeviceMealNameModel().name(for: foods))
                names.append(name)
                // Each line without its amount, the part after the last comma.
                let mentioned = foods.filter { MealCatalog.mentions(name, String($0[..<($0.lastIndex(of: ",") ?? $0.endIndex)])) }
                if mentioned.count < 2 { fromOne.append(name) }
                #expect((2...6).contains(name.split(separator: " ").count), "\(name)")
            }
            // On macOS 27's model (2026-11-17) every name came from two foods, and three said so in other words, which
            // a shared word can't see: "Pasta and Sauce" for rotini, "Soda and Cookies", and "Beef and Pasta" for
            // fusilli. Version 1's instructions shared a word with two foods in 7 of the 14.
            #expect(fromOne.count <= 3, "Named from one food by shared words: \(fromOne); all: \(names)")
        } matching: { issue in
            (issue.error as NSError?)?.domain == "FoundationModels.LanguageModelError"
        }
    }
}
