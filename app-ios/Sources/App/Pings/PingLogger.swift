import Feedback
import SwiftUI

extension Theme {
    static let ping = Color(hex: 0x5AC8C8)
}

/// A day's pings as rows the owner picks from, under `header`, and a Log pill once something is picked. The Pings tab
/// pages between days (`pages`) and the Dashboard's "+" sheet shows today. The picks follow the owner from day to day,
/// and Log writes them onto the day shown.
struct PingLogger<Header: View, Empty: View>: View {
    @Binding var day: CalendarDay
    var pages = false
    /// Pushes a ping's history from its expanded row; nil where the list can't push, as in a sheet.
    var history: ((Ping) -> Void)?
    var onLogged: () -> Void = {}
    @ViewBuilder let header: Header
    @ViewBuilder let empty: Empty

    @Environment(LocalStore.self) private var store
    @State private var selection = PingSelection()
    @State private var expanded: Set<UUID> = []
    @State private var logged = 0

    var body: some View {
        Group {
            if pages {
                DayPager(day: $day) { list($0) }
            } else {
                list(day)
            }
        }
        .background(Theme.background)
        .pinnedActions {
            if !selection.isEmpty {
                PinnedActionButton("Log") {
                    store.logPings(selection.logs(at: PingLog.instant(on: day)))
                    selection = selection.afterLogging
                    expanded = Set(selection.notes.keys)
                    logged += 1
                    if selection.notes.isEmpty { onLogged() }
                }
            }
        }
        // One bar at a time: the Log pill takes the tab bar's place while something is picked.
        .toolbarVisibility(selection.isEmpty ? .automatic : .hidden, for: .tabBar)
        .sensoryFeedback(.success, trigger: logged)
        .animation(.snappy(duration: 0.25), value: expanded)
        .animation(.snappy(duration: 0.25), value: selection.isEmpty)
    }

    private func list(_ day: CalendarDay) -> some View {
        PingDayList(day: day, selection: $selection, expanded: $expanded, history: history, header: header, empty: empty)
    }
}

/// One day's rows, which observe only that day's logs.
private struct PingDayList<Header: View, Empty: View>: View {
    @Binding var selection: PingSelection
    @Binding var expanded: Set<UUID>
    let history: ((Ping) -> Void)?
    let header: Header
    let empty: Empty

    @Observe private var statuses: [PingStatus]

    init(
        day: CalendarDay, selection: Binding<PingSelection>, expanded: Binding<Set<UUID>>, history: ((Ping) -> Void)?,
        header: Header, empty: Empty
    ) {
        _statuses = Observe(PingStatus.on(day))
        _selection = selection
        _expanded = expanded
        self.history = history
        self.header = header
        self.empty = empty
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
    }

    private var rows: some View {
        VStack(spacing: 0) {
            ForEach(statuses) { status in
                let id = status.id
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
    }
}

/// One ping: its icon and name, and the least that says where its day stands beside the control that picks it. A tap
/// anywhere but the control opens it: a range's steps drop under the name with their labels, each on its own row when
/// they don't fit side by side, and every ping gets a note. A note on a range with no step picked stays in the row
/// after a Log, since there is no value to log it with yet.
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
                                ForEach(labels.indices, id: \.self) { step($0 + 1, labels, .column) }
                            }
                            VStack(alignment: .leading, spacing: 0) {
                                ForEach(labels.indices, id: \.self) { step($0 + 1, labels, .line) }
                            }
                        }
                    } else {
                        steps(labels, .stretched)
                    }
                } else {
                    ViewThatFits(in: .horizontal) {
                        HStack(spacing: 8) {
                            title
                            Spacer(minLength: 8)
                            steps(labels, .compact)
                        }
                        VStack(alignment: .leading, spacing: 0) {
                            title.frame(minHeight: 44)
                            steps(labels, .stretched)
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

    private func steps(_ labels: [String], _ layout: StepLayout) -> some View {
        HStack(spacing: 0) {
            ForEach(labels.indices, id: \.self) { step($0 + 1, labels, layout) }
        }
    }

    /// How a step draws, from least to most room: a fixed square beside the name, squares sharing the row's width, a
    /// square over its label, and a square before its label on a row of its own. The label is part of the button.
    private enum StepLayout {
        case compact, stretched, column, line
    }

    /// A rounded square, filled white while picked; ringed when it is the step the day's latest log holds.
    private func step(_ value: Int, _ labels: [String], _ layout: StepLayout) -> some View {
        let isPicked = picked == value
        let label = labels[value - 1]
        let square = Text("\(value)")
            .font(AppFont.number(14))
            .foregroundStyle(isPicked ? Theme.onPrimary : Theme.textPrimary)
            .frame(width: 34, height: 34)
            .background(isPicked ? Theme.textPrimary : Theme.surfaceRaised, in: .rect(cornerRadius: 8))
            .overlay { if status.step == value, !isPicked { RoundedRectangle(cornerRadius: 8).strokeBorder(Theme.ping, lineWidth: 2) } }
        return Button { pick(value) } label: {
            Group {
                switch layout {
                case .compact: square.frame(width: 40, height: 44)
                case .stretched: square.frame(maxWidth: .infinity, minHeight: 44)
                case .column:
                    VStack(spacing: 4) {
                        square
                        Text(label).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary).lineLimit(1).fixedSize()
                    }
                    .frame(maxWidth: .infinity, minHeight: 56)
                case .line:
                    HStack(spacing: 12) {
                        square
                        Text(label).font(AppFont.rowTitle).foregroundStyle(isPicked ? Theme.textPrimary : Theme.textSecondary)
                        Spacer(minLength: 0)
                    }
                    .frame(minHeight: 44)
                }
            }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(status.ping.name) \(value)" + (label.isEmpty ? "" : ", \(label)"))
        .accessibilityValue(isPicked ? "Picked" : status.step == value ? "Logged" : "")
    }
}
