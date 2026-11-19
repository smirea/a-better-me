import Feedback
import SwiftUI

extension Theme {
    static let ping = Color(hex: 0x5AC8C8)
}

/// Today's pings as rows the owner picks from, under `header`, and a Log pill once something is picked. The Pings tab
/// and the Dashboard's "+" sheet both show it. `today` is the start of the day, and the caller gives the view that
/// day as its identity, so a new day reads its own logs.
struct PingLogger<Header: View, Empty: View>: View {
    /// Pushes a ping's history from its expanded row; nil where the list can't push, as in a sheet.
    var history: ((Ping) -> Void)?
    var onLogged: () -> Void = {}
    @ViewBuilder let header: Header
    @ViewBuilder let empty: Empty

    @Environment(LocalStore.self) private var store
    @Observe private var statuses: [PingStatus]
    @State private var selection = PingSelection()
    @State private var expanded: Set<UUID> = []
    @State private var logged = 0

    init(
        today: Date, history: ((Ping) -> Void)? = nil, onLogged: @escaping () -> Void = {},
        @ViewBuilder header: () -> Header, @ViewBuilder empty: () -> Empty
    ) {
        _statuses = Observe(PingStatus.today(from: today))
        self.history = history
        self.onLogged = onLogged
        self.header = header()
        self.empty = empty()
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                header
                if statuses.isEmpty {
                    empty
                } else {
                    rows
                }
            }
            .padding(.horizontal, Theme.margin)
            .padding(.vertical, 8)
        }
        .scrollBounceBehavior(.basedOnSize)
        .scrollDismissesKeyboard(.interactively)
        .background(Theme.background)
        .pinnedActions {
            if !selection.isEmpty {
                PinnedActionButton("Log") {
                    store.logPings(selection.logs())
                    selection = PingSelection()
                    expanded = []
                    logged += 1
                    onLogged()
                }
            }
        }
        .sensoryFeedback(.success, trigger: logged)
        .animation(.snappy(duration: 0.25), value: expanded)
        .animation(.snappy(duration: 0.25), value: selection.isEmpty)
    }

    private var rows: some View {
        VStack(spacing: 0) {
            ForEach(statuses) { status in
                let id = status.id
                if id != statuses.first?.id { Divider().overlay(Theme.separator) }
                PingRow(
                    status: status, picked: selection.value(id), isExpanded: expanded.contains(id),
                    note: Binding(get: { selection.notes[id] ?? "" }, set: { note in
                        selection.notes[id] = note
                        if status.ping.kind == .boolean, !note.isEmpty { selection.pick(id) }
                    }),
                    history: history.map { open in { open(status.ping) } },
                    pick: { selection.toggle(id, value: $0) },
                    expand: { expanded.formSymmetricDifference([id]) }
                )
            }
        }
        .background(Theme.surface, in: .rect(cornerRadius: Theme.cornerRadius))
        .clipShape(.rect(cornerRadius: Theme.cornerRadius))
    }
}

/// One ping: its icon and name, and the least that says where today stands beside the control that picks it. A tap
/// anywhere but the control opens it: a range's steps drop under the name with their labels, each on its own row when
/// they don't fit side by side, and every ping gets a note.
struct PingRow: View {
    let status: PingStatus
    let picked: Int?
    let isExpanded: Bool
    @Binding var note: String
    let history: (() -> Void)?
    let pick: (Int) -> Void
    let expand: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            switch status.ping.kind {
            case .boolean:
                HStack(spacing: 8) {
                    title
                    Spacer(minLength: 8)
                    if let summary = status.summary {
                        Text(summary).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary).lineLimit(1)
                    }
                    RowActionButton(
                        title: picked == nil ? "Log \(status.ping.name)" : "Don't log \(status.ping.name)",
                        systemImage: picked == nil ? "plus" : "checkmark", isOn: picked != nil
                    ) { pick(1) }
                }
            case let .range(labels):
                if isExpanded {
                    title.frame(minHeight: 44)
                    if labels.contains(where: { !$0.isEmpty }) {
                        ViewThatFits(in: .horizontal) {
                            HStack(alignment: .top, spacing: 10) {
                                ForEach(labels.indices, id: \.self) { index in
                                    VStack(spacing: 2) {
                                        step(index + 1, labels)
                                        Text(labels[index]).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary).lineLimit(1).fixedSize()
                                    }
                                    .frame(maxWidth: .infinity)
                                }
                            }
                            VStack(alignment: .leading, spacing: 0) {
                                ForEach(labels.indices, id: \.self) { index in
                                    HStack(spacing: 6) {
                                        step(index + 1, labels)
                                        Text(labels[index]).font(AppFont.rowTitle).foregroundStyle(Theme.textSecondary)
                                    }
                                }
                            }
                        }
                    } else {
                        steps(labels, stretched: true)
                    }
                } else {
                    ViewThatFits(in: .horizontal) {
                        HStack(spacing: 8) {
                            title
                            Spacer(minLength: 8)
                            steps(labels, stretched: false)
                        }
                        VStack(alignment: .leading, spacing: 0) {
                            title.frame(minHeight: 44)
                            steps(labels, stretched: true)
                        }
                    }
                }
            }
            if isExpanded {
                HStack(spacing: 12) {
                    TextField("Note", text: $note, axis: .vertical)
                        .font(AppFont.rowTitle)
                        .lineLimit(1...4)
                        .accessibilityLabel("\(status.ping.name) note")
                    if let history {
                        Button("History", action: history).chipButton().accessibilityLabel("\(status.ping.name) history")
                    }
                }
                .padding(.bottom, 6)
            }
        }
        .padding(.leading, 16)
        .padding(.trailing, 8)
        .padding(.vertical, 4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(.rect)
        .onTapGesture(perform: expand)
        .accessibilityElement(children: .contain)
        .accessibilityAction(named: isExpanded ? "Collapse" : "Expand", expand)
        .feedback(self)
    }

    private var title: some View {
        HStack(spacing: 12) {
            Image(systemName: status.ping.icon).font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.ping).frame(width: 24)
            Text(status.ping.name).font(AppFont.rowTitle).lineLimit(1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
    }

    private func steps(_ labels: [String], stretched: Bool) -> some View {
        HStack(spacing: 0) {
            ForEach(labels.indices, id: \.self) { index in
                step(index + 1, labels).frame(maxWidth: stretched ? .infinity : nil)
            }
        }
    }

    /// Filled white while picked; ringed when it is the step today's latest log holds.
    private func step(_ value: Int, _ labels: [String]) -> some View {
        let isPicked = picked == value
        return Button { pick(value) } label: {
            Text("\(value)")
                .font(AppFont.number(14))
                .foregroundStyle(isPicked ? Theme.onPrimary : Theme.textPrimary)
                .frame(width: 30, height: 30)
                .background(isPicked ? Theme.textPrimary : Theme.surfaceRaised, in: .circle)
                .overlay { if status.step == value, !isPicked { Circle().strokeBorder(Theme.ping, lineWidth: 2) } }
                .frame(width: 36, height: 44)
                .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(status.ping.name) \(value)" + (labels[value - 1].isEmpty ? "" : ", \(labels[value - 1])"))
        .accessibilityValue(isPicked ? "Picked" : status.step == value ? "Logged" : "")
    }
}
