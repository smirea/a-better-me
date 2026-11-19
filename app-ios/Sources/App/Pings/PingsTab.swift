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

/// The Pings tab: today's pings, logged by picking them and tapping Log. "+" makes a new ping.
struct PingsTab: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var path: [PingRoute] = []
    @State private var creating = false

    var body: some View {
        // Reading `scenePhase` re-evaluates the day when the scene becomes active, so a new day shows on return.
        let _ = scenePhase
        let today = Calendar.current.startOfDay(for: .now)
        NavigationStack(path: $path) {
            PingLogger(today: today, history: { path.append(.history($0.id)) }) {
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
            .id(today)
            .screenTitle("Pings")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink(value: PingRoute.manage) { Image(systemName: "pencil") }
                        .accessibilityLabel("Edit Pings")
                }
            }
            .navigationDestination(for: PingRoute.self) { $0.destination }
            .sheet(isPresented: $creating) { PingEditor() }
        }
        .feedback(self)
    }
}
