import Foundation
import GRDB
import os

/// Where a result comes from, in the order the logger lists them: the hour's Picks above an empty search, MacroFactor's
/// From History, then the owner's own foods, then Common (USDA) and Branded (Open Food Facts).
enum FoodSearchGroup: Int, Comparable, Sendable {
    case picks, history, favorites, custom, recipes, common, branded

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

    /// `key` in SQL, for the snapshot JSON at `snapshot`.
    static func keySQL(_ snapshot: String) -> String {
        "COALESCE(json_extract(\(snapshot), '$.foodID'), json_extract(\(snapshot), '$.name') || '|' || COALESCE(json_extract(\(snapshot), '$.brand'), ''))"
    }
}

extension CurrentFoods {
    /// The result with its food as stored now. A stored food needs no caching, so it drops the copy to cache.
    func resolve(_ result: FoodSearchResult) -> FoodSearchResult {
        let portion = resolve(result.portion)
        return portion == result.portion ? result : FoodSearchResult(result.group, portion)
    }
}

/// The owner's side of a search, read once when the logger opens: one history row per food (its latest serving, most
/// recently logged first, and the days it was logged lately, in all and per meal section), each hour's and section's
/// Picks, favorites, custom foods, recipes, and the Open Food Facts foods already cached, which keep branded results
/// working offline. It also keeps the owner's meal sections and display, which the logger reads with it.
struct FoodLibrary: Sendable {
    /// How far back a history food's logged days count toward its search rank, the same window as Ramble's usual foods.
    static let usualDays = 60

    fileprivate struct Item: Sendable {
        let result: FoodSearchResult
        let text: FoodText
        /// The days in the last `usualDays` this food was logged on; zero outside the history.
        let days: Int
        /// The same days per meal section id, so a search at breakfast ranks the breakfast foods first.
        let sectionDays: [String: Int]

        init(_ result: FoodSearchResult, days: Int = 0, sectionDays: [String: Int] = [:]) {
            self.result = result
            text = FoodText(result.portion.food.name, brand: result.portion.food.brand)
            self.days = days
            self.sectionDays = sectionDays
        }
    }

    fileprivate var items: [FoodSearchGroup: [Item]] = [:]
    fileprivate var picks: [Int: [FoodSearchResult]] = [:]
    fileprivate var sectionPicks: [String: [FoodSearchResult]] = [:]
    /// The stored foods, which stand in for the history's snapshots and the catalog's and Open Food Facts' copies: a
    /// correction or an edit, and a cached USDA food's icon.
    private(set) var current = CurrentFoods([])
    private(set) var sections = MealSection.defaults
    private(set) var display = NutritionSettings.Timeline.Display.time

    static func read(_ db: Database, today: CalendarDay) throws -> FoodLibrary {
        let settings = try AppSettings.fetchOne(db, key: AppSettings.key(AppSettings.rowID))?.nutrition ?? NutritionSettings()
        let sections = settings.mealSections
        let usualStart = today.adding(days: -(usualDays - 1))
        let foods = try Food.filter(Column("archived") == false).fetchAll(db)
        let current = CurrentFoods(foods)
        var sectionDays: [String: [String: Set<CalendarDay>]] = [:]
        for row in try Row.fetchAll(db, sql: """
            SELECT \(foodKey) AS key, day, minute, section FROM food_entries
            WHERE day BETWEEN ? AND ? AND json_extract(food, '$.source') <> 'quick_add'
            """, arguments: [usualStart.description, today.description]) {
            let section = sections.section(of: row["section"] as String?, minute: row["minute"]).id
            sectionDays[current.key(row["key"]), default: [:]][section, default: []].insert(try row.day("day"))
        }
        // Bare columns beside MAX() come from the row holding the max, so each food brings its latest serving. Logging
        // or editing an entry sets updated_at, so a copy onto a future day ranks by when it was copied, not by its day.
        // An altered recipe's snapshot holds its alterations' nutrition, which logging it again would carry without
        // them, so only recipes logged as made bring theirs. A food and its correction are one row, at the later one's
        // latest serving, so the search lists the correction once.
        var listed = Set<String>()
        let history = try Row.fetchAll(db, sql: """
            SELECT food, serving, MAX(updated_at || day || printf('%04d', minute) || created_at || id) AS latest
            FROM food_entries
            WHERE json_extract(food, '$.source') <> 'quick_add' AND alterations IS NULL
            GROUP BY \(foodKey)
            ORDER BY latest DESC
            """).compactMap { row -> Item? in
            let logged = FoodPortion(try row.json("food"), serving: try row.json("serving") as Serving)
            let result = FoodSearchResult(.history, current.resolve(logged))
            // `latest` leads with the entry's updated_at, a fixed-width instant; a second MAX() would break the bare columns.
            let latest: String = row["latest"]
            let hidden = settings.hiddenHistory[result.key] ?? settings.hiddenHistory[FoodSearchResult.key(logged.food)]
            if let hidden, let written = Instant.parse(String(latest.prefix(24))), written <= hidden { return nil }
            guard listed.insert(result.key).inserted else { return nil }
            let days = sectionDays[result.key] ?? [:]
            return Item(result, days: days.values.reduce(into: Set<CalendarDay>()) { $0.formUnion($1) }.count, sectionDays: days.mapValues(\.count))
        }
        let recent = try Row.fetchAll(db, sql: """
            SELECT food, serving, day, minute, section, updated_at || created_at || id AS written FROM food_entries
            WHERE day BETWEEN ? AND ? AND json_extract(food, '$.source') <> 'quick_add' AND alterations IS NULL
            """, arguments: [today.adding(days: -(HourPicks.days - 1)).description, today.description]).map { row in
            HourPicks.Entry(
                portion: current.resolve(FoodPortion(try row.json("food"), serving: try row.json("serving") as Serving)), day: try row.day("day"),
                minute: row["minute"], section: row["section"], written: row["written"]
            )
        }
        var library = FoodLibrary()
        library.current = current
        library.sections = sections
        library.display = settings.timeline.display
        library.picks = HourPicks.picks(recent, today: today, by: { $0.minute / 60 }, hidden: settings.hiddenPicks)
            .mapValues { $0.map { FoodSearchResult(.picks, $0) } }
        library.sectionPicks = HourPicks.picks(recent, today: today, by: { sections.section(of: $0.section, minute: $0.minute).id }, hidden: settings.hiddenSectionPicks)
            .mapValues { $0.map { FoodSearchResult(.picks, $0) } }
        library.items[.history] = history
        library.items[.favorites] = try FoodFavorite.fetchAll(db).sorted { $0.createdAt < $1.createdAt }
            .map { Item(FoodSearchResult(.favorites, current.resolve($0.portion))) }
        library.items[.custom] = foods.filter { $0.source == .custom }.map { Item(FoodSearchResult(.custom, FoodPortion($0.snapshot))) }
        library.items[.recipes] = try Recipe.filter(Column("archived") == false).fetchAll(db)
            .map { Item(FoodSearchResult(.recipes, FoodPortion($0.snapshot))) }
        library.items[.branded] = foods.filter { $0.source == .openFoodFacts && current.key($0.id) == $0.id }
            .map { Item(FoodSearchResult(.branded, FoodPortion($0.snapshot))) }
        return library
    }

    private static let foodKey = FoodSearchResult.keySQL("food")
}

/// The logger's search: the owner's history, favorites, foods, and recipes, the bundled USDA foods, and, online,
/// Open Food Facts through our server. Results come grouped (`FoodSearchGroup`), best match first within a group, each
/// food once. Everything but branded search and new barcodes works offline.
@MainActor
final class FoodSearch {
    nonisolated static let log = Logger(subsystem: "com.stefan.a-better-me", category: "food-search")
    nonisolated static let limit = FoodIndex.limit

    private let store: LocalStore
    private let catalog: USDACatalog
    private let branded: any BrandedFoodSource
    private(set) var library: FoodLibrary

    private init(store: LocalStore, catalog: USDACatalog, branded: any BrandedFoodSource, library: FoodLibrary) {
        self.store = store
        self.catalog = catalog
        self.branded = branded
        self.library = library
    }

    /// The search with its history read and the bundled catalog's 7,300 names loaded off the main actor, for a screen
    /// that opens one.
    static func load(store: LocalStore, catalog: USDACatalog? = nil, branded: any BrandedFoodSource = FoodDatabaseClient.live) async throws -> FoodSearch {
        let today = CalendarDay.today
        async let library = store.database.pool.read { try FoodLibrary.read($0, today: today) }
        let catalog = await Task.detached { catalog ?? .bundled }.value
        return FoodSearch(store: store, catalog: catalog, branded: branded, library: try await library)
    }

    /// Rereads the owner's side, after logging or editing foods.
    func refresh() async throws {
        let today = CalendarDay.today
        library = try await store.database.pool.read { try FoodLibrary.read($0, today: today) }
    }

    /// The usual foods of an hour or a meal section (`HourPicks`).
    func picks(_ slot: TimelineSlot) -> [FoodSearchResult] {
        switch slot {
        case let .hour(hour): library.picks[hour] ?? []
        case let .section(section): library.sectionPicks[section.id] ?? []
        }
    }

    /// Everything that needs no network. An empty query lists the history, most recently logged first (MacroFactor's
    /// Latest). `section` is the meal section the logger logs into, whose usual foods rank first in the history.
    func local(_ query: String, section: String? = nil) throws -> [FoodSearchResult] {
        try index.local(query, section: section)
    }

    /// What `local` reads, as a value a background task can search without the main actor.
    var index: FoodIndex { FoodIndex(library: library, catalog: catalog) }

    /// `local`, then Open Food Facts' branded foods when `branded` is on and the server answers. Offline, or when the
    /// server fails, it is `local` alone, without an error: the logger keeps working.
    func search(_ query: String, branded includeBranded: Bool = true, section: String? = nil) async throws -> [FoodSearchResult] {
        var results = try local(query, section: section)
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
        for food in remote.prefix(max(0, Self.limit - cached)) {
            let result = library.current.resolve(FoodSearchResult(.branded, FoodPortion(food.snapshot), food: food))
            if shown.insert(result.key).inserted { results.append(result) }
        }
        return results
    }

    /// The food with this barcode: a custom or cached food first, so a known barcode works offline, then Open Food
    /// Facts, whose answer is cached under `off-<barcode>`. Either gives way to the owner's correction of it. Nil when
    /// neither knows it; throws when the server is unreachable.
    func lookup(barcode: String) async throws -> Food? {
        let (known, current) = try await store.read { db in
            let known = try Food.filter(Column("barcode") == barcode && Column("archived") == false).fetchAll(db)
                .min { ($0.source == .custom ? 0 : 1, $0.createdAt) < ($1.source == .custom ? 0 : 1, $1.createdAt) }
            return (known, try CurrentFoods.read(db))
        }
        if let known { return current.food(known.id) ?? known }
        guard let food = try await branded.food(barcode: barcode) else { return nil }
        store.saveFood(food)
        return current.food(food.id) ?? food
    }

    /// The owner's foods with this store item code, newest first: one per store that reuses the code. Never online,
    /// since Open Food Facts knows no store's own codes. A food saved before codes were shortened holds the whole
    /// label (`210843007991`), so any barcode containing the code is read the way a scan is.
    func foods(storeItem code: String) async throws -> [Food] {
        try await store.read { db in
            try Food.filter(Column("barcode").like("%\(code)%") && Column("archived") == false).order(Column("updated_at").desc).fetchAll(db)
                .filter { $0.barcode == code || $0.barcode.flatMap(ScannedBarcode.init)?.code == code }
        }
    }

    /// Caches a USDA or Open Food Facts result before it is logged; a no-op for the owner's own foods.
    func cache(_ result: FoodSearchResult) {
        if let food = result.food { store.saveFood(food) }
    }
}

/// The owner's foods and the bundled catalog, searched the same way on or off the main actor: `FoodSearch` serves the
/// logger's keystrokes from it, and a meal photo matches its foods with it on a background task.
struct FoodIndex: Sendable {
    /// Per group, like MacroFactor's twenty Common results.
    static let limit = 20

    let library: FoodLibrary
    let catalog: USDACatalog

    /// Everything that needs no network. An empty query lists the history, newest first (MacroFactor's Latest).
    func local(_ query: String, section: String? = nil) throws -> [FoodSearchResult] {
        let terms = FoodText.terms(query)
        guard !terms.isEmpty else { return (library.items[.history] ?? []).prefix(Self.limit).map(\.result) }
        var shown = Set<String>()
        var results: [FoodSearchResult] = []
        func add(_ group: [FoodSearchResult]) {
            for result in group where shown.insert(result.key).inserted {
                results.append(result)
            }
        }
        add(Self.rankByUse(library.items[.history] ?? [], terms, section: section))
        for group in [FoodSearchGroup.favorites, .custom, .recipes] {
            add(Self.rank(library.items[group] ?? [], terms))
        }
        let matches = catalog.search(terms, limit: Self.limit + shown.count)
        let foods = try catalog.foods(matches.map(\.entry.fdcID))
        add(Array(matches.compactMap { match in
            foods[match.entry.fdcID].map { library.current.resolve(FoodSearchResult(.common, FoodPortion($0.snapshot), food: $0)) }
        }.filter { !shown.contains($0.key) }.prefix(Self.limit)))
        add(Self.rank(library.items[.branded] ?? [], terms))
        return results
    }

    /// The matches for a food name Ramble heard: the logged foods that hold every spoken word, most recently logged first,
    /// then `local`'s. The owner's own food outranks a generic one ("oats" is the rolled oats scanned this morning, not
    /// USDA's or an older generic entry, which `local`'s name score puts first), and a spoken brand or kind the logged
    /// food lacks ("Fairlife milk", "steel cut oats") passes over it to the search.
    func spoken(_ name: String) throws -> [FoodSearchResult] {
        let terms = FoodText.terms(name)
        let own = (library.items[.history] ?? []).filter { $0.text.holds(terms) }.map(\.result)
        let keys = Set(own.map(\.key))
        return own + (try local(name)).filter { !keys.contains($0.key) }
    }

    /// The best local food for a name the photo model gave, or nil. The model is asked for SR Legacy's own description
    /// ("Chicken, broilers or fryers, drumstick, meat and skin, cooked, roasted"), which wins outright when the bundle
    /// has it; plainer names ranked chicken skin above the drumstick. Every remaining word must match, as in typed
    /// search. Only two kinds of word may go: one no food uses at all ("skinless", "pilaf"), and then the cooking words,
    /// one at a time. Dropping any other word turned "garlic cooked" into cooked rice and a green salad into a
    /// peppercorn dressing, so a food with no honest match is left for the owner to search. A description SR Legacy
    /// lacks ("Rice, white, long-grain, parboiled, unenriched, cooked") still names its food in the first two parts,
    /// so those are tried last, where the generator's staple prior picks the plain row.
    func match(_ name: String) throws -> FoodSearchResult? {
        if let hit = try matchWords(name) { return hit }
        let parts = name.split(separator: ",").prefix(2)
        guard parts.count == 2 else { return nil }
        return try matchWords(parts.joined(separator: ","))
    }

    private func matchWords(_ name: String) throws -> FoodSearchResult? {
        var terms = FoodText.terms(name).filter { !Self.fillers.contains($0) && uses($0) }
        while terms.contains(where: { !Self.preparations.contains($0) }) {
            let results = try local(terms.joined(separator: " "))
            if let hit = results.first(where: { $0.portion.food.name.caseInsensitiveCompare(name) == .orderedSame }) ?? results.first {
                return hit
            }
            guard let index = terms.lastIndex(where: { Self.preparations.contains($0) }), terms.count > 1 else { return nil }
            terms.remove(at: index)
        }
        return nil
    }

    private static let fillers: Set<String> = ["a", "an", "and", "of", "on", "or", "the", "with", "in"]
    private static let preparations: Set<String> = Set([
        "baked", "boiled", "braised", "broiled", "chopped", "cooked", "fresh", "fried", "grilled", "homemade", "mashed",
        "mixed", "plain", "poached", "raw", "roasted", "sauteed", "sliced", "steamed", "stewed", "toasted",
    ].map(FoodText.stem))

    /// Whether any food's name has the word, without decoding a row.
    private func uses(_ term: String) -> Bool {
        !catalog.search([term], limit: 1).isEmpty || library.items.values.contains { items in items.contains { $0.text.score([term]) != nil } }
    }

    /// Matching items, best score first, keeping the library's order between equals.
    private static func rank(_ items: [FoodLibrary.Item], _ terms: [String]) -> [FoodSearchResult] {
        items.enumerated()
            .compactMap { index, item in item.text.score(terms).map { (item.result, $0, index) } }
            .sorted { ($0.1, -$0.2) > ($1.1, -$1.2) }
            .prefix(limit)
            .map(\.0)
    }

    /// The history's matches, the foods the owner logs most first: names that hold every term as a whole word, then by
    /// the days logged in `section` (the meal being logged) in the last `FoodLibrary.usualDays`, then the days logged in
    /// all, then the name's score, then the newest. At breakfast the milk logged every morning beats the milk logged at
    /// dinner more often. The name score alone
    /// put USDA's "Milk, fluid, nonfat" logged once above the store-brand milk logged every morning, because the brand's
    /// name buries "milk" in its first part. Whole words still lead, so "egg" finds eggs before an eggplant logged daily.
    private static func rankByUse(_ items: [FoodLibrary.Item], _ terms: [String], section: String?) -> [FoodSearchResult] {
        items.enumerated()
            .compactMap { index, item in
                item.text.score(terms).map { (item.result, item.text.holds(terms) ? 1 : 0, section.flatMap { item.sectionDays[$0] } ?? 0, item.days, $0, -index) }
            }
            .sorted { ($0.1, $0.2, $0.3, $0.4, $0.5) > ($1.1, $1.2, $1.3, $1.4, $1.5) }
            .prefix(limit)
            .map(\.0)
    }
}
