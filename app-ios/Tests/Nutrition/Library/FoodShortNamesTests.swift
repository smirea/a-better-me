import Foundation
import FoundationModels
import GRDB
import Testing
@testable import App

/// Answers from a fixed table and records what it was asked.
final class StubShortNameModel: FoodShortNameModel, @unchecked Sendable {
    let isAvailable: Bool
    let answers: [String: String]
    private(set) var asked: [String] = []

    init(isAvailable: Bool = true, answers: [String: String]) {
        self.isAvailable = isAvailable
        self.answers = answers
    }

    func shortName(for food: String) async throws -> String {
        asked.append(food)
        guard let answer = answers[food] else { throw CancellationError() }
        return answer
    }
}

@MainActor
struct FoodShortNamesTests {
    let store: LocalStore
    let monday = calendarDay("2026-10-26")
    let grams = Measure(name: "g", quantity: 100, servings: 1)

    init() throws {
        store = try LocalStore(unsyncedAt: FileManager.default.temporaryDirectory.appending(path: "short-names-\(UUID().uuidString)/a.sqlite"))
    }

    func food(_ name: String, brand: String? = nil, id: String? = nil, energy: Double = 100) -> FoodSnapshot {
        FoodSnapshot(foodID: id, source: .openFoodFacts, name: name, brand: brand, nutrition: FoodNutrition(nutrients: [.energy: energy], baseGrams: 100, measures: [grams]))
    }

    func ingredient(_ food: FoodSnapshot) -> RecipeIngredient {
        RecipeIngredient(FoodPortion(food, serving: Serving(measure: grams, quantity: 50)))
    }

    var oats: FoodSnapshot { food("Organic Old-Fashioned Rolled Oats", brand: "365 Whole Foods Market", energy: 380) }
    var pepper: FoodSnapshot { food("Pepper, banana, raw", energy: 27) }
    var honey: FoodSnapshot { food("Honey", energy: 300) }
    var kefir: FoodSnapshot { food("Organic Kefir cultured lowfat milk", brand: "Lifeway", energy: 45) }

    func recipe(_ name: String, _ foods: [FoodSnapshot]) -> Recipe {
        var recipe = Recipe(name: name)
        recipe.ingredients = foods.map(ingredient)
        return recipe
    }

    func stored() throws -> [String: String] {
        try store.readBlocking { db in
            Dictionary(uniqueKeysWithValues: try FoodShortName.fetchAll(db).map { ($0.id, $0.name) })
        }
    }

    @Test func aSavedRecipesIngredientsAndAnAlteredEntrysFoodsGetAStoredShortName() async throws {
        let bowl = recipe("Oat bowl", [oats, pepper, honey])
        store.saveRecipe(bowl)
        let entry = FoodEntry(FoodPortion(bowl.snapshot), day: monday, minute: 8 * 60)
            .altered(to: bowl.ingredients.map(IngredientAlteration.init(kept:)) + [IngredientAlteration(food: kefir, original: nil, serving: Serving(measure: grams, quantity: 200))])
        try await store.write { [entry] db in try entry.insert(db) }.value
        let model = StubShortNameModel(answers: [
            oats.displayName: "rolled oats",
            "Pepper, banana, raw": "Banana pepper.",
            kefir.displayName: "Kefir cultured milk",
        ])
        let naming = FoodShortNaming(model: model)
        naming.start(store: store)
        await naming.idle()

        // Honey is short already; the kefir's three words are cut to two rather than dropped.
        #expect(Set(model.asked) == [oats.displayName, "Pepper, banana, raw", kefir.displayName])
        #expect(try stored() == [
            FoodShortName.rowID(for: oats): "Rolled oats", FoodShortName.rowID(for: pepper): "Banana pepper", FoodShortName.rowID(for: kefir): "Kefir milk",
        ])

        store.saveRecipe(recipe("Kefir oats", [oats, kefir, food("Chia seeds, dried", energy: 490)]))
        await naming.idle()
        #expect(model.asked.count == 4)
        #expect(model.asked.last == "Chia seeds, dried")
    }

    @Test func withoutTheModelNothingIsAskedAndTheLinesShowTwoWordsOfTheName() async throws {
        let bowl = recipe("Oat bowl", [oats, pepper])
        store.saveRecipe(bowl)
        store.log([FoodPortion(bowl.snapshot)], on: monday, minute: 8 * 60)
        let model = StubShortNameModel(isAvailable: false, answers: [oats.displayName: "Rolled oats"])
        let naming = FoodShortNaming(model: model)
        naming.start(store: store)
        await naming.idle()

        #expect(model.asked.isEmpty)
        #expect(try stored().isEmpty)
        let tile = try #require(try store.readBlocking(FoodEntry.recipeIngredients(on: monday).fetch).values.first)
        #expect(tile.lines.map(\.name) == ["Rolled Oats", "Pepper"])
    }

    @Test func theTileShowsTheStoredShortNameAndTheFoodsIconWhereTheSnapshotHasNone() async throws {
        var fusilli = Food(.openFoodFacts(barcode: "1"), name: "Protein Boost Fusilli no. 34", brand: "De Cecco", nutrition: oats.nutrition)
        fusilli.icon = "pasta"
        store.saveFood(fusilli)
        let added = FoodSnapshot(foodID: fusilli.id, source: .openFoodFacts, name: fusilli.name, brand: fusilli.brand, nutrition: fusilli.nutrition)
        let bowl = recipe("Oat bowl", [oats, honey])
        store.saveRecipe(bowl)
        let entry = FoodEntry(FoodPortion(bowl.snapshot), day: monday, minute: 8 * 60)
            .altered(to: bowl.ingredients.map(IngredientAlteration.init(kept:)) + [IngredientAlteration(food: added, original: nil, serving: Serving(measure: grams, quantity: 80))])
        try await store.write { [entry] db in
            try entry.insert(db)
            try FoodShortName(id: FoodShortName.rowID(for: added), name: "Fusilli").insert(db)
        }.value

        let tile = try #require(try store.readBlocking(FoodEntry.recipeIngredients(on: monday).fetch)[entry.id])
        #expect(tile.lines == [RecipeTileIngredients.Line(name: "Fusilli", emoji: FoodIconChoice.named("pasta")?.emoji, source: .openFoodFacts, change: .added)])
        #expect(tile.spoken == "Alterations: added Fusilli")
    }

    @Test func aShortNameIsOneOrTwoWordsInSentenceCase() {
        #expect(FoodShortName.cleaned("chia seeds") == "Chia seeds")
        #expect(FoodShortName.cleaned(" \"Coke Zero\". ") == "Coke Zero")
        #expect(FoodShortName.cleaned("Mixed Berry Yogurt") == "Berry Yogurt")
        #expect(FoodShortName.cleaned("  ") == nil)
        #expect(!FoodShortName.needsModel("Whey Protein"))
        #expect(FoodShortName.needsModel("Bananas, raw"))
        #expect(FoodShortName.needsModel("Organic Chia Seeds"))
    }

    /// The real model on food names as the owner logs them, when this simulator or device can run it (CI's simulators
    /// can't). The first 35 shaped the instructions; the last 20 were held out.
    @Test(.enabled(if: SystemLanguageModel.default.isAvailable))
    func theOnDeviceModelNamesFoodsInOneOrTwoWords() async throws {
        let model = OnDeviceFoodShortNameModel()
        let fitting: [(String, Set<String>)] = [
            ("Matcha latte with greens and probiotics By Boba Bros", ["Matcha latte", "Matcha"]),
            ("Organic Chia Seeds By Navitas Organics", ["Chia seeds"]),
            ("Organic Old-Fashioned Rolled Oats By 365 Whole Foods Market", ["Rolled oats", "Oats"]),
            ("Organic Kefir cultured lowfat milk By Lifeway", ["Kefir"]),
            ("Blueberries By Fruitist Jumbo", ["Blueberries"]),
            ("Pepper, banana, raw", ["Banana pepper", "Banana peppers"]),
            ("Chicken, broilers or fryers, breast, meat only, cooked, roasted", ["Chicken breast"]),
            ("Egg, Whole, Raw", ["Egg", "Eggs", "Whole egg"]),
            ("Whey Protein By Optimum Nutrition", ["Whey protein", "Whey"]),
            ("Cold Brew with Oat Milk By Chamberlain", ["Cold brew"]),
            ("Homemade Granola", ["Granola"]),
            ("Sourdough Bread", ["Sourdough", "Sourdough bread"]),
            ("Protein Boost Fusilli no. 34 By De Cecco", ["Fusilli", "Protein fusilli", "Protein pasta"]),
            ("Rice, white, long-grain, regular, enriched, cooked", ["White rice", "Rice"]),
            ("Oil, olive, salad or cooking", ["Olive oil"]),
            ("Beef, top sirloin, steak, separable lean and fat, trimmed to 1/8\" fat, choice, cooked, broiled", ["Sirloin steak", "Sirloin", "Steak", "Beef steak"]),
            ("Yogurt, Greek, plain, nonfat", ["Greek yogurt"]),
            ("Bananas, raw", ["Banana", "Bananas"]),
            ("Spinach, raw", ["Spinach"]),
            ("Pâte lentille corail By Carrefour", ["Lentil pasta", "Red lentil pasta"]),
            ("Peanut butter, smooth style, with salt", ["Peanut butter"]),
            ("Cheese, cheddar", ["Cheddar", "Cheddar cheese"]),
            ("Avocados, raw, all commercial varieties", ["Avocado", "Avocados"]),
            ("Sweet potato, cooked, baked in skin, flesh, without salt", ["Sweet potato"]),
            ("Almond Breeze Unsweetened Vanilla Almondmilk By Blue Diamond", ["Almond milk", "Almondmilk"]),
            ("Salmon, Atlantic, farmed, cooked, dry heat", ["Salmon"]),
            ("Joghurt Natur By Weihenstephan", ["Yogurt", "Plain yogurt"]),
            ("Fairlife Core Power Elite Chocolate", ["Protein shake", "Core Power"]),
            ("Quest Protein Bar Cookies & Cream", ["Protein bar"]),
            ("Butter, salted", ["Butter"]),
            ("Onions, raw", ["Onion", "Onions"]),
            ("Garlic, raw", ["Garlic"]),
            ("Tomatoes, red, ripe, raw, year round average", ["Tomato", "Tomatoes"]),
            ("Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D", ["Milk", "2% milk", "Reduced-fat milk"]),
            ("Extra Virgin Olive Oil By Kirkland Signature", ["Olive oil"]),
            ("Greek Nonfat Yogurt Vanilla By Chobani", ["Greek yogurt"]),
            ("Ground turkey, 93% lean, 7% fat, pan-broiled crumbles", ["Ground turkey"]),
            ("Strawberries, raw", ["Strawberries"]),
            ("Bagels, plain, enriched", ["Bagel", "Bagels"]),
            ("Hummus, commercial", ["Hummus"]),
            ("Coca-Cola Zero Sugar", ["Coke Zero", "Cola", "Diet cola", "Coca-Cola"]),
            ("Tortillas, ready-to-bake or -fry, flour", ["Flour tortilla", "Flour tortillas", "Tortillas", "Tortilla"]),
            ("Cottage cheese, lowfat, 2% milkfat", ["Cottage cheese"]),
            ("Nature Valley Crunchy Oats 'n Honey Granola Bars", ["Granola bar", "Granola bars"]),
            ("Broccoli, raw", ["Broccoli"]),
            ("Lettuce, cos or romaine, raw", ["Romaine", "Romaine lettuce"]),
            ("Syrups, maple", ["Maple syrup"]),
            ("Dave's Killer Bread 21 Whole Grains and Seeds", ["Bread", "Whole grain bread", "Seeded bread"]),
            ("Mozzarella di Bufala Campana DOP By Galbani", ["Mozzarella", "Buffalo mozzarella"]),
            ("Lindt Excellence 85% Cacao Dark Chocolate", ["Dark chocolate"]),
            ("Chicken thigh, boneless skinless", ["Chicken thigh", "Chicken thighs"]),
            ("Pasta, cooked, enriched, without added salt", ["Pasta"]),
            ("Oikos Pro Yogurt Drink Mixed Berry By Danone", ["Yogurt drink", "Protein yogurt", "Drinkable yogurt"]),
            ("Spices, cinnamon, ground", ["Cinnamon"]),
            ("Frozen mixed vegetables By Birds Eye", ["Mixed vegetables", "Vegetables"]),
        ]
        var answers: [String] = []
        var misses: [String] = []
        for (food, names) in fitting {
            let answer: String
            do {
                answer = try await model.shortName(for: food)
            } catch let error as NSError where answers.isEmpty && Self.modelManagerCannotServe(error) {
                // A GitHub runner's iOS 27.2 simulator reports the model available, then every request fails in the
                // model manager (error 1026), so the gate above cannot tell that it can't run.
                try Test.cancel("The on-device model is listed but cannot run here: \(error)")
            }
            let name = FoodShortName.cleaned(answer)
            answers.append("\(food): \(answer)")
            if !names.contains(where: { $0.caseInsensitiveCompare(name ?? "") == .orderedSame }) { misses.append(food) }
        }
        // Greedy sampling makes this repeatable. On macOS 27's model (2026-11-17) 48 of 55 fit, and the iOS 27 simulator
        // passed. The misses were Coke Zero as Soda, cottage cheese as Cottage, romaine as Lettuce, chicken thigh as
        // Chicken, the lentil pasta as Lentil pâté, cheddar as Cheese, and Core Power as Chocolate.
        #expect(misses.count <= 12, "\(misses.count) misses of \(fitting.count): \(answers.joined(separator: "; "))")
    }

    private static func modelManagerCannotServe(_ error: NSError) -> Bool {
        ([error] + error.underlyingErrors).contains { ($0 as NSError).domain == "ModelManagerServices.ModelManagerError" }
    }
}
