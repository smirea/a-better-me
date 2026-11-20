import Feedback
import SwiftUI

/// Today's pings as rows the owner picks from, under `header`, and a Log pill once something is picked: the Dashboard's
/// "+" sheet. The Pings tab logs from its drawer instead, where a tap writes at once.
struct PingLogger<Header: View, Empty: View>: View {
    var onLogged: () -> Void = {}
    @ViewBuilder let header: Header
    @ViewBuilder let empty: Empty

    @Environment(LocalStore.self) private var store
    @State private var selection = PingSelection()
    @State private var expanded: Set<UUID> = []
    @State private var logged = 0

    var body: some View {
        PingDayList(day: .today, selection: $selection, expanded: $expanded, header: header, empty: empty)
            .background(Theme.background)
            .pinnedActions {
                if !selection.isEmpty {
                    PinnedActionButton("Log") {
                        store.logPings(selection.logs())
                        selection = selection.afterLogging
                        expanded = Set(selection.notes.keys)
                        logged += 1
                        if selection.notes.isEmpty { onLogged() }
                    }
                }
            }
            .sensoryFeedback(.success, trigger: logged)
            .animation(.snappy(duration: 0.25), value: expanded)
            .animation(.snappy(duration: 0.25), value: selection.isEmpty)
    }
}

/// One day's rows, which observe only that day's logs.
private struct PingDayList<Header: View, Empty: View>: View {
    @Binding var selection: PingSelection
    @Binding var expanded: Set<UUID>
    let header: Header
    let empty: Empty

    @Observe private var statuses: [PingStatus]

    init(
        day: CalendarDay, selection: Binding<PingSelection>, expanded: Binding<Set<UUID>>, header: Header, empty: Empty
    ) {
        _statuses = Observe(PingStatus.on(day))
        _selection = selection
        _expanded = expanded
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
    let pick: (Int) -> Void
    let expand: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            switch status.ping.kind {
            case .boolean:
                HStack(spacing: 8) {
                    PingTitle(ping: status.ping)
                    Spacer(minLength: 8)
                    if let summary = status.summary {
                        Text(summary).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary).lineLimit(1)
                    }
                    RowActionButton(
                        title: picked == nil ? "Log \(status.ping.name)" : "Don't log \(status.ping.name)",
                        systemImage: picked == nil ? "plus" : "checkmark", isOn: picked != nil
                    ) { pick(1) }
                }
            case .range:
                if isExpanded {
                    PingTitle(ping: status.ping).frame(minHeight: 44)
                    PingSteps(ping: status.ping, picked: picked, ringed: status.step, layout: .labelled, pick: pick)
                } else {
                    PingStepsBesideTitle(ping: status.ping, picked: picked, ringed: status.step, pick: pick)
                }
            }
            if isExpanded {
                TextField("Note", text: $note, axis: .vertical)
                    .font(AppFont.rowTitle)
                    .lineLimit(1...4)
                    .accessibilityLabel("\(status.ping.name) note")
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
}

/// A ping's icon and name.
struct PingTitle: View {
    let ping: Ping

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: ping.icon).font(.system(size: 16, weight: .semibold)).foregroundStyle(ping.tint).frame(width: 24)
            Text(ping.name).font(AppFont.rowTitle).lineLimit(1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
    }
}

/// A range ping's name with its steps beside it, or under it when they don't fit on the line.
struct PingStepsBesideTitle: View {
    let ping: Ping
    let picked: Int?
    var ringed: Int?
    var fill = Theme.surfaceRaised
    let pick: (Int) -> Void

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 8) {
                PingTitle(ping: ping)
                Spacer(minLength: 8)
                PingSteps(ping: ping, picked: picked, ringed: ringed, layout: .compact, fill: fill, pick: pick)
            }
            VStack(alignment: .leading, spacing: 0) {
                PingTitle(ping: ping).frame(minHeight: 44)
                PingSteps(ping: ping, picked: picked, ringed: ringed, layout: .stretched, fill: fill, pick: pick)
            }
        }
    }
}

/// A range ping's steps as buttons: rounded squares, filled white on the picked step and ringed on `ringed`, the step
/// the day's latest log holds. A step's label is part of its button.
struct PingSteps: View {
    /// From least to most room: fixed squares in a row, squares sharing the width, and each square with its label,
    /// over it when the labels fit side by side and on a row of its own when they don't.
    enum Layout {
        case compact, stretched, labelled
    }

    private enum Cell {
        case compact, stretched, column, line
    }

    let ping: Ping
    let picked: Int?
    var ringed: Int?
    let layout: Layout
    /// A step's square while it is not picked, for a row that sits on a raised surface itself.
    var fill = Theme.surfaceRaised
    let pick: (Int) -> Void

    var body: some View {
        let labels = ping.kind.steps
        switch layout {
        case .compact: row(labels, .compact, spacing: 0)
        case .stretched: row(labels, .stretched, spacing: 0)
        case .labelled:
            if labels.contains(where: { !$0.isEmpty }) {
                ViewThatFits(in: .horizontal) {
                    row(labels, .column, spacing: 10, alignment: .top)
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(labels.indices, id: \.self) { step($0 + 1, labels, .line) }
                    }
                }
            } else {
                row(labels, .stretched, spacing: 0)
            }
        }
    }

    private func row(_ labels: [String], _ cell: Cell, spacing: CGFloat, alignment: VerticalAlignment = .center) -> some View {
        HStack(alignment: alignment, spacing: spacing) {
            ForEach(labels.indices, id: \.self) { step($0 + 1, labels, cell) }
        }
    }

    private func step(_ value: Int, _ labels: [String], _ cell: Cell) -> some View {
        let isPicked = picked == value
        let label = labels[value - 1]
        // Ten steps share a narrow row, so a square gives up width before it overflows.
        let square = Text("\(value)")
            .font(AppFont.number(14))
            .foregroundStyle(isPicked ? Theme.onPrimary : Theme.textPrimary)
            .frame(minWidth: 20, maxWidth: 34, minHeight: 34, maxHeight: 34)
            .background(isPicked ? Theme.textPrimary : fill, in: .rect(cornerRadius: 8))
            .overlay { if ringed == value, !isPicked { RoundedRectangle(cornerRadius: 8).strokeBorder(ping.tint, lineWidth: 2) } }
        return Button { pick(value) } label: {
            Group {
                switch cell {
                case .compact: square.frame(width: 40, height: 44)
                case .stretched: square.padding(.horizontal, 2).frame(maxWidth: .infinity, minHeight: 44)
                case .column:
                    VStack(spacing: 4) {
                        square
                        Text(label).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary).lineLimit(1).fixedSize()
                    }
                    .frame(maxWidth: .infinity, minHeight: 56)
                case .line:
                    HStack(spacing: 12) {
                        square.frame(width: 34)
                        Text(label).font(AppFont.rowTitle).foregroundStyle(isPicked ? Theme.textPrimary : Theme.textSecondary)
                        Spacer(minLength: 0)
                    }
                    .frame(minHeight: 44)
                }
            }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(ping.name) \(value)" + (label.isEmpty ? "" : ", \(label)"))
        .accessibilityValue(isPicked ? "Picked" : ringed == value ? "Logged" : "")
    }
}
