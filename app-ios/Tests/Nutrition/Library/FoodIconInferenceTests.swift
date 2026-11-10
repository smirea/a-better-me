import Foundation
import FoundationModels
import GRDB
import Testing
@testable import App

/// Answers from a fixed table and records what it was asked.
final class StubIconModel: FoodIconModel, @unchecked Sendable {
    let isAvailable: Bool
    let answers: [String: String]
    private(set) var asked: [String] = []

    init(isAvailable: Bool = true, answers: [String: String]) {
        self.isAvailable = isAvailable
        self.answers = answers
    }

    func icon(for food: String) async throws -> String {
        asked.append(food)
        guard let answer = answers[food] else { throw CancellationError() }
        return answer
    }
}

@MainActor
struct FoodIconInferenceTests {
    let store: LocalStore
    let monday = calendarDay("2026-10-26")

    init() throws {
        store = try LocalStore(unsyncedAt: FileManager.default.temporaryDirectory.appending(path: "icons-\(UUID().uuidString)/a.sqlite"))
    }

    func food(_ name: String, brand: String? = nil, icon: String? = nil, barcode: String) -> Food {
        var food = Food(.openFoodFacts(barcode: barcode), name: name, brand: brand, nutrition: yogurt.nutrition)
        food.icon = icon
        return food
    }

    func icons() throws -> [String: String?] {
        try store.readBlocking { db in
            Dictionary(uniqueKeysWithValues: try Food.fetchAll(db).map { ($0.id, $0.icon) })
        }
    }

    @Test func onlyFoodsThatWouldDrawTheSourceSymbolAreAskedAndTheirIconIsStored() async throws {
        let fusilli = food("Protein Boost Fusilli no. 34", brand: "De Cecco", barcode: "1")
        store.saveFood(fusilli)
        store.saveFood(food("Greek Yogurt", barcode: "2"))
        store.saveFood(food("Mystery bar", icon: "candy", barcode: "3"))
        store.saveFood(food("Zesty", barcode: "4"))
        let model = StubIconModel(answers: ["Protein Boost Fusilli no. 34 By De Cecco": "pasta", "Zesty": "not-an-icon"])
        let inference = FoodIconInference(model: model)
        inference.start(store: store)
        await inference.idle()

        #expect(model.asked.sorted() == ["Protein Boost Fusilli no. 34 By De Cecco", "Zesty"])
        #expect(try icons() == ["off-1": "pasta", "off-2": nil, "off-3": "candy", "off-4": nil])

        store.saveFood(food("Rigatoni no. 24", brand: "De Cecco", barcode: "5"))
        await inference.idle()
        #expect(model.asked.count == 3)
        #expect(try icons()["off-4"] == .some(nil))
    }

    @Test func withoutTheModelNothingIsAskedOrWritten() async throws {
        store.saveFood(food("Protein Boost Fusilli no. 34", barcode: "1"))
        let model = StubIconModel(isAvailable: false, answers: ["Protein Boost Fusilli no. 34": "pasta"])
        let inference = FoodIconInference(model: model)
        inference.start(store: store)
        await inference.idle()

        #expect(model.asked.isEmpty)
        #expect(try icons() == ["off-1": nil])
    }

    @Test func theIconReachesSnapshotsWithoutOneAndKeepsTheirOrder() async throws {
        let fusilli = food("Protein Boost Fusilli no. 34", brand: "De Cecco", barcode: "1")
        let chosen = FoodSnapshot(foodID: fusilli.id, source: .openFoodFacts, name: fusilli.name, icon: "noodles", nutrition: fusilli.nutrition)
        store.saveFood(fusilli)
        store.log([FoodPortion(fusilli.snapshot), FoodPortion(chosen), FoodPortion(yogurt)], on: monday, minute: 12 * 60)
        store.addFavorite(FoodPortion(fusilli.snapshot))
        var recipe = Recipe(name: "Pasta salad")
        recipe.ingredients = [RecipeIngredient(FoodPortion(fusilli.snapshot)), RecipeIngredient(FoodPortion(yogurt))]
        store.saveRecipe(recipe)
        try await store.write { _ in }.value
        let before = try store.readBlocking(FoodEntry.on(monday).fetch)

        store.setInferredIcon("pasta", forFood: fusilli.id)
        store.setInferredIcon("cereal", forFood: fusilli.id)
        try await store.write { _ in }.value

        let entries = try store.readBlocking(FoodEntry.on(monday).fetch)
        #expect(entries.map { $0.food.icon ?? "none" }.sorted() == ["noodles", "none", "pasta"].sorted())
        #expect(Set(entries.map { "\($0.id) \(Instant.text($0.updatedAt))" }) == Set(before.map { "\($0.id) \(Instant.text($0.updatedAt))" }))
        #expect(try store.readBlocking { try FoodFavorite.fetchAll($0) }.map(\.food.icon) == ["pasta"])
        #expect(try store.readBlocking { try Recipe.fetchOne($0, key: recipe.key) }?.ingredients.map(\.food.icon) == ["pasta", nil])
        #expect(try icons() == ["off-1": "pasta"])

        store.saveFood(food("Protein Boost Fusilli no. 34", brand: "De Cecco", barcode: "1"))
        try await store.write { _ in }.value
        #expect(try icons() == ["off-1": "pasta"])
    }

    /// The real model on names the keywords miss, when this simulator or device can run it (CI's simulators can't).
    /// The first 23 names shaped the instructions; the last 10 were held out.
    @Test(.enabled(if: SystemLanguageModel.default.isAvailable))
    func theOnDeviceModelPicksAFittingIcon() async throws {
        let model = OnDeviceFoodIconModel()
        let fitting: [(String, Set<String>)] = [
            ("Protein Boost Fusilli no. 34 By De Cecco", ["pasta"]),
            ("Orecchiette By Barilla", ["pasta"]),
            ("Gnocchi", ["pasta", "dumpling", "potato"]),
            ("Quest Protein Bar", ["cereal", "candy", "chocolate", "protein-shake"]),
            ("Clif Builders By Clif", ["cereal", "candy", "chocolate", "protein-shake"]),
            ("Sprite Zero", ["smoothie"]),
            ("Red Bull", ["smoothie"]),
            ("Gatorade", ["smoothie", "juice", "water"]),
            ("Kombucha", ["tea", "juice", "smoothie"]),
            ("Fairlife Core Power", ["protein-shake", "milk"]),
            ("Skyr By Siggi's", ["milk", "cheese"]),
            ("Halloumi", ["cheese"]),
            ("Tzatziki", ["milk", "cucumber"]),
            ("Quinoa, cooked", ["rice", "cereal"]),
            ("Couscous", ["rice", "pasta", "cereal"]),
            ("Tempeh", ["beans"]),
            ("Zucchini, raw", ["cucumber"]),
            ("Asparagus", ["leafy-greens", "broccoli", "cucumber"]),
            ("Kimchi", ["leafy-greens", "salad", "hot-pepper"]),
            ("Prosciutto di Parma", ["meat", "bacon"]),
            ("Pho", ["noodles", "soup", "stew"]),
            ("Pierogi", ["dumpling"]),
            ("Sriracha", ["hot-pepper"]),
            ("Farro", ["rice", "cereal"]),
            ("Bulgur", ["rice", "cereal"]),
            ("Chorizo", ["meat"]),
            ("Monster Energy", ["smoothie"]),
            ("Pringles Original", ["fries", "potato", "popcorn"]),
            ("Nutella", ["chocolate"]),
            ("Mochi", ["rice-ball", "dumpling", "candy"]),
            ("Bresaola", ["beef", "meat"]),
            ("Seitan", ["meat", "beans"]),
            ("Dal makhani", ["beans", "curry", "stew"]),
            ("Pâte lentille corail By Fusilli", ["pasta", "beans"]),
            ("Joghurt Natur By Weihenstephan", ["milk"]),
            ("Pane integrale", ["bread"]),
        ]
        var answers: [String] = []
        var misses: [String] = []
        for (name, icons) in fitting {
            #expect(FoodIconChoice.mentioned(in: name) == nil, "\(name) has a keyword icon, so it is never asked")
            let icon = try await model.icon(for: name)
            answers.append("\(name): \(icon)")
            if !icons.contains(icon) { misses.append(name) }
        }
        // Greedy sampling makes this repeatable. On iOS 27.0 (2026-11-10) 29 of the first 33 fit; the misses were
        // tzatziki as smoothie, tempeh as cereal, pho as meat, and chorizo as beef. Of the foreign names, the lentil pasta
        // drew leafy-greens, and telling the model names come in any language made it worse (7 misses).
        #expect(misses.count <= 5, "\(misses.count) misses of \(fitting.count): \(answers.joined(separator: "; "))")
    }
}
