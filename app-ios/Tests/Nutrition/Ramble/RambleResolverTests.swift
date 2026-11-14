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
        let search = try await FoodSearch.load(store: store, catalog: try fixtureCatalog(rambleCatalog), branded: StubBranded())
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
            case let .copy(copy): "copy \(copy.meal.id): \(copy.kept.map(\.entry.food.name).joined(separator: ", "))"
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
        let renamed = try resolver.rows([RambleItem(name: "pizza", amount: 2, unit: "slice")], previous: try resolver.rows(
            [RambleItem(name: "pizza veggie", amount: 1, unit: "slice")], previous: [], choices: [:]
        ), choices: [:])
        #expect(describe(renamed) == ["Pizza, veggie: 2 slice"])
        var online = resolver
        online.online = ["bok choy": try resolver.index.local("milk")]
        let found = try online.rows([RambleItem(name: "Bok choy", amount: 1, unit: "cup")], previous: [], choices: [:])
        #expect(describe(found) == ["Milk: 1 cup"])
        let unmatched = try resolver.rows([RambleItem(name: "bok choy", amount: 1, unit: "cup")], previous: [], choices: [:])
        let again = try resolver.rows([RambleItem(name: "bok choy", amount: 2, unit: "cup")], previous: unmatched, choices: [:], search: false)
        #expect(describe(again) == ["unmatched bok choy"])
    }

    @Test func aNameThatGrowsMidSentenceIsSearchedAgainAfterTheRowHeldItsOldMatch() async throws {
        let resolver = try await resolver()
        let partial = try resolver.rows([RambleItem(name: "pizza", amount: 1, unit: "slice")], previous: [], choices: [:])
        let held = try resolver.rows([RambleItem(name: "pizza pepperoni", amount: 1, unit: "slice")], previous: partial, choices: [:], search: false)
        #expect(describe(held) == ["Pizza, cheese: 1 slice"])
        let searched = try resolver.rows([RambleItem(name: "pizza pepperoni", amount: 1, unit: "slice")], previous: held, choices: [:])
        #expect(describe(searched) == ["Pizza, pepperoni: 1 slice"])
    }

    @Test func aServingMenuOffersHalfToDoubleTheFoodsServingsAnd100Grams() async throws {
        let resolver = try await resolver()
        let rows = try resolver.rows([RambleItem(name: "oats", amount: 0.5, unit: "cup")], previous: [], choices: [:])
        guard case let .food(food) = rows[0].content else { Issue.record("no oats"); return }
        let choices = RambleServing.choices(food.pick.portion.serving, of: food.pick.portion.food.nutrition)
        #expect(choices.map { NutritionFormat.serving($0) } == ["0.25 cup", "0.5 cup", "0.75 cup", "1 cup", "100 g"])
    }

    @Test func eachNewHourOrDayStartsASection() {
        let row = { (key: Int, day: String, minute: Int?) in
            RambleRow(id: key, item: RambleItem(name: "x"), day: calendarDay(day), minute: minute, content: .unmatched, key: key)
        }
        let headers = RambleTab.headers([
            row(1, "2026-10-28", 8 * 60), row(2, "2026-10-28", 8 * 60 + 30), row(3, "2026-10-28", 12 * 60 + 30),
            row(4, "2026-10-27", 19 * 60), row(5, "2026-10-27", nil),
        ], today: today)
        #expect(headers == [1: "8 AM", 3: "12 PM", 4: "Yesterday · 7 PM", 5: "Yesterday · Their own times"])
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
            // Only weighed, so water's density stands in: 2 tbsp is 29.57 mL, shown to the gram.
            "Chia seeds: 30 g",
            // A volume the food has no measure for stays in the spoken unit, sized from its cup.
            "Kefir: 200 mL",
            "Bread, sourdough: 2 slice",
            "Egg: 2 medium",
            "Milk: 250 mL",
            "Peanut butter: 1 tbsp",
            "Oats: 0.2 kg",
            "Egg: 1 medium",
            "Blueberries: 1 cup",
            "Oats: 2 tbsp",
        ])
        guard case let .food(oats) = rows[11].content else { Issue.record("Oats is not a food row"); return }
        #expect(abs(oats.pick.portion.serving.servings - 0.10125) < 0.0001)
        #expect(rows.map(\.id) == Array(0..<12))
        #expect(rows.allSatisfy { $0.day == today && $0.minute == 14 * 60 })
    }

    @Test func aSpokenAmountCountsTheMeasuresUnitNotItsReferenceSize() {
        let drink = FoodNutrition(nutrients: [.energy: 40], measures: [Measure(name: "mL", quantity: 100, servings: 1)])
        let cereal = FoodNutrition(nutrients: [.energy: 110], measures: [Measure(name: "cup", quantity: 0.5, servings: 1)])
        let bread = FoodNutrition(nutrients: [.energy: 160], measures: [Measure(name: "slices", quantity: 2, servings: 1)])
        let mL = RambleServing.serving(amount: 250, unit: "ml", food: "drink", of: drink, history: nil)
        let cup = RambleServing.serving(amount: 1, unit: "cup", food: "cereal", of: cereal, history: nil)
        let slices = RambleServing.serving(amount: 3, unit: "slice", food: "bread", of: bread, history: nil)
        #expect([mL.quantity, mL.servings] == [250, 2.5])
        #expect([cup.quantity, cup.servings] == [1, 2])
        #expect([slices.quantity, slices.servings] == [3, 1.5])
    }

    @Test func aCountOfTheFoodItselfTakesAMeasureNamedForItElseAWholeSize() {
        let apricots = FoodNutrition(nutrients: [.energy: 48], baseGrams: 100, measures: [
            Measure(name: "cup, halves", quantity: 1, servings: 1.55), Measure(name: "apricot", quantity: 1, servings: 0.35),
        ])
        let shallots = FoodNutrition(nutrients: [.energy: 72], baseGrams: 100, measures: [
            Measure(name: "tbsp chopped", quantity: 1, servings: 0.1), Measure(name: "medium", quantity: 1, servings: 0.28),
        ])
        let rice = FoodNutrition(nutrients: [.energy: 130], baseGrams: 100, measures: [Measure(name: "cup", quantity: 1, servings: 1.58)])
        let raspberries = FoodNutrition(nutrients: [.energy: 52], baseGrams: 100, measures: [
            Measure(name: "cup", quantity: 1, servings: 1.23), Measure(name: "raspberries", quantity: 10, servings: 0.19),
        ])
        let ten = RambleServing.serving(amount: 10, unit: "", food: "raspberries", of: raspberries, history: nil)
        #expect(NutritionFormat.serving(ten) == "10 raspberries")
        #expect(abs(ten.servings - 0.19) < 0.0001)
        let serving = { (food: String, nutrition: FoodNutrition) in
            NutritionFormat.serving(RambleServing.serving(amount: 2, unit: "", food: food, of: nutrition, history: nil))
        }
        #expect([serving("apricots", apricots), serving("shallots", shallots), serving("rice", rice)] == ["2 apricot", "2 medium", "2 cup"])
    }

    @Test func aCountedContainerIsThePackageInTheSpeakersWord() {
        let tomatoes = FoodNutrition(nutrients: [.energy: 22], baseGrams: 100, measures: [
            Measure(name: "g", quantity: 100, servings: 1), Measure(name: "package", quantity: 1, servings: 7.94),
        ])
        let can = RambleServing.serving(amount: 1, unit: "can", food: "San Marzano tomatoes", of: tomatoes, history: nil)
        #expect(NutritionFormat.serving(can) == "1 can")
        #expect(abs(can.servings - 7.94) < 0.0001)
        let unsized = FoodNutrition(nutrients: [.energy: 22], baseGrams: 100, measures: [Measure(name: "g", quantity: 100, servings: 1)])
        #expect(NutritionFormat.serving(RambleServing.serving(amount: 1, unit: "can", food: "tomatoes", of: unsized, history: nil)) == "100 g")
        #expect(RambleServing.sizes("cans", of: tomatoes) && !RambleServing.sizes("can", of: unsized) && !RambleServing.sizes("g", of: tomatoes))
    }

    @Test func aSpokenSpoonTakesTheFoodsOtherSpoonWithItsQualifier() {
        let oregano = FoodNutrition(nutrients: [.energy: 265], baseGrams: 100, measures: [
            Measure(name: "tsp, leaves", quantity: 1, servings: 0.01), Measure(name: "tsp, ground", quantity: 1, servings: 0.018),
        ])
        let tbsp = RambleServing.serving(amount: 2, unit: "tbsp", food: "oregano", of: oregano, history: nil)
        #expect(NutritionFormat.serving(tbsp) == "2 tbsp, leaves")
        #expect(abs(tbsp.servings - 0.06) < 0.0001)
    }

    @Test func aCanOfABrandedFoodPrefersAProductThatKnowsItsCan() async throws {
        let product = { (barcode: String, brand: String, measures: [Measure]) in
            Food(.openFoodFacts(barcode: barcode), name: "San marzano tomatoes", brand: brand,
                 nutrition: FoodNutrition(nutrients: [.energy: 22], baseGrams: 100, measures: measures))
        }
        let gram = Measure(name: "g", quantity: 100, servings: 1)
        let branded = StubBranded(hits: [
            product("0072368425184", "DeLallo", [gram]),
            product("0070796400179", "Cento", [gram, Measure(name: "package", quantity: 1, servings: 7.94)]),
            product("0800091000848", "", [gram]),
        ])
        try await store.write { _ in }.value
        let search = try await FoodSearch.load(store: store, catalog: try fixtureCatalog(rambleCatalog), branded: branded)
        var resolver = RambleResolver(index: search.index, context: RambleContext(), today: today, fallback: (today, 14 * 60))
        resolver.online = ["san marzano tomatoes": try await search.search("San Marzano tomatoes", branded: true).filter { $0.group == .branded }]
        let rows = try resolver.rows([
            RambleItem(name: "San Marzano tomatoes", amount: 1, unit: "can"),
            RambleItem(name: "San Marzano tomatoes", amount: 200, unit: "g", day: -1),
        ], previous: [], choices: [:])
        #expect(rows.compactMap { food($0) }.map { "\($0.pick.portion.food.brand ?? ""): \(NutritionFormat.serving($0.pick.portion.serving))" } == [
            "Cento: 1 can", "DeLallo: 200 g",
        ])
        // Heard mid-sentence as "San Marzano", the name grows into the unbranded product's own name; that is no pick.
        var partial = resolver
        partial.online = ["san marzano": resolver.online["san marzano tomatoes"]!]
        let first = try partial.rows([RambleItem(name: "San Marzano", amount: 1, unit: "can")], previous: [], choices: [:])
        let grown = try partial.rows([RambleItem(name: "San Marzano tomatoes", amount: 1, unit: "can")], previous: first, choices: [:])
        #expect(grown.compactMap { food($0) }.map { "\($0.pick.portion.food.brand ?? ""): \(NutritionFormat.serving($0.pick.portion.serving))" } == ["Cento: 1 can"])
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

    @Test func theOwnersLatestFoodHoldingEverySpokenWordBeatsGenericOnesUnlessABrandOrKindIsSaid() async throws {
        let generic = try fixtureCatalog(rambleCatalog).foods([1, 7])
        let grams = FoodNutrition(nutrients: [.energy: 375], baseGrams: 100, measures: [Measure(name: "serving", quantity: 1, servings: 0.4)])
        let oats = Food(.openFoodFacts(barcode: "0099482434366"), name: "Organic Old-Fashioned Rolled Oats", brand: "365", nutrition: grams)
        let byVolume = FoodNutrition(nutrients: [.energy: 33], baseMilliliters: 100, measures: [Measure(name: "serving", quantity: 1, servings: 2.4)])
        let milk = Food(.openFoodFacts(barcode: "0099482400200"), name: "Organic Nonfat Milk", brand: "365", nutrition: byVolume)
        store.log((1...5).flatMap { day in [generic[1]!, generic[7]!].map { (FoodPortion($0.snapshot), day: today.adding(days: -day), minute: 480) } })
        try await store.write { _ in }.value
        for food in [oats, milk] { store.saveFood(food) }
        store.log([FoodPortion(oats.snapshot), FoodPortion(milk.snapshot)], on: today, minute: 484)
        let resolver = try await resolver()
        let rows = try resolver.rows([
            RambleItem(name: "oats", amount: 40, unit: "g"),
            RambleItem(name: "rolled oats", amount: 40, unit: "g"),
            RambleItem(name: "nonfat milk", amount: 200, unit: "g"),
            RambleItem(name: "365 nonfat milk", amount: 200, unit: "g"),
            RambleItem(name: "steel cut oats", amount: 40, unit: "g"),
            RambleItem(name: "Fairlife nonfat milk", amount: 200, unit: "g"),
        ], previous: [], choices: [:])
        #expect(describe(rows) == [
            "Organic Old-Fashioned Rolled Oats: 40 g",
            "Organic Old-Fashioned Rolled Oats: 40 g",
            // Sold by volume, so water's density stands in for the spoken weight.
            "Organic Nonfat Milk: 200 mL",
            "Organic Nonfat Milk: 200 mL",
            "unmatched steel cut oats",
            "unmatched Fairlife nonfat milk",
        ])
        #expect(food(rows[0])?.options.map(\.portion.food.name) == ["Organic Old-Fashioned Rolled Oats", "Oats"])

        let other = Food(.openFoodFacts(barcode: "0041383090738"), name: "Nonfat Milk", brand: "Glenview Farms", nutrition: grams)
        let fairlife = Food(.openFoodFacts(barcode: "0811620021234"), name: "Ultra-Filtered Nonfat Milk", brand: "Fairlife", nutrition: grams)
        let search = try await FoodSearch.load(store: store, catalog: try fixtureCatalog(rambleCatalog), branded: StubBranded(hits: [other, fairlife]))
        var online = resolver
        online.online = ["fairlife nonfat milk": try await search.search("Fairlife nonfat milk")]
        let found = try online.rows([RambleItem(name: "Fairlife nonfat milk", amount: 200, unit: "g")], previous: [], choices: [:])
        #expect(describe(found) == ["Ultra-Filtered Nonfat Milk: 200 g"])
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

    /// Yesterday's dinner: steak, a potato, and broccoli, at 19:00.
    func dinner() -> (context: RambleContext, entries: [FoodEntry], meal: String) {
        let food = { (name: String, kcal: Double, measure: String) in
            FoodSnapshot(source: .custom, name: name, nutrition: FoodNutrition(nutrients: [.energy: kcal, .protein: kcal / 20], measures: [Measure(name: measure, quantity: 1, servings: 1)]))
        }
        let yesterday = today.adding(days: -1)
        let entries = [
            FoodEntry(FoodPortion(food("Beef, top sirloin, steak", 400, "steak")), day: yesterday, minute: 19 * 60),
            FoodEntry(FoodPortion(food("Potato, baked", 160, "medium")), day: yesterday, minute: 19 * 60),
            FoodEntry(FoodPortion(food("Broccoli, cooked", 55, "cup")), day: yesterday, minute: 19 * 60 + 5),
        ]
        return (RambleContext(entries: entries, today: today), entries, "\(yesterday)-dinner")
    }

    func lines(_ rows: [RambleRow]) -> [String] {
        rows.lines.map { line in
            let indent = line.row.parent == nil ? "" : "  "
            guard case let .food(food) = line.row.content else { return "\(indent)\(describe([line.row])[0])" }
            return "\(indent)\(food.pick.portion.food.name): \(NutritionFormat.serving(food.pick.portion.serving))"
        }
    }

    @Test func aCopiedMealListsItsFoodsUnderItAndAChangeLandsOnThatFood() async throws {
        let (context, entries, meal) = dinner()
        let resolver = try await resolver(context: context)
        let copy = RambleItem(kind: .copy, copy: meal, meal: .lunch)
        let plain = try resolver.rows([copy], previous: [], choices: [:])
        #expect(lines(plain) == ["copy \(meal): Beef, top sirloin, steak, Potato, baked, Broccoli, cooked", "  Beef, top sirloin, steak: 1 steak", "  Potato, baked: 1 medium", "  Broccoli, cooked: 1 cup"])

        // "Only half the potatoes": the potato's line becomes the row that changes it, in its place.
        var halved = copy
        halved.except = [entries[1].key]
        let potato = RambleItem(name: "potatoes", ref: entries[1].key, scale: 0.5, meal: .lunch)
        let changed = try resolver.rows([halved, potato], previous: plain, choices: [:])
        #expect(lines(changed) == ["copy \(meal): Beef, top sirloin, steak, Broccoli, cooked", "  Beef, top sirloin, steak: 1 steak", "  Potato, baked: 0.5 medium", "  Broccoli, cooked: 1 cup"])
        #expect(plain.lines.map(\.id) == changed.lines.map(\.id))
        #expect(changed[1].changesCopiedFood)
        let logged = changed.flatMap(\.planned).map { "\($0.pick.portion.food.name) \($0.minute) \($0.pick.portion.serving.quantity)" }
        #expect(logged == ["Beef, top sirloin, steak 750 1.0", "Broccoli, cooked 750 1.0", "Potato, baked 750 0.5"])
        guard case let .copy(head) = changed[0].content else { Issue.record("not a copy"); return }
        #expect(Int((head.amounts[.energy] ?? 0).rounded()) == 400 + 80 + 55)

        // A ref the model forgot to leave out still stands in for its food, so the potato is never logged twice; "no
        // steak" drops the steak; a food said after it at the same meal joins the meal; one at another meal does not.
        let rest = try resolver.rows([
            RambleItem(kind: .copy, copy: meal, except: [entries[0].key], meal: .lunch), potato,
            RambleItem(name: "egg", amount: 2, meal: .lunch), RambleItem(name: "potatoes", ref: entries[1].key, meal: .dinner),
        ], previous: [], choices: [:])
        #expect(lines(rest) == ["copy \(meal): Broccoli, cooked", "  Potato, baked: 0.5 medium", "  Broccoli, cooked: 1 cup", "  Egg: 2 medium", "Potato, baked: 1 medium"])
    }

    @Test func aReplacementSharingAWordWithALeftOutFoodTakesItsPlace() async throws {
        let (context, entries, meal) = dinner()
        let rows = try await resolver(context: context).rows([
            RambleItem(kind: .copy, copy: meal, except: [entries[1].key], meal: .lunch),
            RambleItem(name: "sweet potatoes", meal: .lunch),
        ], previous: [], choices: [:])
        let key = rows[0].key
        #expect(rows.lines.map(\.id) == ["\(key)", "\(key) \(entries[0].key)", "\(key) \(entries[1].key)", "\(key) \(entries[2].key)"])
        #expect(rows.lines[2].row.item.name == "sweet potatoes")
        #expect(RambleResolver.related("sweet potatoes", "Potato, baked"))
        #expect(RambleResolver.singular("berries") == "berry" && RambleResolver.singular("glass") == "glass")
    }

    @Test func theOwnersServingAndRemovalOfAKeptFoodHoldOnTheCopy() async throws {
        let (context, entries, meal) = dinner()
        let resolver = try await resolver(context: context)
        let copy = RambleItem(kind: .copy, copy: meal, meal: .lunch)
        let steak = try #require(entries[0].food.nutrition.measures.first)
        let choice = RambleChoice(name: copy.identity, keptServings: [entries[0].key: Serving(measure: steak, quantity: 2)], keptRemoved: [entries[2].key])
        let rows = try resolver.rows([copy], previous: [], choices: [0: choice])
        #expect(lines(rows) == ["copy \(meal): Beef, top sirloin, steak, Potato, baked", "  Beef, top sirloin, steak: 2 steak", "  Potato, baked: 1 medium"])
        let kept = rows.lines[1].row
        #expect(kept.kept == entries[0].key && kept.id == rows[0].id && kept.item == copy && kept.key < 0)
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
        let logged = try store.readBlocking(FoodEntry.between(today.adding(days: -1), today).fetch)
        #expect(logged.map { "\($0.food.name) \($0.day) \($0.minute)" } == ["Kefir 2026-10-27 1140", "Oats 2026-10-28 480"])
    }
}
