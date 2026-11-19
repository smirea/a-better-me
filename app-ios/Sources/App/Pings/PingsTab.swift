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

/// The Pings tab: the Food Log's header row over a day's pings, logged onto that day by picking them and tapping Log.
/// Swiping pages between days.
struct PingsTab: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var path: [PingRoute] = []
    @State private var day = CalendarDay.today
    /// The day that was today when the tab last looked, so a return on a new day moves today's page with it.
    @State private var today = CalendarDay.today
    @State private var creating = false

    var body: some View {
        NavigationStack(path: $path) {
            PingLogger(day: $day, pages: true, history: { path.append(.history($0.id)) }) {
                EmptyView()
            } empty: {
                ContentUnavailableView {
                    Label("No Pings", systemImage: "hand.tap")
                } description: {
                    Text("Track a mood, a glass of water, or anything else in a tap.")
                } actions: {
                    Button("New Ping") { creating = true }.secondaryPill().fixedSize()
                }
                .padding(.top, 80)
            }
            .safeAreaInset(edge: .top, spacing: 0) {
                PingsHeader(day: $day, create: { creating = true }, manage: { path.append(.manage) })
            }
            // The header row replaces the bar; the title still names the screen for VoiceOver and pushed screens' back button.
            .navigationTitle("Pings")
            .toolbarVisibility(.hidden, for: .navigationBar)
            .navigationDestination(for: PingRoute.self) { $0.destination }
            .sheet(isPresented: $creating) { PingEditor() }
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active, today != .today else { return }
            if day == today { day = .today }
            today = .today
        }
        .feedback(self)
    }
}

/// Calendar, the day strip, and the ⋯ menu. A day's pill fills with the share of the pings logged that day.
private struct PingsHeader: View {
    @Binding var day: CalendarDay
    let create: () -> Void
    let manage: () -> Void

    @Observe(Ping.count) private var pingCount

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
