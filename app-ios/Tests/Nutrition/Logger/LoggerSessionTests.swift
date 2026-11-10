import Foundation
import GRDB
import Testing
import UIKit
@testable import App

private let bananaNutrition = #"{"nutrients":{"k":89,"p":1.09,"f":0.33,"c":22.84},"baseGrams":100,"measures":[{"name":"medium","quantity":1,"servings":1.18}]}"#

private let greekYogurt = Food(
    .openFoodFacts(barcode: "0894700010137"), name: "Nonfat Greek Yogurt", brand: "Chobani",
    nutrition: FoodNutrition(nutrients: [.energy: 52.9, .protein: 9.41], baseGrams: 100, measures: [Measure(name: "serving", quantity: 1, servings: 1.7)])
)

/// Answers every photo with fixed foods, or fails like the server refusing it.
struct StubRecognizer: MealRecognizer {
    var foods: [RecognizedFood] = []
    var failure: String?

    func recognize(jpeg: Data, note: String?) async throws -> [RecognizedFood] {
        if let failure { throw MealPhotoError(message: failure) }
        return foods
    }
}

/// The logger's flows over a fresh database, the fixture USDA catalog, and a stubbed Open Food Facts.
@MainActor
struct LoggerSessionTests {
    let store: LocalStore
    let monday = calendarDay("2026-10-26")

    init() throws {
        store = try LocalStore(unsyncedAt: FileManager.default.temporaryDirectory.appending(path: "logger-\(UUID().uuidString)/a.sqlite"))
    }

    func session(_ branded: StubBranded = StubBranded(), photo: StubRecognizer = StubRecognizer()) async throws -> LoggerSession {
        let catalog = try fixtureCatalog([
            (173944, "Bananas, raw", 8, bananaNutrition),
            (171477, "Chicken, broilers or fryers, breast, meat only, cooked, roasted", 8, bananaNutrition),
        ])
        let search = try await FoodSearch.load(store: store, catalog: catalog, branded: branded)
        return LoggerSession(store: store, search: search, start: LoggerStart(time: LogTime(day: monday, hour: 14)), recognizer: photo)
    }

    /// The found food's id: a food read back from the database differs from the stub's in its timestamps.
    func found(_ outcome: BarcodeOutcome) -> String? {
        if case let .found(portion) = outcome { portion.food.foodID } else { nil }
    }

    func entries() async throws -> [FoodEntry] {
        try await store.write { _ in }.value
        return try store.readBlocking(FoodEntry.on(monday).fetch)
    }

    @Test func anHoursPicksShowAboveLatestForThatHourAndAnEmptyQuery() async throws {
        let catalog = try fixtureCatalog([(173944, "Bananas, raw", 8, bananaNutrition)])
        store.log([FoodPortion(yogurt)], on: .today, minute: 8 * 60 + 5)
        store.log([FoodPortion(yogurt)], on: CalendarDay.today.adding(days: -1), minute: 8 * 60 + 40)
        store.log([FoodPortion(greekYogurt.snapshot)], on: .today, minute: 12 * 60)
        try await store.write { _ in }.value
        let search = try await FoodSearch.load(store: store, catalog: catalog, branded: StubBranded())

        let eight = LoggerSession(store: store, search: search, start: LoggerStart(time: LogTime(day: .today, hour: 8)))
        #expect(eight.picksSlot == .hour(8))
        #expect(eight.picks.map(\.portion.food.name) == ["Yogurt"])
        #expect(eight.picks.first?.group == .picks)
        eight.setQuery("yog", branded: false)
        #expect(eight.picks.isEmpty)
        eight.time = LogTime(day: .today, hour: 12)
        eight.setQuery("", branded: false)
        #expect(eight.picks.map(\.portion.food.name) == ["Nonfat Greek Yogurt"])

        let clock = LoggerSession(store: store, search: search, start: LoggerStart())
        #expect(clock.picksSlot == .hour(Calendar.current.component(.hour, from: .now)))
    }

    @Test func theSectionsDisplayPicksAndRanksBySectionAndLogsIntoTheChosenOne() async throws {
        let catalog = try fixtureCatalog([(173944, "Bananas, raw", 8, bananaNutrition)])
        let milk = FoodSnapshot(foodID: "custom-milk", source: .custom, name: "Oat Milk", nutrition: yogurt.nutrition)
        let chocolate = FoodSnapshot(foodID: "custom-chocolate", source: .custom, name: "Chocolate Milk", nutrition: yogurt.nutrition)
        for day in 1...3 { store.log([FoodPortion(milk)], on: CalendarDay.today.adding(days: -day), minute: 8 * 60) }
        for day in 1...5 { store.log([FoodPortion(chocolate)], on: CalendarDay.today.adding(days: -day), minute: 19 * 60) }
        store.updateSettings { $0.nutrition.timeline.display = .sections }
        try await store.write { _ in }.value
        let search = try await FoodSearch.load(store: store, catalog: catalog, branded: StubBranded())
        let sections = MealSection.defaults

        let breakfast = LoggerSession(store: store, search: search, start: LoggerStart(time: LogTime(day: monday, hour: 8, section: sections[0])))
        #expect(breakfast.picksSlot == .section(sections[0]))
        #expect(breakfast.picks.map(\.portion.food.name) == ["Oat Milk"])
        breakfast.setQuery("milk", branded: false)
        #expect(breakfast.results.prefix(2).map(\.portion.food.name) == ["Oat Milk", "Chocolate Milk"])
        breakfast.time = breakfast.time(of: sections[4], on: monday)
        #expect(breakfast.time.hour == 19)
        #expect(breakfast.results.prefix(2).map(\.portion.food.name) == ["Chocolate Milk", "Oat Milk"])

        breakfast.time = LogTime(day: monday, hour: 8, section: sections[2])
        breakfast.add(LoggerPick(FoodPortion(milk)))
        breakfast.logPlate()
        let logged = try await entries()
        #expect(logged.map(\.section) == ["lunch"])
        #expect(logged.map(\.hour) == [8])
    }

    @Test func logsThePlateInOneGoAndCachesDatabaseFoods() async throws {
        let logger = try await session(StubBranded(hits: [greekYogurt]))
        logger.setQuery("banana", branded: false)
        let banana = try #require(logger.results.first)
        #expect(banana.group == .common)
        logger.add(LoggerPick(banana))
        logger.add(LoggerPick(try #require(QuickAddDraft(energy: "250", name: "Shake").portion)))
        let at = Calendar.current.date(bySettingHour: 9, minute: 41, second: 0, of: .now)!
        logger.logPlate(at: at)

        let logged = try await entries()
        #expect(logged.map(\.food.name) == ["Bananas, raw", "Shake"])
        #expect(logged.map(\.minute) == [14 * 60 + 41, 14 * 60 + 41])
        #expect(logged.map { NutritionFormat.serving($0.serving) } == ["1 medium", "1 serving"])
        #expect(logger.plate.isEmpty)
        #expect(try store.readBlocking { try Food.fetchOne($0, key: "usda-173944") }?.name == "Bananas, raw")

        await logger.reloadSearch()
        logger.setQuery("", branded: false)
        #expect(logger.results.map(\.portion.food.name) == ["Bananas, raw"])
        #expect(logger.results.first?.group == .history)
    }

    @Test func followsTheClockUntilATimeIsChosen() async throws {
        let catalog = try fixtureCatalog([(173944, "Bananas, raw", 8, bananaNutrition)])
        let logger = LoggerSession(store: store, search: try await FoodSearch.load(store: store, catalog: catalog, branded: StubBranded()), start: LoggerStart())
        logger.add(LoggerPick(try #require(QuickAddDraft(energy: "100").portion)))
        let at = Calendar.current.date(from: DateComponents(year: 2026, month: 10, day: 26, hour: 11, minute: 2))!
        logger.logPlate(at: at)
        let logged = try await entries()
        #expect(logged.map(\.minute) == [11 * 60 + 2])
    }

    @Test func showsLocalResultsWithoutAnErrorOffline() async throws {
        let logger = try await session(StubBranded(offline: true))
        logger.setQuery("banana", branded: true)
        await logger.settleSearch()
        #expect(logger.results.map(\.portion.food.name) == ["Bananas, raw"])
        #expect(!logger.isSearchingBranded)
    }

    @Test func addsBrandedResultsAfterThePause() async throws {
        let logger = try await session(StubBranded(hits: [greekYogurt]))
        logger.setQuery("greekYogurt", branded: true)
        #expect(logger.results.isEmpty)
        await logger.settleSearch()
        #expect(logger.results.map(\.group) == [.branded])
        #expect(logger.results.first?.food?.id == "off-0894700010137")
    }

    @Test func looksUpABarcodeAndCachesIt() async throws {
        let logger = try await session(StubBranded(products: ["0894700010137": greekYogurt]))
        #expect(found(await logger.lookup(barcode: "0 894700 010137")) == "off-0894700010137")
        try await store.write { _ in }.value
        #expect(try store.readBlocking { try Food.fetchOne($0, key: "off-0894700010137") }?.brand == "Chobani")
        #expect(await logger.lookup(barcode: "12345678") == .notFound(ScannedBarcode(code: "12345678", isStoreItem: false, grams: nil)))
        #expect(await logger.lookup(barcode: "12 34") == .invalid)
    }

    @Test func aStoreItemFindsTheOwnersFoodByItsCodeAtTheLabelsWeight() async throws {
        let logger = try await session(StubBranded(offline: true))
        let label = "0100210843000000\u{1D}3103000430\u{1D}39220799"
        let unknown = await logger.lookup(barcode: label)
        #expect(unknown == .notFound(ScannedBarcode(code: "210843", isStoreItem: true, grams: 430)))

        var tikka = Food(name: "Chicken Tikka", barcode: "210843", nutrition: FoodNutrition(nutrients: [.energy: 2], baseGrams: 1, measures: [Measure(name: "ea", quantity: 1, servings: 312)]))
        tikka.store = "Whole Foods Market"
        store.saveFood(tikka)
        try await store.write { _ in }.value
        guard case let .found(portion) = await logger.lookup(barcode: label) else { Issue.record("not found"); return }
        #expect(portion.food.foodID == tikka.id)
        #expect(portion.serving.measure.name == "g")
        #expect(portion.serving.quantity == 430)
        #expect(portion.amounts[.energy] == 860)

        var salad = Food(name: "Kale Salad", barcode: "210843", nutrition: tikka.nutrition)
        salad.store = "H-E-B"
        store.saveFood(salad)
        try await store.write { _ in }.value
        guard case let .stores(foods, _) = await logger.lookup(barcode: "(01)00210843000000(3904)0079900") else { Issue.record("no choice"); return }
        #expect(Set(foods.map(\.store)) == ["Whole Foods Market", "H-E-B"])
    }

    @Test func aKnownBarcodeNeedsNoNetwork() async throws {
        store.saveFood(greekYogurt)
        try await store.write { _ in }.value
        let logger = try await session(StubBranded(offline: true))
        #expect(found(await logger.lookup(barcode: "0894700010137")) == "off-0894700010137")
        #expect(await logger.lookup(barcode: "12345678") == .unreachable)
    }

    @Test func favoritesAPortionAndFindsItAgain() async throws {
        let logger = try await session()
        logger.setQuery("banana", branded: false)
        let banana = try #require(logger.results.first)
        let two = Serving(measure: banana.portion.serving.measure, quantity: 2)
        await logger.favorite(FoodPortion(banana.portion.food, serving: two), uncached: banana.food)
        #expect(logger.results.map(\.group) == [.favorites])
        #expect(logger.results.first.map { NutritionFormat.serving($0.portion.serving) } == "2 medium")
    }

    @Test func aPhotoPutsEachMatchedFoodOnThePlateAtItsGrams() async throws {
        let logger = try await session(photo: StubRecognizer(foods: [
            RecognizedFood(name: "Grilled chicken breast", search: "skinless chicken breast cooked", grams: 150, confidence: 0.9),
            RecognizedFood(name: "Banana", search: "banana", grams: 118, confidence: 0.95),
            RecognizedFood(name: "Mystery sauce", search: "mystery sauce", grams: 20, confidence: 0.3),
            RecognizedFood(name: "Rice pilaf", search: "white rice cooked", grams: 45, confidence: 0.8),
            RecognizedFood(name: "Roasted banana", search: "roasted banana", grams: 30, confidence: 0.6),
        ]))
        let outcome = try await logger.addPhoto(jpeg: Data(), note: nil)
        #expect(outcome == PhotoOutcome(added: 3, unmatched: ["Mystery sauce", "Rice pilaf"]))
        #expect(logger.plate.items.map(\.pick.portion.food.name) == ["Chicken, broilers or fryers, breast, meat only, cooked, roasted", "Bananas, raw", "Bananas, raw"])
        #expect(logger.plate.items.map { NutritionFormat.serving($0.pick.portion.serving) } == ["150 g", "118 g", "30 g"])
        #expect(logger.plate.totals[.energy].map { ($0 * 10).rounded() / 10 } == 265.2)
        #expect(logger.plate.items.allSatisfy { $0.pick.uncached != nil })
    }

    @Test func aRefusedPhotoLeavesThePlateAsItWasAndSaysWhy() async throws {
        let logger = try await session(photo: StubRecognizer(failure: "Photo logging needs GEMINI_API_KEY on the server"))
        await logger.findFoods(jpeg: Data(), note: "no skin")
        #expect(logger.plate.isEmpty)
        #expect(logger.photoNotice == .failed("Photo logging needs GEMINI_API_KEY on the server"))
        #expect(!logger.isFindingFoods)
    }

    @Test func findingFoodsLeavesTheUnmatchedOnesForTheTab() async throws {
        let logger = try await session(photo: StubRecognizer(foods: [
            RecognizedFood(name: "Banana", search: "Bananas, raw", grams: 100, confidence: 0.9),
            RecognizedFood(name: "Mystery sauce", search: "mystery sauce", grams: 20, confidence: 0.3),
        ]))
        await logger.findFoods(jpeg: Data(), note: nil)
        #expect(logger.photoNotice == .added(unmatched: ["Mystery sauce"]))
        #expect(logger.plate.items.count == 1)

        let empty = try await session(photo: StubRecognizer(foods: []))
        await empty.findFoods(jpeg: Data(), note: nil)
        #expect(empty.photoNotice == .failed("No food was found in the photo."))
    }

    @Test func aPhotoShrinksToAnUprightJPEG() throws {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 3000, height: 2000), format: { let f = UIGraphicsImageRendererFormat(); f.scale = 1; return f }())
        let png = renderer.pngData { context in
            UIColor.orange.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 3000, height: 2000))
        }
        let jpeg = try #require(MealPhotoImage.jpeg(from: png))
        let image = try #require(UIImage(data: jpeg))
        #expect(image.size == CGSize(width: 1024, height: 683))
        #expect(jpeg.starts(with: [0xFF, 0xD8]))
        #expect(MealPhotoImage.jpeg(from: Data("not an image".utf8)) == nil)
    }

    @Test func theBannerCountsWhatIsBeingTypedOnTopOfThePlate() async throws {
        let logger = try await session()
        logger.add(LoggerPick(try #require(QuickAddDraft(energy: "300", protein: "20").portion)))
        #expect(logger.plateWithPending[.energy] == 300)
        logger.pending = QuickAddDraft(protein: "10", fat: "5").portion
        #expect(logger.plateWithPending == [.energy: 385, .protein: 30, .fat: 5])
        logger.logPlate()
        #expect(logger.plateWithPending == [:])
    }
}
