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

        var legacy = Food(name: "Old Deli Salad", barcode: "210843007991", nutrition: tikka.nutrition)
        legacy.store = "Central Market"
        store.saveFood(legacy)
        try await store.write { _ in }.value
        guard case let .stores(both, _) = await logger.lookup(barcode: label) else { Issue.record("legacy not matched"); return }
        #expect(Set(both.map(\.id)) == [tikka.id, legacy.id])
        store.deleteFood(legacy.id)
        try await store.write { _ in }.value

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

    @Test func favoritesAPortionFindsItAgainAndTakesItBack() async throws {
        let logger = try await session()
        logger.setQuery("banana", branded: false)
        let banana = try #require(logger.results.first)
        let two = Serving(measure: banana.portion.serving.measure, quantity: 2)
        let id = UUID()
        await logger.favorite(FoodPortion(banana.portion.food, serving: two), id: id, uncached: banana.food)
        #expect(logger.results.map(\.group) == [.favorites])
        #expect(logger.results.first.map { NutritionFormat.serving($0.portion.serving) } == "2 medium")

        await logger.unfavorite(id)
        #expect(logger.results.map(\.group) == [.common])
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
}
