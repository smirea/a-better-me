import Foundation
import Observation

enum LoggerTab: String, CaseIterable, Hashable, Sendable {
    case scan, photo, search, quickAdd, library

    var title: String {
        switch self {
        case .scan: "Scan"
        case .photo: "Photo"
        case .search: "Search"
        case .quickAdd: "Quick Add"
        case .library: "Library"
        }
    }

    var systemImage: String {
        switch self {
        case .scan: "barcode.viewfinder"
        case .photo: "camera"
        case .search: "magnifyingglass"
        case .quickAdd: "bolt"
        case .library: "books.vertical"
        }
    }
}

/// How the logger opens: the tab its shortcut names and, from an hour's + in the Food Log, that day and hour.
struct LoggerStart: Hashable, Identifiable, Sendable {
    var tab = LoggerTab.search
    var library = FoodLibraryView.Tab.foods
    var time: LogTime?

    var id: Self { self }
}

extension LoggerStart {
    /// The Food Log's request: its tab, and the hour whose + asked. A request for today without an hour follows the
    /// clock; another day logs at the current hour of that day.
    init(_ request: LogFoodRequest, now: Date = .now, calendar: Calendar = .current) {
        tab = switch request.start {
        case .search: .search
        case .barcode: .scan
        case .library: .library
        }
        if let minute = request.minute {
            time = LogTime(day: request.day, hour: minute / 60)
        } else if request.day != CalendarDay(now, in: calendar) {
            time = LogTime(day: request.day, hour: calendar.component(.hour, from: now))
        }
    }
}

/// What a barcode lookup found. The scanner and the manual entry both end here.
enum BarcodeOutcome: Hashable, Sendable {
    case found(Food)
    case notFound(String)
    /// Not 8 to 14 digits once spaces and dashes are gone.
    case invalid
    case unreachable
}

/// What a meal photo put on the plate, and the foods it named that nothing in the search matched.
struct PhotoOutcome: Hashable, Sendable {
    var added: Int
    var unmatched: [String]
}

/// What the Photo tab still has to tell the owner. It lives in the session, not the tab, so switching tabs while
/// Gemini answers neither loses the unmatched foods nor pushes the plate over another tab.
enum PhotoNotice: Hashable, Sendable {
    /// Foods went on the plate; the ones nothing matched are named before the plate shows.
    case added(unmatched: [String])
    case failed(String)
}

/// The logger sheet's state: the search, the plate, and the time it logs at. The views are thin over it, so the flows
/// (multi-add, logging the plate, a barcode lookup) are tested without a screen.
@MainActor @Observable
final class LoggerSession {
    let store: LocalStore
    @ObservationIgnored let search: FoodSearch
    @ObservationIgnored let recognizer: any MealRecognizer
    var tab: LoggerTab
    /// The Library tab's opening section; the library keeps its own after that.
    let library: FoodLibraryView.Tab
    /// The time chip's choice, or the hour the logger was opened at. Nil follows the clock, so a plate logged after
    /// the hour turns lands in the new hour instead of before the foods logged since.
    private var chosenTime: LogTime?
    var time: LogTime {
        get { chosenTime ?? .now() }
        set { chosenTime = newValue }
    }
    var plate = Plate()
    /// The food detail's serving before it is added, or the Quick Add being typed, so the banner shows what adding it
    /// would leave.
    var pending: FoodPortion?
    private(set) var query = ""
    private(set) var results: [FoodSearchResult] = []
    private(set) var isSearchingBranded = false
    private(set) var isFindingFoods = false
    var photoNotice: PhotoNotice?
    /// Counts logged plates; the sheet closes on a change.
    private(set) var logged = 0
    @ObservationIgnored private var remote: Task<Void, Never>?

    /// The hour the logger was opened for or the time chip picked, whose Picks show above Latest. Nil while the time
    /// follows the clock.
    var picksHour: Int? { chosenTime?.hour }

    /// "8 AM Picks" (`HourPicks`) while the query is empty.
    var picks: [FoodSearchResult] {
        guard query.isEmpty, let picksHour else { return [] }
        return search.picks(hour: picksHour)
    }

    init(store: LocalStore, search: FoodSearch, start: LoggerStart, recognizer: any MealRecognizer = MealPhotoClient.live) {
        self.store = store
        self.search = search
        self.recognizer = recognizer
        tab = start.tab
        library = start.library
        chosenTime = start.time
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
        let time = chosenTime ?? .now(date)
        store.log(plate.portions, on: time.day, minute: time.minute(at: date))
        plate = Plate()
        pending = nil
        logged += 1
    }

    /// Re-reads the owner's side of the search once the log's writes land.
    func reloadSearch() async {
        try? await store.write { _ in }.value
        do {
            try await search.refresh()
            results = try search.local(query)
        } catch {
            FoodSearch.log.error("Reloading search failed: \(String(describing: error))")
        }
    }

    func favorite(_ portion: FoodPortion, uncached: Food?) async {
        if let uncached { store.saveFood(uncached) }
        store.addFavorite(portion)
        await reloadSearch()
    }

    /// Puts the foods a meal photo shows on the plate: each name the server's model gives is matched against the
    /// local search (history first, then the owner's foods and USDA) and weighed at the model's grams, or left at the
    /// food's default serving when it has no weight. Throws when the server cannot be reached or refuses the photo.
    func addPhoto(jpeg: Data, note: String?) async throws -> PhotoOutcome {
        let foods = try await recognizer.recognize(jpeg: jpeg, note: note)
        // Each name scans the 7,300 USDA names a few times and reads their nutrition, too much for one frame.
        let index = search.index
        let matches = try await Task.detached { try foods.map { ($0, try index.match($0.search)) } }.value
        var outcome = PhotoOutcome(added: 0, unmatched: [])
        for (food, result) in matches {
            guard let result else {
                outcome.unmatched.append(food.name)
                continue
            }
            var pick = LoggerPick(result)
            if let grams = pick.portion.food.nutrition.allMeasures.first(where: { $0.name == "g" }) {
                pick.portion.serving = Serving(measure: grams, quantity: food.grams)
            }
            plate.add(pick)
            outcome.added += 1
        }
        return outcome
    }

    /// `addPhoto` for the Photo tab: one request at a time, its result left in `photoNotice`.
    func findFoods(jpeg: Data, note: String?) async {
        guard !isFindingFoods else { return }
        isFindingFoods = true
        defer { isFindingFoods = false }
        do {
            let outcome = try await addPhoto(jpeg: jpeg, note: note)
            photoNotice = outcome.added > 0 ? .added(unmatched: outcome.unmatched)
                : .failed(outcome.unmatched.isEmpty ? "No food was found in the photo." : "No food in the database matched \(outcome.unmatched.formatted(.list(type: .and))). Add them from Search.")
        } catch let error as MealPhotoError {
            photoNotice = .failed(error.message)
        } catch {
            FoodSearch.log.info("Photo logging failed: \(String(describing: error))")
            photoNotice = .failed("The server can't be reached. Check the connection and try again.")
        }
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
