import Foundation
import Observation

enum LoggerTab: String, CaseIterable, Hashable, Sendable {
    case scan, search, quickAdd, library

    var title: String {
        switch self {
        case .scan: "Scan"
        case .search: "Search"
        case .quickAdd: "Quick Add"
        case .library: "Library"
        }
    }

    var systemImage: String {
        switch self {
        case .scan: "barcode.viewfinder"
        case .search: "magnifyingglass"
        case .quickAdd: "bolt"
        case .library: "books.vertical"
        }
    }
}

enum LibrarySection: String, CaseIterable, Hashable, Sendable {
    case recipes, foods, favorites

    var title: String {
        switch self {
        case .recipes: "Recipes"
        case .foods: "Foods"
        case .favorites: "Favorites"
        }
    }
}

/// How the logger opens: the tab its shortcut names and, from an hour's + in the Food Log, that day and hour.
struct LoggerStart: Hashable, Identifiable, Sendable {
    var tab = LoggerTab.search
    var library = LibrarySection.foods
    var time: LogTime?

    var id: Self { self }
}

/// What a barcode lookup found. The scanner and the manual entry both end here.
enum BarcodeOutcome: Hashable, Sendable {
    case found(Food)
    case notFound(String)
    /// Not 8 to 14 digits once spaces and dashes are gone.
    case invalid
    case unreachable
}

/// The logger sheet's state: the search, the plate, and the time it logs at. The views are thin over it, so the flows
/// (multi-add, logging the plate, a barcode lookup) are tested without a screen.
@MainActor @Observable
final class LoggerSession {
    let store: LocalStore
    @ObservationIgnored let search: FoodSearch
    var tab: LoggerTab
    var library: LibrarySection
    var time: LogTime
    var plate = Plate()
    /// The food detail's serving before it is added, so the banner shows what adding it would leave.
    var pending: FoodPortion?
    private(set) var query = ""
    private(set) var results: [FoodSearchResult] = []
    private(set) var isSearchingBranded = false
    /// Counts logged plates; the sheet closes on a change.
    private(set) var logged = 0
    @ObservationIgnored private var remote: Task<Void, Never>?

    init(store: LocalStore, search: FoodSearch, start: LoggerStart, now: Date = .now) {
        self.store = store
        self.search = search
        tab = start.tab
        library = start.library
        time = start.time ?? .now(now)
        results = (try? search.local("")) ?? []
    }

    /// Local results at once, then Open Food Facts after a pause in typing when `branded` is on. A failed branded
    /// search keeps the local results without an error (`FoodSearch.search`).
    func setQuery(_ text: String, branded: Bool) {
        query = text
        remote?.cancel()
        isSearchingBranded = false
        do {
            results = try search.local(text)
        } catch {
            FoodSearch.log.error("Local search failed: \(String(describing: error))")
        }
        guard let delay = SearchPolicy.remoteDelay(for: text, branded: branded) else { return }
        isSearchingBranded = true
        remote = Task { [weak self] in
            try? await Task.sleep(for: delay)
            guard !Task.isCancelled, let self else { return }
            let found = try? await search.search(text, branded: true)
            guard !Task.isCancelled, query == text else { return }
            if let found { results = found }
            isSearchingBranded = false
        }
    }

    /// Waits for the pending branded search, for tests.
    func settleSearch() async {
        await remote?.value
    }

    @discardableResult
    func add(_ pick: LoggerPick) -> UUID {
        plate.add(pick)
    }

    /// Logs the plate at the chosen day and hour as one transaction, caching each USDA or Open Food Facts food first so
    /// it joins the history, and empties the plate.
    func logPlate(at date: Date = .now) {
        guard !plate.isEmpty else { return }
        for item in plate.items {
            if let food = item.pick.uncached { store.saveFood(food) }
        }
        store.log(plate.portions, on: time.day, minute: time.minute(at: date))
        plate = Plate()
        pending = nil
        logged += 1
    }

    /// Re-reads the owner's side of the search once the log's writes land.
    func reloadSearch() async {
        try? await store.write { _ in }.value
        do {
            try search.reload()
            results = try search.local(query)
        } catch {
            FoodSearch.log.error("Reloading search failed: \(String(describing: error))")
        }
    }

    func favorite(_ portion: FoodPortion, uncached: Food?) {
        if let uncached { store.saveFood(uncached) }
        store.addFavorite(portion)
    }

    /// A typed or scanned barcode: a custom or cached food first, then Open Food Facts.
    func lookup(barcode text: String) async -> BarcodeOutcome {
        guard let barcode = Self.barcode(text) else { return .invalid }
        do {
            guard let food = try await search.lookup(barcode: barcode) else { return .notFound(barcode) }
            return .found(food)
        } catch {
            FoodSearch.log.info("Barcode lookup failed: \(String(describing: error))")
            return .unreachable
        }
    }

    /// The digits of an EAN-8, UPC-A, EAN-13, or GTIN-14, as a scanner or a person types them.
    nonisolated static func barcode(_ text: String) -> String? {
        let digits = text.filter { !$0.isWhitespace && $0 != "-" }
        guard (8...14).contains(digits.count), digits.allSatisfy(\.isASCII), digits.allSatisfy(\.isNumber) else { return nil }
        return digits
    }
}
