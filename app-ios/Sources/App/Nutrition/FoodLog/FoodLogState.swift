import Foundation
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
        var ids: [UUID]
        var inline = false
    }

    /// How far the pager, the week strip, and the calendar reach from today, in days.
    static let daysBack = 730
    static let daysAhead = 365

    var day = CalendarDay.today
    var selecting = false
    var selection: Set<UUID> = []
    var pending: Pending?
    var logRequest: LogFoodRequest?
    var editing: FoodEntry?
    var note: NoteDraft?
    var path: [FoodLogRoute] = []

    func select(_ id: UUID) {
        if selecting {
            if selection.remove(id) == nil { selection.insert(id) }
        } else {
            selecting = true
            selection = [id]
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

extension LocalStore {
    /// Copies or moves `entries` to `target`.
    func relocate(_ entries: [FoodEntry], _ action: FoodLogState.Action, to target: PasteTarget) {
        for relocation in FoodLog.relocations(entries, to: target, now: .now) {
            switch action {
            case .copy: copyEntries(relocation.ids, to: relocation.day, minute: relocation.minute)
            case .move: moveEntries(relocation.ids, to: relocation.day, minute: relocation.minute)
            }
        }
    }

    /// The entries with `ids`, read now, in timeline order.
    func entries(_ ids: some Collection<UUID>) -> [FoodEntry] {
        let keys = ids.map(FoodEntry.key)
        do {
            return try read { try FoodEntry.fetchAll($0, keys: keys) }.sorted { ($0.day, $0.minute, $0.createdAt) < ($1.day, $1.minute, $1.createdAt) }
        } catch {
            Self.log.error("Could not read the selected entries: \(String(describing: error))")
            return []
        }
    }
}
