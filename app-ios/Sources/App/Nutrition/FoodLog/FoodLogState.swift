import Foundation
import GRDB
import SwiftUI

/// What the logger sheet opens with. Every add affordance on the Food Log (the search field, its barcode and Your
/// Foods buttons, an hour's +) builds one, and `FoodLogTab` presents the logger for it.
struct LogFoodRequest: Identifiable, Hashable {
    enum Start: Hashable { case search, barcode, library }

    let id = UUID()
    var day: CalendarDay
    /// The hour's minute when an hour's + asked; nil logs at the current time.
    var minute: Int?
    var start = Start.search
}

/// The Food Log's screen state, shared by the header, the day pages, and the bottom bars. Data stays in the store;
/// this holds only what the owner is doing.
@MainActor @Observable
final class FoodLogState {
    enum Action: Hashable { case copy, move }

    /// Selected entries waiting for a paste target: the bar lists targets, and with `inline` every hour's + pastes.
    struct Pending: Hashable {
        var action: Action
        var entries: [FoodEntry]
        var inline = false
    }

    /// "Copied 3 foods to Today" over the bottom bar, with Undo when it can be taken back.
    struct Notice: Identifiable, Hashable {
        let id = UUID()
        let message: String
        var undo: LogUndo?
    }

    /// Create Recipe's editor, prefilled from the selection.
    struct RecipeRequest: Identifiable {
        let id = UUID()
        let draft: RecipeDraft
    }

    /// How far the pager, the week strip, and the calendar reach from today, in days.
    static let daysBack = 730
    static let daysAhead = 365

    /// A selection belongs to the day it was made on, so leaving that day ends it. Paste Inline keeps going: its
    /// pending copy carries the entries.
    var day = CalendarDay.today {
        didSet {
            guard day != oldValue else { return }
            if selecting, pending?.inline != true { endSelection() }
            if stripCollapsed { stripCollapsed = false }
        }
    }
    /// The shown day's entries in timeline order, so the bars never read the database.
    var entries: [FoodEntry] = []
    var selecting = false
    var selection: Set<UUID> = []
    var pending: Pending?
    var logRequest: LogFoodRequest?
    var editing: FoodEntry?
    var note: NoteDraft?
    var path: [FoodLogRoute] = []
    var notice: Notice?
    var recipeRequest: RecipeRequest?
    /// The shown page is scrolled down, so a week strip set to Show folds away.
    var stripCollapsed = false

    var selectedEntries: [FoodEntry] { entries.filter { selection.contains($0.id) } }

    func select(_ id: UUID) {
        if selecting {
            if selection.remove(id) == nil { selection.insert(id) }
        } else {
            selecting = true
            selection = [id]
        }
    }

    /// An hour pill's tap: selects the hour's entries, or in select mode adds them, or removes them when all are in.
    func selectHour(_ ids: [UUID]) {
        guard !ids.isEmpty else { return }
        if selecting {
            selection = FoodLog.toggling(ids, in: selection)
        } else {
            selecting = true
            selection = Set(ids)
        }
    }

    func createRecipe() {
        recipeRequest = RecipeRequest(draft: FoodLog.recipeDraft(selectedEntries))
        endSelection()
    }

    /// Copies or moves `entries`, ends select mode, and confirms with Undo.
    func relocate(_ entries: [FoodEntry], _ action: Action, to target: PasteTarget, in store: LocalStore) {
        let undo = store.relocate(entries, action, to: target)
        notice = Notice(message: FoodLog.confirmation(action, count: entries.count, to: target), undo: undo)
        endSelection()
    }

    func paste(to target: PasteTarget, in store: LocalStore) {
        guard let pending else { return }
        relocate(pending.entries, pending.action, to: target, in: store)
    }

    func undo(in store: LocalStore) {
        guard let undo = notice?.undo else { return }
        store.undo(undo)
        notice = nil
    }

    func explode(_ id: UUID, in store: LocalStore) {
        let exploding = store.explode(id)
        Task {
            if (try? await exploding.value) != true {
                notice = Notice(message: "Its recipe was deleted, so it can't be exploded")
            }
        }
    }

    func endSelection() {
        selecting = false
        selection = []
        pending = nil
    }

    func requestLog(minute: Int? = nil, start: LogFoodRequest.Start = .search) {
        logRequest = LogFoodRequest(day: day, minute: minute, start: start)
    }
}

/// A note open in the editor: an existing one, or a new one on a day.
struct NoteDraft: Identifiable, Hashable {
    var note: FoodLogNote
    var isNew: Bool

    var id: UUID { note.id }
}

enum FoodLogRoute: Hashable {
    case overview(CalendarDay)
    case contributors(CalendarDay, NutrientID)
}

/// What takes a copy or move back: removing the copies, or returning the moved entries to their days and minutes.
enum LogUndo: Hashable {
    case remove([UUID])
    case restore([FoodEntry])
}

extension LocalStore {
    /// Copies or moves `entries` to `target` and returns its undo. Copies are made from the entries in hand, so the
    /// undo knows their ids.
    func relocate(_ entries: [FoodEntry], _ action: FoodLogState.Action, to target: PasteTarget) -> LogUndo {
        let relocations = FoodLog.relocations(entries, to: target, now: .now)
        switch action {
        case .copy:
            let byID = Dictionary(uniqueKeysWithValues: entries.map { ($0.id, $0) })
            let copies = relocations.flatMap { relocation in
                relocation.ids.compactMap { byID[$0] }.map { FoodEntry($0.portion, day: relocation.day, minute: relocation.minute) }
            }
            write { db in
                for copy in copies {
                    try copy.insert(db)
                }
            }
            return .remove(copies.map(\.id))
        case .move:
            for relocation in relocations {
                moveEntries(relocation.ids, to: relocation.day, minute: relocation.minute)
            }
            return .restore(entries)
        }
    }

    func undo(_ undo: LogUndo) {
        switch undo {
        case let .remove(ids):
            deleteEntries(ids)
        case let .restore(entries):
            write { db in
                for original in entries {
                    guard let current = try FoodEntry.fetchOne(db, key: original.key) else { continue }
                    var restored = current
                    restored.day = original.day
                    restored.minute = original.minute
                    restored.updatedAt = .now
                    try restored.updateChanges(db, from: current)
                }
            }
        }
    }

    /// Replaces a logged recipe with its ingredients at the amounts eaten, on the entry's day and minute, in one
    /// transaction. Resolves false when the entry is not a recipe or its recipe no longer exists.
    @discardableResult
    func explode(_ id: UUID) -> Task<Bool, any Error> {
        write { db in
            guard let entry = try FoodEntry.fetchOne(db, key: FoodEntry.key(id)), entry.food.source == .recipe,
                  let recipeID = entry.food.foodID, let recipe = try Recipe.fetchOne(db, key: recipeID)
            else { return false }
            try entry.delete(db)
            for portion in FoodLog.exploded(entry.serving, of: recipe) {
                try FoodEntry(portion, day: entry.day, minute: entry.minute).insert(db)
            }
            return true
        }
    }
}
