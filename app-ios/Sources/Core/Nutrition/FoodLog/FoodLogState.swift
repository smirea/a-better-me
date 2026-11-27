import Foundation
import GRDB
import Synchronization

/// What the logger sheet opens with. Every add affordance on the Food Log (the search field, its barcode and Your
/// Foods buttons, an hour's +) builds one, and `FoodLogTab` presents the logger for it.
struct LogFoodRequest: Identifiable, Hashable {
    let id = UUID()
    var day: CalendarDay
    /// The hour's minute when an hour's + asked, or the section's (`[MealSection].logMinute`); nil logs at the current
    /// time.
    var minute: Int?
    /// The section whose + asked, which the plate logs into whatever its minute.
    var section: MealSection?
    var start = LoggerTab.search
}

struct FoodLogHeaderSize: Equatable {
    var height: Double = 0
    var row: Double = 0
}

/// The Food Log's screen state, shared by the header, the day pages, and the bottom bars. Data stays in the store;
/// this holds only what the owner is doing.
@MainActor @Observable
final class FoodLogState {
    enum Action: Hashable {
        case copy, move

        var title: String { self == .copy ? "Copy" : "Move" }
    }

    /// "Copied 3 foods to Today" over the bottom bar, with Undo when it can be taken back.
    struct Notice: Identifiable, Equatable {
        let id = UUID()
        let message: String
        var undo: LogUndo?

        static func == (lhs: Notice, rhs: Notice) -> Bool { lhs.id == rhs.id }
    }

    struct RecipeRequest: Identifiable {
        let id = UUID()
        let draft: RecipeDraft
        /// The selection it was made from, which saving the recipe replaces.
        let entries: [FoodEntry]
    }

    /// The app's one shown day, which the Workout and Pings tabs read and write too (`RootView`). Changing it leaves a
    /// selection, and a copy or move, exactly as they were.
    var day = CalendarDay.today
    /// The selected entries, from any days, as they were when picked or last seen on the shown day. A selection is
    /// select mode: deselecting the last entry ends it, and its Copy or Move.
    private(set) var selected: [UUID: FoodEntry] = [:] {
        didSet {
            if selecting == selected.isEmpty { selecting = !selected.isEmpty }
            if selected.isEmpty, action != nil { action = nil }
        }
    }
    /// Stored apart from `selected`, so the tab bar's "+" re-renders when select mode starts or ends, not on each toggle.
    private(set) var selecting = false
    /// Copy or Move, once picked: the bar lists destinations and every hour or section, on any day, pastes the
    /// selection there.
    var action: Action?
    var logRequest: LogFoodRequest? {
        didSet {
            if oldValue != nil, logRequest == nil { expectAdditions() }
        }
    }
    var editing: FoodEntry?
    /// The logged recipe Alter is open on.
    var altering: FoodEntry?
    /// Whether the days list their supplements under the row of pictures. Shared, so paging keeps it.
    var supplementsExpanded = false
    /// The navigation stack's `NavigationPath`, which the app target reads and writes as `path`. Core has no SwiftUI,
    /// so it holds the value untyped.
    var navigationPath: Any?
    var notice: Notice?
    var recipeRequest: RecipeRequest?
    /// How far the header row has slid away on each day's page (`FoodLog.headerSlide`). It stops changing once the row
    /// is gone, so scrolling the rest of a long day re-renders nothing.
    private(set) var scrolled: [CalendarDay: Double] = [:]
    /// The header's height, which each page keeps clear above its first row, and the row's, which slides away.
    var header = FoodLogHeaderSize()
    /// Until when entries arriving on a page come from the owner (a log, a paste, an Explode) and scroll into view.
    /// Entries a sync brings leave the page where it is.
    @ObservationIgnored private(set) var revealsAdditionsUntil = Date.distantPast

    func isSelected(_ id: UUID) -> Bool { selected[id] != nil }

    /// In timeline order across days, so a recipe lists its ingredients as they were eaten.
    var selectedEntries: [FoodEntry] {
        selected.values.sorted { ($0.day, $0.minute, $0.id.uuidString) < ($1.day, $1.minute, $1.id.uuidString) }
    }

    /// A tile's tap: outside select mode it opens the entry editor, inside it toggles the entry.
    func tap(_ entry: FoodEntry) {
        if selecting { toggle(entry) } else { editing = entry }
    }

    func toggle(_ entry: FoodEntry) {
        if selected.removeValue(forKey: entry.id) == nil { selected[entry.id] = entry }
    }

    /// A long press, or Select All: the entries join the selection, never toggling one off.
    func select(_ entries: [FoodEntry]) {
        for entry in entries {
            selected[entry.id] = entry
        }
    }

    /// An hour's or section's pill: its entries join the selection, or leave it when all of them are in.
    func selectHour(_ entries: [FoodEntry]) {
        if !entries.isEmpty, entries.allSatisfy({ isSelected($0.id) }) {
            for entry in entries {
                selected[entry.id] = nil
            }
        } else {
            select(entries)
        }
    }

    /// A tile's Copy swipe, or Copy Day: those entries alone, with every hour a paste target.
    func copy(_ entries: [FoodEntry]) {
        selected = [:]
        select(entries)
        action = entries.isEmpty ? nil : .copy
    }

    /// The ✕ the tab bar's + turns into: from Copy or Move's destinations back to the selection, then out of select
    /// mode.
    func stepBack() {
        if action != nil { action = nil } else { endSelection() }
    }

    /// Keeps the selection true to the shown day's entries: an entry edited meanwhile is carried as it is now, and one
    /// removed (by the editor, a sync, the agent API) leaves the selection.
    func shown(_ entries: [FoodEntry], on day: CalendarDay) {
        guard selecting else { return }
        let current = Dictionary(uniqueKeysWithValues: entries.map { ($0.id, $0) })
        for (id, entry) in selected where entry.day == day && current[id] != entry {
            selected[id] = current[id]
        }
    }

    func createRecipe() {
        let entries = selectedEntries
        recipeRequest = RecipeRequest(draft: FoodLog.recipeDraft(entries), entries: entries)
        endSelection()
    }

    func replace(_ entries: [FoodEntry], with recipe: Recipe, in store: LocalStore) {
        guard let replacement = FoodLog.replacement(for: entries, with: recipe) else { return }
        expectAdditions()
        let replacing = store.replace(entries, with: replacement)
        Task {
            notice = if (try? await replacing.value) == true {
                Notice(message: "Replaced \(entries.count) foods with \(recipe.name)", undo: .unreplace(added: replacement.id, removed: entries))
            } else {
                Notice(message: "Saved \(recipe.name). The foods changed meanwhile, so they stayed")
            }
        }
    }

    /// Saves a meal line's suggestion as a one-serving recipe and logs one serving of it in place of the section's
    /// foods, in the write that saves it. Quick adds stay, as they stay out of the recipe. Undo takes both back.
    @discardableResult
    func createMeal(_ name: String, from entries: [FoodEntry], in store: LocalStore) -> Task<Void, Never> {
        let foods = entries.filter { $0.food.source != .quickAdd }
        let recipe = FoodLog.mealRecipe(name, from: foods)
        guard let replacement = FoodLog.replacement(for: foods, with: recipe) else { return Task {} }
        expectAdditions()
        let replacing = store.replace(foods, with: replacement, saving: recipe)
        return Task {
            notice = if (try? await replacing.value) == true {
                Notice(message: "Replaced \(foods.count) foods with \(name)", undo: .unreplace(added: replacement.id, removed: foods, recipe: recipe.id))
            } else {
                Notice(message: "Saved \(name). The foods changed meanwhile, so they stayed", undo: .deleteRecipe(recipe.id))
            }
        }
    }

    /// Copies or moves the selection to `target`, confirms it with Undo, and ends select mode: Copy or Move's
    /// destinations, a paste row, or Premove's arrows.
    func paste(_ action: Action, to target: PasteTarget, in store: LocalStore) {
        let entries = selectedEntries
        guard !entries.isEmpty else { return }
        expectAdditions()
        let undo = store.relocate(entries, action, to: target)
        notice = Notice(message: FoodLog.confirmation(action, count: entries.count, to: target), undo: undo)
        endSelection()
    }

    /// The trash, or a tile's Remove swipe: no question asked, since the notice's Undo logs them back.
    func remove(_ entries: [FoodEntry], in store: LocalStore) {
        store.deleteEntries(entries.map(\.id))
        notice = Notice(message: "Removed \(entries.count == 1 ? "1 food" : "\(entries.count) foods")", undo: .relog(entries))
        for entry in entries {
            selected[entry.id] = nil
        }
    }

    func undo(in store: LocalStore) {
        guard let undo = notice?.undo else { return }
        store.undo(undo)
        notice = nil
    }

    func explode(_ id: UUID, in store: LocalStore) {
        expectAdditions()
        let exploding = store.explode(id)
        Task {
            do {
                if try await exploding.value == false { notice = Notice(message: "Its recipe was deleted, so it can't be exploded") }
            } catch {
                notice = Notice(message: "Couldn't explode the recipe")
            }
        }
    }

    func expectAdditions() {
        revealsAdditionsUntil = .now.addingTimeInterval(3)
    }

    func setScrolled(_ offset: Double, on day: CalendarDay) {
        if scrolled[day, default: 0] != offset { scrolled[day] = offset }
    }

    func endSelection() {
        selected = [:]
    }

    func requestLog(minute: Int? = nil, section: MealSection? = nil, start: LoggerTab = .search) {
        logRequest = LogFoodRequest(day: day, minute: minute, section: section, start: start)
    }
}

enum FoodLogRoute: Hashable {
    case overview(CalendarDay)
    case contributors(CalendarDay, NutrientID)
    case strategy
    case recipe(UUID)
}

/// Where an entry sits: its day, minute, and meal section.
struct EntryTime: Hashable {
    let day: CalendarDay
    let minute: Int
    let section: String?
}

extension FoodEntry {
    var time: EntryTime { EntryTime(day: day, minute: minute, section: section) }
}

struct MovedEntry: Hashable {
    let id: UUID
    let from: EntryTime
    let to: EntryTime
}

/// The entries a move changed and where each was. The move's write fills it and its undo's write, which always runs
/// later, reads it, so the undo restores what the move actually replaced.
final class MoveRecord: Sendable {
    let moves = Mutex<[MovedEntry]>([])
}

/// What takes a copy, move, or removal back: removing the copies, returning the moved entries to where they were, or
/// logging the removed ones back.
enum LogUndo {
    case remove([UUID])
    case restore(MoveRecord)
    /// Removes the recipe entry that replaced a selection and logs the selection back, under new ids. A meal line's
    /// Create also deletes the recipe it saved, since the owner made it in one tap.
    case unreplace(added: UUID, removed: [FoodEntry], recipe: UUID? = nil)
    /// Takes back a meal line's Create whose foods changed before they could be replaced.
    case deleteRecipe(UUID)
    /// Logs removed entries back, under new ids as `unreplace` does.
    case relog([FoodEntry])
}

extension LocalStore {
    /// Copies or moves `entries` to `target` and returns its undo. Copy ids are chosen here so the undo knows them;
    /// the copies are made from the rows as the write finds them, so a source a sync deleted is not brought back.
    func relocate(_ entries: [FoodEntry], _ action: FoodLogState.Action, to target: PasteTarget) -> LogUndo {
        let relocations = FoodLog.relocations(entries, to: target, now: .now)
        switch action {
        case .copy:
            let copies = relocations.flatMap { relocation in
                relocation.ids.map { (source: $0, id: UUID(), to: relocation) }
            }
            write { db in
                let sections = try MealSection.current(db)
                for copy in copies {
                    guard let source = try FoodEntry.fetchOne(db, key: FoodEntry.key(copy.source)) else { continue }
                    var entry = source.copy(day: copy.to.day, minute: copy.to.minute, section: copy.to.section(for: source, in: sections))
                    entry.id = copy.id
                    try entry.insert(db)
                }
            }
            return .remove(copies.map(\.id))
        case .move:
            let record = MoveRecord()
            write { db in
                let sections = try MealSection.current(db)
                var moved: [MovedEntry] = []
                for relocation in relocations {
                    for id in relocation.ids {
                        guard let entry = try FoodEntry.fetchOne(db, key: FoodEntry.key(id)) else { continue }
                        var changed = entry
                        changed.day = relocation.day
                        changed.minute = relocation.minute
                        changed.section = relocation.section(for: entry, in: sections)
                        try changed.update(db, from: entry)
                        moved.append(MovedEntry(id: id, from: entry.time, to: changed.time))
                    }
                }
                record.moves.withLock { $0 = moved }
            }
            return .restore(record)
        }
    }

    /// Swaps `entries` for `replacement` in one transaction, unless one of them changed or went since it was selected
    /// (another device, the agent API), so a stale selection never comes back inside the recipe or through Undo.
    /// Resolves whether it swapped. A section-less replacement takes the section its minute falls in, as `log` does.
    /// `recipe` is saved in the same write either way, so the meal index never sees the foods and their recipe apart.
    func replace(_ entries: [FoodEntry], with replacement: FoodEntry, saving recipe: Recipe? = nil) -> Task<Bool, any Error> {
        write { db in
            if let recipe { try Self.insert(recipe, in: db) }
            for entry in entries {
                guard try FoodEntry.fetchOne(db, key: FoodEntry.key(entry.id))?.updatedAt == entry.updatedAt else { return false }
            }
            _ = try FoodEntry.deleteAll(db, keys: entries.map { FoodEntry.key($0.id) })
            var entry = replacement
            if entry.section == nil { entry.section = try MealSection.current(db).section(at: entry.minute).id }
            try entry.insert(db)
            return true
        }
    }

    func undo(_ undo: LogUndo) {
        switch undo {
        case let .unreplace(added, removed, recipe):
            write { db in
                _ = try FoodEntry.deleteOne(db, key: FoodEntry.key(added))
                if let recipe { _ = try Recipe.deleteOne(db, key: Recipe.key(recipe)) }
                for entry in removed {
                    try entry.copy(day: entry.day, minute: entry.minute, section: entry.section).insert(db)
                }
            }
        case let .remove(ids):
            deleteEntries(ids)
        case let .deleteRecipe(id):
            deleteRecipe(id)
        case let .relog(entries):
            write { db in
                for entry in entries {
                    try entry.copy(day: entry.day, minute: entry.minute, section: entry.section).insert(db)
                }
            }
        case let .restore(record):
            write { db in
                for move in record.moves.withLock({ $0 }) {
                    guard let current = try FoodEntry.fetchOne(db, key: FoodEntry.key(move.id)),
                          current.time == move.to
                    else { continue }
                    var restored = current
                    restored.day = move.from.day
                    restored.minute = move.from.minute
                    restored.section = move.from.section
                    try restored.update(db, from: current)
                }
            }
        }
    }

    /// Replaces a logged recipe with its ingredients at the amounts eaten, on the entry's day and minute, in one
    /// transaction. An altered recipe explodes into what it was eaten as, so it needs no recipe. Resolves false when
    /// the entry is not a recipe, or is unaltered and its recipe no longer exists.
    @discardableResult
    func explode(_ id: UUID) -> Task<Bool, any Error> {
        write { db in
            guard let entry = try FoodEntry.fetchOne(db, key: FoodEntry.key(id)), entry.food.source == .recipe else { return false }
            let recipe = try entry.alterations == nil ? entry.food.foodID.flatMap { try Recipe.fetchOne(db, key: $0) } : nil
            let portions = FoodLog.ingredients(entry.serving, of: entry, recipe: recipe).eaten
            guard !portions.isEmpty else { return false }
            try entry.delete(db)
            for portion in portions {
                try FoodEntry(portion, day: entry.day, minute: entry.minute, section: entry.section).insert(db)
            }
            return true
        }
    }

    /// Saves Alter: the entry becomes `alterations` of its recipe, or the recipe as it made it when nothing differs.
    /// Saving an entry that was never altered without a change writes nothing, so its snapshot from when it was logged
    /// stays.
    func alter(_ id: UUID, to alterations: [IngredientAlteration]) {
        write { db in
            guard let entry = try FoodEntry.fetchOne(db, key: FoodEntry.key(id)) else { return }
            guard entry.alterations != nil || alterations.isAltered else { return }
            var altered = entry.altered(to: alterations)
            altered.updatedAt = .now
            try altered.update(db, from: entry)
        }
    }
}
