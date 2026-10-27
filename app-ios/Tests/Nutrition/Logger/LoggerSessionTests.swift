import Foundation
import GRDB
import Testing
@testable import App

private let bananaNutrition = #"{"nutrients":{"k":89,"p":1.09,"f":0.33,"c":22.84},"baseGrams":100,"measures":[{"name":"medium","quantity":1,"servings":1.18}]}"#

private let greekYogurt = Food(
    .openFoodFacts(barcode: "0894700010137"), name: "Nonfat Greek Yogurt", brand: "Chobani",
    nutrition: FoodNutrition(nutrients: [.energy: 52.9, .protein: 9.41], baseGrams: 100, measures: [Measure(name: "serving", quantity: 1, servings: 1.7)])
)

/// The logger's flows over a fresh database, the fixture USDA catalog, and a stubbed Open Food Facts.
@MainActor
struct LoggerSessionTests {
    let store: LocalStore
    let monday = calendarDay("2026-10-26")

    init() throws {
        store = try LocalStore(unsyncedAt: FileManager.default.temporaryDirectory.appending(path: "logger-\(UUID().uuidString)/a.sqlite"))
    }

    func session(_ branded: StubBranded = StubBranded()) async throws -> LoggerSession {
        let catalog = try fixtureCatalog([(173944, "Bananas, raw", 8, bananaNutrition)])
        let search = try await FoodSearch.load(store: store, catalog: catalog, branded: branded)
        return LoggerSession(store: store, search: search, start: LoggerStart(time: LogTime(day: monday, hour: 14)))
    }

    /// The found food's id: a food read back from the database differs from the stub's in its timestamps.
    func found(_ outcome: BarcodeOutcome) -> String? {
        if case let .found(food) = outcome { food.id } else { nil }
    }

    func entries() async throws -> [FoodEntry] {
        try await store.write { _ in }.value
        return try store.read(FoodEntry.on(monday).fetch)
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
        #expect(try store.read { try Food.fetchOne($0, key: "usda-173944") }?.name == "Bananas, raw")

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
        #expect(try store.read { try Food.fetchOne($0, key: "off-0894700010137") }?.brand == "Chobani")
        #expect(await logger.lookup(barcode: "12345678") == .notFound("12345678"))
        #expect(await logger.lookup(barcode: "12 34") == .invalid)
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
}
