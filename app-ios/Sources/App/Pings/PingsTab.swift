import Feedback
import SwiftUI

/// The ping screens the Pings tab pushes.
enum PingRoute: Hashable {
    case manage
    case history(UUID)

    @ViewBuilder
    var destination: some View {
        switch self {
        case .manage: ManagePingsView()
        case let .history(id): PingHistoryView(pingID: id)
        }
    }
}

/// The Pings tab: the Food Log's header row over a day's timeline, oldest first. "+" turns the tab bar into a drawer of
/// the pings, where a tap logs one onto the day shown and its row lands closed on the timeline, and Text starts a note
/// typed in its row. Swiping pages between days.
struct PingsTab: View {
    /// The app's shown day, which the Food Log and the Workout tab share.
    @Binding var day: CalendarDay
    /// Whether the drawer is open, which "+" in the tab bar sets.
    @Binding var adding: Bool

    @Environment(LocalStore.self) private var store
    @Observe(Ping.count) private var pingCount
    @State private var path: [PingRoute] = []
    @State private var creating = false
    @State private var editing: Set<UUID> = []
    @State private var added: UUID?
    @State private var drawerCover: CGFloat = 0
    @State private var newNote = PendingNote.load()

    var body: some View {
        NavigationStack(path: $path) {
            DayPager(day: $day) { shown in
                PingTimelinePage(
                    day: shown, editing: $editing, newNote: $newNote, added: added, covered: adding ? drawerCover : 0,
                    pingCount: pingCount, history: { push(.history($0.id)) }, create: { creating = true }
                )
            }
            .background(Theme.background)
            .safeAreaInset(edge: .top, spacing: 0) {
                PingsHeader(day: $day, pingCount: pingCount, create: { creating = true }, manage: { push(.manage) })
            }
            .overlay {
                PingDrawer(isOpen: $adding, covers: { drawerCover = $0 }) {
                    PingControls(day: day, log: log, write: writeNote).id(day)
                }
            }
            // One bar at a time: the drawer takes the tab bar's place.
            .toolbarVisibility(adding ? .hidden : .automatic, for: .tabBar)
            .animation(.snappy, value: adding)
            // The header row replaces the bar; the title still names the screen for VoiceOver and pushed screens' back button.
            .navigationTitle("Pings")
            .toolbarVisibility(.hidden, for: .navigationBar)
            .navigationDestination(for: PingRoute.self) { $0.destination }
            .sheet(isPresented: $creating) { PingEditor() }
        }
        .sensoryFeedback(.success, trigger: added)
        .onChange(of: newNote) { _, note in PendingNote.save(note) }
        .onChange(of: adding) { _, adding in
            guard adding else { return }
            // The drawer belongs to the timeline, so "+" on a pushed screen comes back to it.
            path = []
            // With no pings there is nothing to pick, so "+" makes the first one.
            if pingCount == 0 {
                self.adding = false
                creating = true
            }
        }
        .feedback(self)
    }

    /// A pushed screen brings the tab bar back, so the drawer closes first.
    private func push(_ route: PingRoute) {
        adding = false
        path.append(route)
    }

    private func log(_ ping: Ping, value: Int) {
        let log = PingLog(pingID: ping.id, value: value, at: PingLog.instant(on: day))
        store.insert(log)
        added = log.id
    }

    /// The drawer gives the timeline back for typing: the note's row opens at the time a ping logged now would get, with
    /// the cursor in it.
    private func writeNote() {
        let note = TimelineNote(text: "", at: PingLog.instant(on: day))
        newNote = note
        added = note.id
        adding = false
    }
}

/// The note Text started, kept across launches with what was typed in it (`persistDraft`), until it is written or
/// dropped. An empty note is never stored.
private struct PendingNote: Codable {
    let id: UUID
    let at: Date

    private static let key = "pings.new-note"

    static func load() -> TimelineNote? {
        DraftStore.load(Self.self, key: key).map { TimelineNote(id: $0.id, text: "", at: $0.at) }
    }

    static func save(_ note: TimelineNote?) {
        guard let note else { return DraftStore.clear(key) }
        DraftStore.save(Self(id: note.id, at: note.notedAt), key: key)
    }
}

/// Calendar, the day strip, and the ⋯ menu. A day's pill fills with the share of the pings logged that day.
private struct PingsHeader: View {
    @Binding var day: CalendarDay
    let pingCount: Int
    let create: () -> Void
    let manage: () -> Void

    var body: some View {
        DayHeaderRow(day: $day) {
            DayStrip(selected: day) { shown in
                PingDayPill(day: shown, pings: pingCount, isSelected: shown == day) { day = shown }
            }
        } menu: {
            Menu {
                Button("New Ping", systemImage: "plus", action: create)
                Button("Edit Pings", systemImage: "pencil", action: manage)
            } label: {
                // Inside the label, so the whole circle opens the menu, not just the glyph.
                Label("Ping Options", systemImage: "ellipsis").labelStyle(.iconOnly).frame(width: 48, height: 48).contentShape(.circle)
            }
        }
        .padding(.bottom, 6)
        .background(Theme.background)
        .feedback(self)
    }
}

private struct PingDayPill: View {
    let day: CalendarDay
    let pings: Int
    let isSelected: Bool
    let action: () -> Void

    @Observe private var logged: Int

    init(day: CalendarDay, pings: Int, isSelected: Bool, action: @escaping () -> Void) {
        self.day = day
        self.pings = pings
        self.isSelected = isSelected
        self.action = action
        _logged = Observe(PingLog.pingsLogged(on: day))
    }

    var body: some View {
        DayPill(
            day: day, isSelected: isSelected,
            ring: pings == 0 ? nil : DayRing(fraction: Double(logged) / Double(pings), color: Theme.ping),
            action: action
        )
    }
}
