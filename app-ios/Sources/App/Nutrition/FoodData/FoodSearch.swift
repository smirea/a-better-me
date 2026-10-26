import Foundation
import GRDB
import os

/// Where a result comes from, in the order the logger lists them: MacroFactor's From History, then the owner's own
/// foods, then Common (USDA) and Branded (Open Food Facts).
enum FoodSearchGroup: Int, Comparable, Sendable {
    case history, favorites, custom, recipes, common, branded

    static func < (lhs: Self, rhs: Self) -> Bool { lhs.rawValue < rhs.rawValue }
}

struct FoodSearchResult: Identifiable, Hashable, Sendable {
    let group: FoodSearchGroup
    /// The food at the serving a tap adds: the last one logged for history, the saved one for a favorite, otherwise
    /// the food's default measure.
    let portion: FoodPortion
    /// A USDA or Open Food Facts food not yet in `foods`. `FoodSearch.cache` saves it when the owner logs it, so it
    /// joins the history and shows offline.
    let food: Food?
    /// One food appears once across groups: its id, or its name and brand when its snapshot has none.
    let key: String

    var id: String { "\(group.rawValue)/\(key)" }

    fileprivate init(_ group: FoodSearchGroup, _ portion: FoodPortion, food: Food? = nil, key: String? = nil) {
        self.group = group
        self.portion = portion
        self.food = food
        self.key = key ?? Self.key(portion.food)
    }

    static func key(_ food: FoodSnapshot) -> String { food.foodID ?? "\(food.name)|\(food.brand ?? "")" }
}

/// The owner's side of a search, read once when the logger opens: one history row per food (its latest serving,
/// newest first), favorites, custom foods, recipes, and the Open Food Facts foods already cached, which keep branded
/// results working offline.
struct FoodLibrary: Sendable {
    fileprivate struct Item: Sendable {
        let result: FoodSearchResult
        let text: FoodText

        init(_ result: FoodSearchResult) {
            self.result = result
            text = FoodText(result.portion.food.name, brand: result.portion.food.brand)
        }
    }

    fileprivate var items: [FoodSearchGroup: [Item]] = [:]

    static func read(_ db: Database) throws -> FoodLibrary {
        // Bare columns beside MAX() come from the row holding the max, so each food brings its latest serving.
        let history = try Row.fetchAll(db, sql: """
            SELECT food, serving, MAX(day || printf('%04d', minute) || created_at) AS latest
            FROM food_entries
            WHERE json_extract(food, '$.source') <> 'quick_add'
            GROUP BY COALESCE(json_extract(food, '$.foodID'), json_extract(food, '$.name') || '|' || COALESCE(json_extract(food, '$.brand'), ''))
            ORDER BY latest DESC
            """).map { row in
            FoodSearchResult(.history, FoodPortion(try row.json("food"), serving: try row.json("serving") as Serving))
        }
        let foods = try Food.filter(Column("archived") == false).fetchAll(db)
        var library = FoodLibrary()
        library.items[.history] = history.map(Item.init)
        library.items[.favorites] = try FoodFavorite.fetchAll(db).sorted { $0.createdAt < $1.createdAt }
            .map { Item(FoodSearchResult(.favorites, $0.portion)) }
        library.items[.custom] = foods.filter { $0.source == .custom }.map { Item(FoodSearchResult(.custom, FoodPortion($0.snapshot))) }
        library.items[.recipes] = try Recipe.filter(Column("archived") == false).fetchAll(db)
            .map { Item(FoodSearchResult(.recipes, FoodPortion($0.snapshot))) }
        library.items[.branded] = foods.filter { $0.source == .openFoodFacts }.map { Item(FoodSearchResult(.branded, FoodPortion($0.snapshot))) }
        return library
    }
}

/// The logger's search: the owner's history, favorites, foods, and recipes, the bundled USDA foods, and, online,
/// Open Food Facts through our server. Results come grouped (`FoodSearchGroup`), best match first within a group, each
/// food once. Everything but branded search and new barcodes works offline.
@MainActor
final class FoodSearch {
    nonisolated static let log = Logger(subsystem: "com.stefan.a-better-me", category: "food-search")
    /// Per group, like MacroFactor's twenty Common results.
    static let limit = 20

    private let store: LocalStore
    private let catalog: USDACatalog
    private let branded: any BrandedFoodSource
    private(set) var library: FoodLibrary

    init(store: LocalStore, catalog: USDACatalog = .bundled, branded: any BrandedFoodSource = FoodDatabaseClient.live) throws {
        self.store = store
        self.catalog = catalog
        self.branded = branded
        library = try store.read(FoodLibrary.read)
    }

    /// Rereads the owner's side, after logging or editing foods.
    func reload() throws {
        library = try store.read(FoodLibrary.read)
    }

    /// Everything that needs no network. An empty query lists the history, newest first (MacroFactor's Latest).
    func local(_ query: String) throws -> [FoodSearchResult] {
        let terms = FoodText.terms(query)
        guard !terms.isEmpty else { return (library.items[.history] ?? []).prefix(Self.limit).map(\.result) }
        var shown = Set<String>()
        var results: [FoodSearchResult] = []
        func add(_ group: [FoodSearchResult]) {
            for result in group where shown.insert(result.key).inserted {
                results.append(result)
            }
        }
        for group in [FoodSearchGroup.history, .favorites, .custom, .recipes] {
            add(Self.rank(library.items[group] ?? [], terms))
        }
        let matches = catalog.search(terms, limit: Self.limit + shown.count)
        let foods = try catalog.foods(matches.map(\.entry.fdcID))
        add(Array(matches.compactMap { match in
            foods[match.entry.fdcID].map { FoodSearchResult(.common, FoodPortion($0.snapshot), food: $0) }
        }.filter { !shown.contains($0.key) }.prefix(Self.limit)))
        add(Self.rank(library.items[.branded] ?? [], terms))
        return results
    }

    /// `local`, then Open Food Facts' branded foods when `branded` is on and the server answers. Offline, or when the
    /// server fails, it is `local` alone, without an error: the logger keeps working.
    func search(_ query: String, branded includeBranded: Bool = true) async throws -> [FoodSearchResult] {
        var results = try local(query)
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard includeBranded, trimmed.count >= 2 else { return results }
        let remote: [Food]
        do {
            remote = try await branded.search(trimmed, limit: Self.limit)
        } catch {
            Self.log.info("Branded search failed, showing local results: \(String(describing: error))")
            return results
        }
        var shown = Set(results.map(\.key))
        let cached = results.count { $0.group == .branded }
        for food in remote.prefix(max(0, Self.limit - cached)) where shown.insert(food.id).inserted {
            results.append(FoodSearchResult(.branded, FoodPortion(food.snapshot), food: food))
        }
        return results
    }

    /// The food with this barcode: a custom or cached food first, so a known barcode works offline, then Open Food
    /// Facts, whose answer is cached under `off-<barcode>`. Nil when neither knows it; throws when the server is
    /// unreachable.
    func lookup(barcode: String) async throws -> Food? {
        let known = try store.read { db in
            try Food.filter(Column("barcode") == barcode && Column("archived") == false).fetchAll(db)
                .min { ($0.source == .custom ? 0 : 1, $0.createdAt) < ($1.source == .custom ? 0 : 1, $1.createdAt) }
        }
        if let known { return known }
        guard let food = try await branded.food(barcode: barcode) else { return nil }
        store.saveFood(food)
        return food
    }

    /// Caches a USDA or Open Food Facts result before it is logged; a no-op for the owner's own foods.
    func cache(_ result: FoodSearchResult) {
        if let food = result.food { store.saveFood(food) }
    }

    /// Matching items, best score first, keeping the library's order (newest first for history) between equals.
    private static func rank(_ items: [FoodLibrary.Item], _ terms: [String]) -> [FoodSearchResult] {
        items.enumerated()
            .compactMap { index, item in item.text.score(terms).map { (item.result, $0, index) } }
            .sorted { ($0.1, -$0.2) > ($1.1, -$1.2) }
            .prefix(limit)
            .map(\.0)
    }
}
