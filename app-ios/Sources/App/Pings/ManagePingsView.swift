import Feedback
import SwiftUI

/// Every ping in the order it lists everywhere: drag to reorder, tap to edit, + to add one.
struct ManagePingsView: View {
    @Environment(LocalStore.self) private var store
    @Observe(Ping.all) private var pings
    @State private var editing: Ping?
    @State private var creating = false
    /// The order while a drag's write is on its way, so the rows don't jump back for a frame.
    @State private var moved: [Ping]?

    var body: some View {
        let shown = moved ?? pings
        List {
            if !shown.isEmpty {
                ThemedSection(footer: "Pings list in this order everywhere.") {
                    ForEach(shown) { ping in
                        Button { editing = ping } label: {
                            RowLabel(title: ping.name, detail: ping.kind.summary, systemImage: ping.icon, iconTint: Theme.ping)
                        }
                        .accessibilityIdentifier("ping-\(ping.name)")
                    }
                    .onMove { offsets, destination in
                        var order = shown
                        order.move(fromOffsets: offsets, toOffset: destination)
                        moved = order
                        store.orderPings(order.map(\.id))
                    }
                }
            }
        }
        .environment(\.editMode, .constant(.active))
        .themedList()
        .overlay {
            if shown.isEmpty {
                ContentUnavailableView {
                    Label("No Pings", systemImage: "hand.tap")
                } description: {
                    Text("Track a mood, a glass of water, or anything else in a tap.")
                } actions: {
                    Button("New Ping") { creating = true }.secondaryPill().fixedSize()
                }
            }
        }
        .detailTitle("Pings")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("New Ping", systemImage: "plus") { creating = true }
            }
        }
        .onChange(of: pings) { moved = nil }
        .sheet(item: $editing) { PingEditor(ping: $0) }
        .sheet(isPresented: $creating) { PingEditor() }
        .feedback(self)
    }
}

extension PingKind {
    /// "Boolean", or a range's span and end labels: "1–5 · Terrible to Great".
    var summary: String {
        switch self {
        case .boolean: return "Boolean"
        case let .range(steps):
            let span = "1–\(steps.count)"
            guard let first = steps.first, let last = steps.last, !first.isEmpty, !last.isEmpty else { return span }
            return "\(span) · \(first) to \(last)"
        }
    }
}
