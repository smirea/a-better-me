import Foundation
import Observation

/// What a barcode lookup found. The scanner and the manual entry both end here.
enum BarcodeOutcome: Hashable, Sendable {
    /// The food, at the package's weight when the barcode carries one.
    case found(FoodPortion)
    /// A store item code that the owner's foods from several stores share, newest first.
    case stores([Food], ScannedBarcode)
    case notFound(ScannedBarcode)
    /// Neither 8 to 14 digits once spaces and dashes are gone nor a GS1 element string with a GTIN.
    case invalid
    case unreachable
}

/// What a meal photo added, and the foods it named that nothing in the search matched.
struct PhotoOutcome: Hashable, Sendable {
    var added: Int
    var unmatched: [String]
}

/// What the Photo tab still has to tell the owner. It lives in the session, not the tab, so switching tabs while
/// Gemini answers neither loses the unmatched foods nor pushes the meal over another tab.
enum PhotoNotice: Hashable, Sendable {
    /// Foods were added; the ones nothing matched are named before the meal shows.
    case added(unmatched: [String])
    case failed(String)
}

/// Where an add goes, at once: the Food Log at the chosen time, or a recipe's ingredients. `ingredients` starts from
/// the recipe's list as it stands and hears every change to it; `recipe` is the food id of the recipe being edited,
/// which cannot contain itself.
enum LoggerDestination {
    case foodLog
    case ingredients(IngredientList, recipe: String?, update: @MainActor (IngredientList) -> Void)
}

/// What was just added, with Undo: "Logged Banana to Lunch", "Added 3 ingredients".
struct LoggerNotice: Identifiable, Equatable {
    let id = UUID()
    let message: String
    let added: [UUID]
}

/// The logger sheet's state: the search, the time it logs at, and in a recipe its ingredients. Every add goes straight
/// to the destination; nothing waits to be logged together. The views are thin over it.
@MainActor @Observable
final class LoggerSession {
    let store: LocalStore
    @ObservationIgnored let search: FoodSearch
    @ObservationIgnored let recognizer: any MealRecognizer
    @ObservationIgnored let destination: LoggerDestination
    /// Lives here, not in the tab, so switching tabs mid-ramble keeps its rows.
    let ramble: RambleCapture
    var tab: LoggerTab
    /// The time chip's choice, or the hour the logger was opened at. Nil follows the clock, so a food logged after the
    /// hour turns lands in the new hour instead of before the foods logged since.
    private var chosenTime: LogTime?
    var time: LogTime {
        get { chosenTime ?? .now() }
        set {
            let section = self.section
            chosenTime = newValue
            ramble.replace()
            if self.section != section, !query.isEmpty { setQuery(query, branded: branded) }
        }
    }
    /// The recipe's ingredients, empty in the Food Log. Every change reaches the recipe's draft at once.
    private(set) var ingredients = IngredientList()
    /// The food detail's serving before it is added, or the Quick Add being typed, so the banner shows what adding it
    /// would leave.
    var pending: FoodPortion?
    private(set) var query = ""
    /// Whether the last query asked Open Food Facts, so re-ranking for a new section asks the same.
    @ObservationIgnored private var branded = false
    private(set) var results: [FoodSearchResult] = []
    private(set) var isSearchingBranded = false
    private(set) var isFindingFoods = false
    var photoNotice: PhotoNotice?
    var notice: LoggerNotice?
    @ObservationIgnored private var remote: Task<Void, Never>?
    /// `FoodSearch` is not observable, so reading this is how `picks` redraws after a reload that leaves `results` as
    /// it was, such as hiding a Pick.
    private var searchReloads = 0

    /// Picking ingredients: nothing is logged, so the time chip and the day's totals have nothing to say.
    var addsIngredients: Bool {
        if case .ingredients = destination { true } else { false }
    }

    var sections: [MealSection] { search.library.sections }
    var showsSections: Bool { search.library.display == .sections }

    /// The time the section picker sets: now when today's clock is in the section, else its typical minute.
    func time(of section: MealSection, on day: CalendarDay, now: Date = .now) -> LogTime {
        LogTime(day: day, hour: sections.logMinute(for: section, on: day, now: now) / 60, section: section)
    }

    /// The meal section a log lands in: the one picked, else the one the time falls in. Search ranks its usual foods first.
    var section: MealSection { time.section(in: sections) }

    /// The hour, or in the Sections display the section, whose Picks show above Latest.
    var picksSlot: TimelineSlot { time.slot(in: sections, showsSections: showsSections) }

    /// "8 AM Picks" or "Breakfast Picks" (`HourPicks`) while the query is empty.
    var picks: [FoodSearchResult] {
        _ = searchReloads
        guard query.isEmpty else { return [] }
        return search.picks(picksSlot)
    }

    init(
        store: LocalStore, search: FoodSearch, start: LoggerStart, destination: LoggerDestination = .foodLog,
        recognizer: any MealRecognizer = MealPhotoClient.live, listener: any RambleLiveConnecting = RambleLiveClient.live
    ) {
        self.store = store
        self.search = search
        self.recognizer = recognizer
        self.destination = destination
        if case let .ingredients(list, _, _) = destination { ingredients = list }
        ramble = RambleCapture(store: store, index: { search.index }, listener: listener)
        tab = start.tab
        chosenTime = start.time
        results = (try? search.local("")) ?? []
        ramble.chosenTime = { [weak self] in self?.chosenTime }
        ramble.searchOnline = { [search] name in (try? await search.search(name, branded: true)) ?? [] }
    }

    /// Local results at once, then Open Food Facts after a pause in typing when `branded` is on. A failed branded
    /// search keeps the local results without an error (`FoodSearch.search`).
    func setQuery(_ text: String, branded: Bool) {
        query = text
        self.branded = branded
        remote?.cancel()
        isSearchingBranded = false
        do {
            results = try search.local(text, section: section.id)
        } catch {
            FoodSearch.log.error("Local search failed: \(String(describing: error))")
        }
        guard let delay = SearchPolicy.remoteDelay(for: text, branded: branded) else { return }
        isSearchingBranded = true
        remote = Task { [weak self] in
            try? await Task.sleep(for: delay)
            guard !Task.isCancelled, let self else { return }
            let found = try? await search.search(text, branded: true, section: section.id)
            guard !Task.isCancelled, query == text else { return }
            if let found { results = found }
            isSearchingBranded = false
        }
    }

    /// Waits for the pending branded search, for tests.
    func settleSearch() async {
        await remote?.value
    }

    /// Logs the food at the chosen day and hour, or makes it an ingredient.
    func add(_ pick: LoggerPick) {
        add([pick])
    }

    /// Several foods in one transaction (a photo's), at the chosen day and hour.
    func add(_ picks: [LoggerPick], at date: Date = .now) {
        deliver(picks) {
            let time = chosenTime ?? .now(date)
            let minute = time.minute(at: date)
            return picks.map { $0.entry(day: time.day, minute: minute, section: time.section?.id) }
        }
    }

    /// Caches each USDA or Open Food Facts food first, so it joins the history and an ingredient's food works offline,
    /// then logs `entries` or adds the picks to the recipe, and offers Undo.
    private func deliver(_ picks: [LoggerPick], entries: () -> [FoodEntry]) {
        pending = nil
        for pick in picks {
            if let food = pick.uncached { store.saveFood(food) }
        }
        let added: [UUID]
        switch destination {
        case .foodLog:
            let logged = entries()
            store.log(logged)
            added = logged.map(\.id)
        case let .ingredients(_, recipe, _):
            let kept = picks.filter { recipe == nil || $0.portion.food.foodID != recipe }
            var ids: [UUID] = []
            changeIngredients { list in ids = kept.map { list.add($0) } }
            added = ids
        }
        guard !added.isEmpty else { return }
        let what = picks.count == 1 ? picks[0].portion.food.displayName : "\(picks.count) \(addsIngredients ? "ingredients" : "foods")"
        notice = LoggerNotice(message: addsIngredients ? "Added \(what)" : "Logged \(what) to \(mealName)", added: added)
    }

    private func changeIngredients(_ change: (inout IngredientList) -> Void) {
        change(&ingredients)
        if case let .ingredients(_, _, update) = destination { update(ingredients) }
    }

    /// The meal an add lands in, as the top button names it: the section, with its day when that isn't today.
    var mealName: String {
        addsIngredients ? "Ingredients" : LogTime(day: time.day, hour: time.hour, section: section).label()
    }

    /// Takes logged entries or ingredients away: the meal's remove, and Undo.
    func remove(_ ids: [UUID]) {
        switch destination {
        case .foodLog: store.deleteEntries(ids)
        case .ingredients: changeIngredients { list in ids.forEach { list.remove($0) } }
        }
    }

    func undo(_ notice: LoggerNotice) {
        remove(notice.added)
        if self.notice == notice { self.notice = nil }
    }

    /// A new amount for a logged entry or an ingredient.
    func setServing(_ serving: Serving, of id: UUID) {
        switch destination {
        case .foodLog: store.edit(FoodEntry.self, id: id) { $0.serving = serving }
        case .ingredients: changeIngredients { $0.setServing(serving, of: id) }
        }
    }

    /// A ramble holds foods that closing would lose.
    var hasUnlogged: Bool { !ramble.isEmpty }

    /// Logs every ramble row at its own day and minute in one transaction, or adds them to the recipe. Waits for the
    /// ramble to settle first, so an add never takes rows a final read or a resolution is about to change. Returns
    /// whether anything was added.
    func addRamble() async -> Bool {
        let capture = ramble.generation
        await ramble.settled()
        // Exit while it settled cancels the capture; nothing it held is logged then.
        guard ramble.generation == capture else { return false }
        let planned = ramble.planned
        guard !planned.isEmpty else { return false }
        deliver(planned.map(\.pick)) { planned.map(\.entry) }
        ramble.reset()
        return true
    }

    /// Re-reads the owner's side of the search once the log's writes land.
    func reloadSearch() async {
        try? await store.write { _ in }.value
        do {
            try await search.refresh()
            searchReloads += 1
            results = try search.local(query, section: section.id)
        } catch {
            FoodSearch.log.error("Reloading search failed: \(String(describing: error))")
        }
    }

    func hidePick(_ food: FoodSnapshot, from slot: TimelineSlot) async {
        let key = FoodSearchResult.key(food)
        switch slot {
        case let .hour(hour): store.updateSettings { $0.nutrition.hiddenPicks[hour, default: []].insert(key) }
        case let .section(section): store.updateSettings { $0.nutrition.hiddenSectionPicks[section.id, default: []].insert(key) }
        }
        await reloadSearch()
    }

    func hideFromHistory(_ food: FoodSnapshot, at date: Date = .now) async {
        store.updateSettings { $0.nutrition.hiddenHistory[FoodSearchResult.key(food)] = date }
        await reloadSearch()
    }

    /// The owner's icon for a food (`LocalStore.setIcon`). A search result is cached first, so the icon has a food to live
    /// on, and the recipe's ingredients of the food take it too.
    func setIcon(_ icon: String?, of food: FoodSnapshot, uncached: Food?) async {
        if let uncached { store.saveFood(uncached) }
        store.setIcon(icon, of: food)
        if addsIngredients { changeIngredients { $0.setIcon(icon, of: food) } }
        await reloadSearch()
    }

    func favorite(_ portion: FoodPortion, alterations: [IngredientAlteration]? = nil, id: UUID = UUID(), uncached: Food?) async {
        if let uncached { store.saveFood(uncached) }
        store.addFavorite(portion, alterations: alterations, id: id)
        await reloadSearch()
    }

    func unfavorite(_ id: UUID) async {
        store.deleteFavorite(id)
        await reloadSearch()
    }

    /// Adds the foods a meal photo shows, in one transaction: each name the server's model gives is matched against the
    /// local search (history first, then the owner's foods and USDA) and weighed at the model's grams, or left at the
    /// food's default serving when it has no weight. Throws when the server cannot be reached or refuses the photo.
    func addPhoto(jpeg: Data, note: String?) async throws -> PhotoOutcome {
        let foods = try await recognizer.recognize(jpeg: jpeg, note: note)
        // Each name scans the 7,300 USDA names a few times and reads their nutrition, too much for one frame.
        let index = search.index
        let matches = try await Task.detached { try foods.map { ($0, try index.match($0.search)) } }.value
        var outcome = PhotoOutcome(added: 0, unmatched: [])
        var picks: [LoggerPick] = []
        for (food, result) in matches {
            guard let result else {
                outcome.unmatched.append(food.name)
                continue
            }
            var pick = LoggerPick(result)
            if let grams = pick.portion.food.nutrition.allMeasures.first(where: { $0.name == SizeUnit.g.rawValue }) {
                pick.portion.serving = Serving(measure: grams, quantity: food.grams)
            }
            picks.append(pick)
            outcome.added += 1
        }
        if !picks.isEmpty { add(picks) }
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

    /// A typed or scanned barcode: a custom or cached food first, then Open Food Facts. A store item is only ever the
    /// owner's own food.
    func lookup(barcode text: String) async -> BarcodeOutcome {
        guard let barcode = ScannedBarcode(text) else { return .invalid }
        do {
            if barcode.isStoreItem {
                let foods = try await search.foods(storeItem: barcode.code)
                if foods.count > 1 { return .stores(foods, barcode) }
                return foods.first.map { .found(barcode.portion(of: $0)) } ?? .notFound(barcode)
            }
            guard let food = try await search.lookup(barcode: barcode.code) else { return .notFound(barcode) }
            return .found(barcode.portion(of: food))
        } catch {
            FoodSearch.log.info("Barcode lookup failed: \(String(describing: error))")
            return .unreachable
        }
    }
}
