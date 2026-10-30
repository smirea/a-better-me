import Foundation
import Testing
@testable import App

private func nutrition(_ kcal: Double, grams: Double? = 100, milliliters: Double? = nil, _ measures: String) -> String {
    var fields = ["\"nutrients\":{\"k\":\(kcal)}"]
    if let grams { fields.append("\"baseGrams\":\(grams)") }
    if let milliliters { fields.append("\"baseMilliliters\":\(milliliters)") }
    fields.append("\"measures\":[\(measures)]")
    return "{\(fields.joined(separator: ","))}"
}

private let rambleCatalog: [(id: Int, name: String, prior: Double, nutrition: String)] = [
    (1, "Oats", 8, nutrition(389, #"{"name":"cup","quantity":1,"servings":0.81}"#)),
    (2, "Blueberries", 8, nutrition(57, #"{"name":"cup","quantity":1,"servings":1.48}"#)),
    (3, "Chia seeds", 8, nutrition(486, #"{"name":"g","quantity":100,"servings":1}"#)),
    (4, "Kefir", 8, nutrition(41, #"{"name":"cup","quantity":1,"servings":2.43}"#)),
    (5, "Bread, sourdough", 8, nutrition(265, #"{"name":"slice","quantity":1,"servings":0.29}"#)),
    (6, "Egg", 8, nutrition(143, #"{"name":"medium","quantity":1,"servings":0.44},{"name":"large","quantity":1,"servings":0.5}"#)),
    (7, "Milk", 8, nutrition(50, grams: nil, milliliters: 100, #"{"name":"cup","quantity":1,"servings":2.37}"#)),
    (8, "Peanut butter", 8, nutrition(588, #"{"name":"tbsp","quantity":1,"servings":0.16}"#)),
    (9, "Pizza, cheese", 8, nutrition(266, #"{"name":"slice","quantity":1,"servings":1.07}"#)),
    (10, "Pizza, pepperoni", 0, nutrition(298, #"{"name":"slice","quantity":1,"servings":1.11}"#)),
    (11, "Pizza, veggie", 0, nutrition(235, #"{"name":"slice","quantity":1,"servings":1.2}"#)),
]

private let today = calendarDay("2026-10-28")

/// The resolver over a fresh log and the fixture catalog, at 14:00 on `today`.
@MainActor
struct RambleResolverTests {
    let store: LocalStore

    init() throws {
        store = try LocalStore(unsyncedAt: FileManager.default.temporaryDirectory.appending(path: "ramble-\(UUID().uuidString)/a.sqlite"))
    }

    func resolver(context: RambleContext = RambleContext()) async throws -> RambleResolver {
        try await store.write { _ in }.value
        let search = try FoodSearch(store: store, catalog: try fixtureCatalog(rambleCatalog), branded: StubBranded())
        return RambleResolver(index: search.index, context: context, today: today, fallback: (today, 14 * 60))
    }

    func food(_ row: RambleRow) -> RambleRow.Food? {
        if case let .food(food) = row.content { food } else { nil }
    }

    /// "Oats: 0.5 cup" for a food row.
    func describe(_ rows: [RambleRow]) -> [String] {
        rows.map { row in
            switch row.content {
            case let .food(food): "\(food.pick.portion.food.name): \(NutritionFormat.serving(food.pick.portion.serving))"
            case let .copy(copy): "copy \(copy.meal.id): \(copy.entries.map(\.food.name).joined(separator: ", "))"
            case .searching: "searching \(row.item.name)"
            case .unmatched: "unmatched \(row.item.name)"
            }
        }
    }

    @Test func withoutSearchANewFoodWaitsAndARenamedOneKeepsItsMatchAtTheNewAmount() async throws {
        let resolver = try await resolver()
        let first = try resolver.rows([RambleItem(name: "oats", amount: 1, unit: "cup"), RambleItem(name: "pear")], previous: [], choices: [:])
        let parsed = try resolver.rows([
            RambleItem(name: "rolled oats", amount: 0.5, unit: "cup"),
            RambleItem(name: "dates", amount: 3),
            RambleItem(name: "egg", amount: 2),
        ], previous: first, choices: [:], search: false)
        #expect(describe(parsed) == ["Oats: 0.5 cup", "searching dates", "searching egg"])
    }

    @Test func spokenAmountsBecomeServingsInTheFoodsOwnMeasures() async throws {
        let resolver = try await resolver()
        let rows = try resolver.rows([
            RambleItem(name: "oats", amount: 0.5, unit: "cup"),
            RambleItem(name: "blueberries", amount: 50, unit: "g"),
            RambleItem(name: "chia seeds", amount: 2, unit: "tbsp"),
            RambleItem(name: "kefir", amount: 200, unit: "ml"),
            RambleItem(name: "sourdough", amount: 2, unit: "slices"),
            RambleItem(name: "egg", amount: 2, unit: ""),
            RambleItem(name: "milk", amount: 250, unit: "ml"),
            RambleItem(name: "peanut butter", amount: 1, unit: "tablespoon"),
            RambleItem(name: "oats", amount: 0.2, unit: "kg"),
            RambleItem(name: "egg", amount: 1, unit: "egg"),
            RambleItem(name: "blueberries"),
            RambleItem(name: "oats", amount: 2, unit: "tbsp"),
        ], previous: [], choices: [:])
        #expect(describe(rows) == [
            "Oats: 0.5 cup",
            "Blueberries: 50 g",
            // Only weighed, so water's density stands in: 2 tbsp is 29.57 mL.
            "Chia seeds: 29.57 g",
            // A volume the food has no measure for stays in the spoken unit, sized from its cup.
            "Kefir: 200 mL",
            "Bread, sourdough: 2 slice",
            "Egg: 2 medium",
            "Milk: 250 mL",
            "Peanut butter: 1 tbsp",
            "Oats: 200 g",
            "Egg: 1 medium",
            "Blueberries: 1 cup",
            "Oats: 2 tbsp",
        ])
        if case let .food(oats) = rows[11].content { #expect(abs(oats.pick.portion.serving.servings - 0.81 * 2 / 16) < 0.0001) }
        #expect(rows.map(\.id) == Array(0..<12))
        #expect(rows.allSatisfy { $0.day == today && $0.minute == 14 * 60 })
    }

    @Test func aSpokenAmountCountsTheMeasuresUnitNotItsReferenceSize() {
        let drink = FoodNutrition(nutrients: [.energy: 40], measures: [Measure(name: "mL", quantity: 100, servings: 1)])
        let cereal = FoodNutrition(nutrients: [.energy: 110], measures: [Measure(name: "cup", quantity: 0.5, servings: 1)])
        let bread = FoodNutrition(nutrients: [.energy: 160], measures: [Measure(name: "slices", quantity: 2, servings: 1)])
        let mL = RambleServing.serving(amount: 250, unit: "ml", of: drink, history: nil)
        let cup = RambleServing.serving(amount: 1, unit: "cup", of: cereal, history: nil)
        let slices = RambleServing.serving(amount: 3, unit: "slice", of: bread, history: nil)
        #expect([mL.quantity, mL.servings] == [250, 2.5])
        #expect([cup.quantity, cup.servings] == [1, 2])
        #expect([slices.quantity, slices.servings] == [3, 1.5])
    }

    @Test func theOwnersPickHoldsWhenALaterReadAddsARefToAnotherFood() async throws {
        let yogurt = FoodSnapshot(source: .custom, name: "Greek Yogurt", nutrition: FoodNutrition(nutrients: [.energy: 100], measures: [Measure(name: "container", quantity: 1, servings: 1)]))
        let entry = FoodEntry(FoodPortion(yogurt), day: today.adding(days: -1), minute: 8 * 60)
        let resolver = try await resolver(context: RambleContext(entries: [entry], today: today))
        let first = try resolver.rows([RambleItem(name: "pizza", amount: 1, unit: "slice")], previous: [], choices: [:])
        let veggie = try #require(food(first[0])?.options.first { $0.portion.food.name == "Pizza, veggie" })
        let choices = [0: RambleChoice(name: "pizza", option: veggie.key)]
        let picked = try resolver.rows([RambleItem(name: "pizza", amount: 1, unit: "slice")], previous: first, choices: choices)
        let reffed = try resolver.rows([RambleItem(name: "pizza", amount: 2, unit: "slice", ref: entry.key)], previous: picked, choices: choices)
        #expect(describe(reffed) == ["Pizza, veggie: 2 slice"])
    }

    @Test func aFoodWithoutAnAmountTakesItsLatestServingFromHistory() async throws {
        let oats = try fixtureCatalog(rambleCatalog).foods([1])[1]!.snapshot
        store.log([FoodPortion(oats, serving: Serving(measure: oats.nutrition.measures[0], quantity: 0.75))], on: today.adding(days: -2), minute: 480)
        let rows = try await resolver().rows([RambleItem(name: "oats"), RambleItem(name: "oats", amount: 2, unit: "")], previous: [], choices: [:])
        #expect(describe(rows) == ["Oats: 0.75 cup", "Oats: 2 cup"])
    }

    @Test func aRefReusesTheLoggedEntryAndANewAmountRescalesIt() async throws {
        let pancake = FoodSnapshot(source: .custom, name: "Protein Pancake", nutrition: FoodNutrition(nutrients: [.energy: 120], baseGrams: 60, measures: [Measure(name: "pancake", quantity: 1, servings: 1)]))
        let entry = FoodEntry(FoodPortion(pancake, serving: Serving(measure: pancake.nutrition.measures[0], quantity: 3)), day: today.adding(days: -1), minute: 9 * 60)
        let context = RambleContext(entries: [entry], today: today)
        let rows = try await resolver(context: context).rows([
            RambleItem(name: "pancakes", ref: entry.key),
            RambleItem(name: "pancakes", amount: 2, unit: "", ref: entry.key, meal: .breakfast),
            RambleItem(name: "pancakes", amount: 120, unit: "g", ref: entry.key),
        ], previous: [], choices: [:])
        #expect(describe(rows) == ["Protein Pancake: 3 pancake", "Protein Pancake: 2 pancake", "Protein Pancake: 120 g"])
        #expect(rows[1].minute == 8 * 60)
    }

    @Test func aCopyLogsTheMealsEntriesExceptTheOnesLeftOutAtTheirPlacement() async throws {
        let yogurt = FoodSnapshot(source: .custom, name: "Greek Yogurt", nutrition: FoodNutrition(nutrients: [.energy: 100], measures: [Measure(name: "container", quantity: 1, servings: 1)]))
        let banana = FoodSnapshot(source: .custom, name: "Banana", nutrition: FoodNutrition(nutrients: [.energy: 105], measures: [Measure(name: "medium", quantity: 1, servings: 1)]))
        let yesterday = today.adding(days: -1)
        let entries = [
            FoodEntry(FoodPortion(yogurt), day: yesterday, minute: 8 * 60 + 5),
            FoodEntry(FoodPortion(banana, serving: Serving(measure: banana.nutrition.measures[0], quantity: 2)), day: yesterday, minute: 8 * 60 + 10),
        ]
        let context = RambleContext(entries: entries, today: today)
        let meal = "\(yesterday)-breakfast"
        let resolver = try await resolver(context: context)
        let rows = try resolver.rows([
            RambleItem(kind: .copy, copy: meal, meal: .breakfast),
            RambleItem(kind: .copy, copy: meal, except: [entries[1].key], day: -1, minute: 7 * 60),
            RambleItem(kind: .copy, copy: meal),
            RambleItem(kind: .copy, copy: "2026-01-01-lunch"),
        ], previous: [], choices: [:])
        #expect(describe(rows) == ["copy \(meal): Greek Yogurt, Banana", "copy \(meal): Greek Yogurt", "copy \(meal): Greek Yogurt, Banana", "unmatched "])
        let planned = rows.map { $0.planned.map { "\($0.pick.portion.food.name) \($0.day) \($0.minute) \($0.pick.portion.serving.quantity)" } }
        #expect(planned == [
            ["Greek Yogurt 2026-10-28 480 1.0", "Banana 2026-10-28 480 2.0"],
            ["Greek Yogurt 2026-10-27 420 1.0"],
            // No time or meal: each food keeps its own minute.
            ["Greek Yogurt 2026-10-28 485 1.0", "Banana 2026-10-28 490 2.0"],
            [],
        ])
    }

    @Test func aNameThatIsAnOptionOnScreenPicksItAndKeepsTheList() async throws {
        let resolver = try await resolver()
        let first = try resolver.rows([RambleItem(name: "pizza", amount: 2, unit: "slice")], previous: [], choices: [:])
        #expect(food(first[0])?.options.map(\.portion.food.name) == ["Pizza, cheese", "Pizza, veggie", "Pizza, pepperoni"])
        #expect(food(first[0])?.pick.portion.food.name == "Pizza, cheese")

        let asked = try resolver.rows([RambleItem(name: "pizza", amount: 2, unit: "slice", options: true)], previous: first, choices: [:])
        #expect(food(asked[0])?.showsOptions == true)

        let picked = try resolver.rows([RambleItem(name: "Pizza, pepperoni", amount: 2, unit: "slice")], previous: asked, choices: [:])
        #expect(describe(picked) == ["Pizza, pepperoni: 2 slice"])
        #expect(food(picked[0])?.options == food(first[0])?.options)
        #expect(food(picked[0])?.showsOptions == false)
    }

    @Test func theOwnersPickAndServingHoldWhileTheRowKeepsItsName() async throws {
        let resolver = try await resolver()
        let first = try resolver.rows([RambleItem(name: "pizza", amount: 1, unit: "slice")], previous: [], choices: [:])
        let veggie = try #require(food(first[0])?.options.first { $0.portion.food.name == "Pizza, veggie" })
        let slice = veggie.portion.food.nutrition.measures[0]
        var choices = [0: RambleChoice(name: "pizza", option: veggie.key)]
        let picked = try resolver.rows([RambleItem(name: "pizza", amount: 1, unit: "slice")], previous: first, choices: choices)
        #expect(describe(picked) == ["Pizza, veggie: 1 slice"])

        choices[0]?.serving = Serving(measure: slice, quantity: 3)
        let grown = try resolver.rows([RambleItem(name: "pizza", amount: 1, unit: "slice"), RambleItem(name: "kefir", amount: 1, unit: "cup")], previous: picked, choices: choices)
        #expect(describe(grown) == ["Pizza, veggie: 3 slice", "Kefir: 1 cup"])

        let renamed = try resolver.rows([RambleItem(name: "pepperoni pizza", amount: 1, unit: "slice")], previous: grown, choices: choices)
        #expect(describe(renamed) == ["Pizza, pepperoni: 1 slice"])

        let removed = try resolver.rows(
            [RambleItem(name: "pizza", amount: 1, unit: "slice"), RambleItem(name: "kefir", amount: 1, unit: "cup")],
            previous: grown, choices: [0: RambleChoice(name: "pizza", removed: true)]
        )
        #expect(removed.map(\.id) == [1])

        // A serving set on the veggie pizza never moves to the food a fresh search puts first.
        let lost = [0: RambleChoice(name: "pizza", option: "gone", serving: Serving(measure: slice, quantity: 3))]
        #expect(describe(try resolver.rows([RambleItem(name: "pizza", amount: 1, unit: "slice")], previous: [], choices: lost)) == describe(first))
    }

    @Test func rowsKeepTheirPositionAndPickAsTheRambleGrowsAndCorrects() async throws {
        let resolver = try await resolver()
        let first = try resolver.rows([RambleItem(name: "oats", amount: 1, unit: "cup")], previous: [], choices: [:])
        let grown = try resolver.rows([
            RambleItem(name: "oats", amount: 1, unit: "cup"), RambleItem(name: "blueberries", amount: 50, unit: "g"),
        ], previous: first, choices: [:])
        #expect(grown[0] == first[0])
        let corrected = try resolver.rows([
            RambleItem(name: "oats", amount: 0.5, unit: "cup"), RambleItem(name: "blueberries", amount: 50, unit: "g"),
        ], previous: grown, choices: [:])
        #expect(describe(corrected) == ["Oats: 0.5 cup", "Blueberries: 50 g"])
        #expect(corrected.map(\.id) == [0, 1])
        #expect(corrected[1] == grown[1])
    }

    @Test func aSaidDayMealOrTimePlacesTheRow() async throws {
        let rows = try await resolver().rows([
            RambleItem(name: "oats", meal: .breakfast),
            RambleItem(name: "oats", day: -1, meal: .dinner),
            RambleItem(name: "oats", meal: .lunch, minute: 13 * 60 + 15),
            RambleItem(name: "oats", meal: .snack),
            RambleItem(name: "nothing like it"),
        ], previous: [], choices: [:])
        #expect(rows.map { "\($0.day) \($0.minute ?? -1)" } == ["2026-10-28 480", "2026-10-27 1140", "2026-10-28 795", "2026-10-28 930", "2026-10-28 840"])
        #expect(describe([rows[4]]) == ["unmatched nothing like it"])
    }

    @Test func aFoodWithNothingSaidGoesToTheLoggersChosenHour() async throws {
        let base = try await resolver()
        let chosen = RambleResolver(index: base.index, context: base.context, today: today, fallback: (today.adding(days: -2), 9 * 60))
        let rows = try chosen.rows([
            RambleItem(name: "oats"),
            RambleItem(name: "oats", meal: .dinner),
            RambleItem(name: "oats", day: 0),
        ], previous: [], choices: [:])
        // A said meal keeps the logger's day; a said "today" overrides it.
        #expect(rows.map { "\($0.day) \($0.minute ?? -1)" } == ["2026-10-26 540", "2026-10-26 1140", "2026-10-28 540"])
    }

    @Test func aRemovedCopyDoesNotHideADifferentMealSaidInItsPlace() async throws {
        let yogurt = FoodSnapshot(source: .custom, name: "Greek Yogurt", nutrition: FoodNutrition(nutrients: [.energy: 100], measures: [Measure(name: "container", quantity: 1, servings: 1)]))
        let yesterday = today.adding(days: -1)
        let entries = [FoodEntry(FoodPortion(yogurt), day: yesterday, minute: 8 * 60), FoodEntry(FoodPortion(yogurt), day: yesterday, minute: 12 * 60)]
        let resolver = try await resolver(context: RambleContext(entries: entries, today: today))
        let breakfast = RambleItem(kind: .copy, copy: "\(yesterday)-breakfast")
        let removed = [0: RambleChoice(name: breakfast.identity, removed: true)]
        #expect(try resolver.rows([breakfast], previous: [], choices: removed).isEmpty)
        let lunch = try resolver.rows([RambleItem(kind: .copy, copy: "\(yesterday)-lunch")], previous: [], choices: removed)
        #expect(describe(lunch) == ["copy \(yesterday)-lunch: Greek Yogurt"])
    }
}

@MainActor
struct RambleLoggingTests {
    @Test func eachPlannedFoodIsLoggedAtItsOwnDayAndMinute() async throws {
        let store = try LocalStore(unsyncedAt: FileManager.default.temporaryDirectory.appending(path: "ramble-log-\(UUID().uuidString)/a.sqlite"))
        let oats = FoodPortion(.quickAdd([.energy: 150], name: "Oats"))
        let kefir = FoodPortion(.quickAdd([.energy: 100], name: "Kefir"))
        store.log([(oats, day: today, minute: 480), (kefir, day: today.adding(days: -1), minute: 1140)])
        try await store.write { _ in }.value
        let logged = try store.read(FoodEntry.between(today.adding(days: -1), today).fetch)
        #expect(logged.map { "\($0.food.name) \($0.day) \($0.minute)" } == ["Kefir 2026-10-27 1140", "Oats 2026-10-28 480"])
    }
}
