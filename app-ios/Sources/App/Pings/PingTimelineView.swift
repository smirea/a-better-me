import Feedback
import SwiftUI

/// One day of the Pings tab: a bar down the left with a row per log at its time, and a line across for each thing the
/// rest of the app recorded that day. It reads top down, oldest first. A day too short to fill the page starts under the
/// header; a taller one opens on its latest row, beside the drawer.
struct PingTimelinePage: View {
    let day: CalendarDay
    /// The logs whose rows are open as editors.
    @Binding var editing: Set<UUID>
    /// The log the drawer just wrote, which the page scrolls to when it lands.
    let added: UUID?
    /// How much of the screen's bottom the drawer covers, so the last row scrolls clear of it.
    let covered: CGFloat
    /// How many pings exist, since a day with nothing on it says so differently when there is nothing to log.
    let pingCount: Int
    let history: (Ping) -> Void
    let create: () -> Void

    @Observe private var timeline: PingTimeline
    @State private var rows = ViewMemo<PingTimeline, [PingTimelineRow]>()
    /// Fits "12:51 PM" in the monospaced time font on one line.
    @ScaledMetric private var gutter: CGFloat = 68
    @State private var safeBottom: CGFloat = 0

    init(
        day: CalendarDay, editing: Binding<Set<UUID>>, added: UUID?, covered: CGFloat, pingCount: Int,
        history: @escaping (Ping) -> Void, create: @escaping () -> Void
    ) {
        self.day = day
        _editing = editing
        self.added = added
        self.covered = covered
        self.pingCount = pingCount
        self.history = history
        self.create = create
        _timeline = Observe(PingTimeline.on(day))
    }

    var body: some View {
        let rows = self.rows(timeline) { timeline.rows() }
        let ids = rows.map(\.id)
        // A log that joins a group adds no row, so the scroll to it watches the logs.
        let logs = rows.flatMap { $0.entries.map(\.log.key) }
        // The scroll view already keeps its content out of the bottom safe area, which the drawer reaches into.
        // The gap over the drawer leaves a just-logged row, scrolled to its bottom edge, some room below it.
        let bottomInset = covered == 0 ? 0 : max(0, covered + 32 - safeBottom)
        Group {
            // Outside the scroll view: sized to it from inside, the message sent the bottom-aligned scroll view into
            // an endless layout pass.
            if rows.isEmpty {
                ContentUnavailableView {
                    Label(pingCount == 0 ? "No Pings" : "Nothing Logged", systemImage: "hand.tap")
                } description: {
                    Text(pingCount == 0 ? "Track a mood, a glass of water, or anything else in a tap." : "Tap + to log a ping.")
                } actions: {
                    if pingCount == 0 { Button("New Ping", action: create).secondaryPill().fixedSize() }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(.bottom, bottomInset)
            } else {
                ScrollViewReader { proxy in
                    ScrollView { timeline(rows, ids: ids) }
                        // The owner asked (2026-11-19) for a short day to start at the top. A day taller than the
                        // page opens on its latest row and keeps it in view, also when the drawer opens and takes the
                        // page's lower part.
                        .defaultScrollAnchor(.top, for: .alignment)
                        .defaultScrollAnchor(.bottom, for: .initialOffset)
                        .defaultScrollAnchor(.bottom, for: .sizeChanges)
                        .contentMargins(.bottom, bottomInset, for: .scrollContent)
                        // The drawer reports its height a frame after it opens, outside the tab's own animation.
                        .animation(.snappy, value: bottomInset)
                        .scrollIndicators(.hidden)
                        .scrollDismissesKeyboard(.interactively)
                        .onChange(of: logs) { old, new in
                            guard let added = added.map(PingLog.key), new.contains(added), !old.contains(added),
                                  let row = rows.first(where: { $0.entries.contains { $0.log.key == added } }) else { return }
                            withAnimation(.snappy(duration: 0.3)) { proxy.scrollTo(row.id, anchor: .bottom) }
                        }
                }
            }
        }
        .onGeometryChange(for: CGFloat.self) { $0.safeAreaInsets.bottom } action: { safeBottom = $0 }
        .feedback(self)
    }

    private func timeline(_ rows: [PingTimelineRow], ids: [String]) -> some View {
        VStack(spacing: 0) {
            ForEach(rows) { row in
                switch row {
                case let .entry(entry):
                    entryRow(entry)
                case let .group(group):
                    // Open, a group is its logs' own rows, each an editor; it closes back into one when they all do.
                    if group.entries.contains(where: { editing.contains($0.id) }) {
                        ForEach(group.entries) { entryRow($0) }
                    } else {
                        PingGroupRow(group: group, gutter: gutter) { editing.formUnion(group.entries.map(\.id)) }
                            .transition(.opacity)
                    }
                case let .marker(marker):
                    TimelineMarkerRow(marker: marker, gutter: gutter)
                }
            }
        }
        .background(alignment: .leading) {
            Rectangle().fill(Theme.separator).frame(width: 1).padding(.leading, gutter + PingTimelineMetrics.node / 2)
                .accessibilityHidden(true)
        }
        .padding(.horizontal, Theme.margin)
        .padding(.vertical, 8)
        .animation(.snappy(duration: 0.3), value: ids)
        .animation(.snappy(duration: 0.25), value: editing)
    }

    private func entryRow(_ entry: PingEntry) -> some View {
        PingEntryRow(
            entry: entry, isEditing: editing.contains(entry.id), gutter: gutter,
            toggle: { editing.formSymmetricDifference([entry.id]) }, history: { history(entry.ping) }
        )
        .transition(.scale(scale: 0.85, anchor: .leading).combined(with: .opacity))
    }
}

enum PingTimelineMetrics {
    /// The column the bar runs down the middle of, with a row's dot or tick on it.
    static let node: CGFloat = 24
}

/// A logged ping on the timeline: its time, a dot on the bar, and the ping with what was logged. A tap opens it as an
/// editor: the steps change the value, the note is typed in place, and the time opens a picker.
private struct PingEntryRow: View {
    let entry: PingEntry
    let isEditing: Bool
    let gutter: CGFloat
    let toggle: () -> Void
    let history: () -> Void

    @Environment(LocalStore.self) private var store

    var body: some View {
        let log = entry.log
        HStack(alignment: .top, spacing: 0) {
            PingTimeLabel(log: log, isEditing: isEditing).frame(width: gutter, height: 44, alignment: .trailing)
            Circle().fill(entry.ping.tint).frame(width: 9, height: 9)
                .padding(3).background(Theme.background, in: .circle)
                .frame(width: PingTimelineMetrics.node, height: 44)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    PingTitle(ping: entry.ping)
                    Spacer(minLength: 8)
                    if !isEditing { PingStepSquare(ping: entry.ping, value: log.value) }
                }
                .frame(minHeight: 44)
                if isEditing {
                    if entry.ping.kind != .boolean {
                        PingSteps(ping: entry.ping, picked: log.value, layout: .labelled) { value in
                            store.modify(PingLog.self, id: log.id) { $0.value = value }
                        }
                    }
                    HStack(spacing: 12) {
                        PingNoteField(log: log, name: entry.ping.name)
                        Button("History", action: history).chipButton().accessibilityLabel("\(entry.ping.name) history")
                    }
                    .padding(.bottom, 8)
                } else if !log.note.isEmpty {
                    Text(log.note).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary).lineLimit(2).padding(.bottom, 8)
                }
            }
            .padding(.leading, 4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(.rect)
        .onTapGesture(perform: toggle)
        .rowSwipeActions(trailing: [.destructive("Delete") { store.delete(PingLog.self, id: log.id) }], fullSwipe: true)
        .accessibilityElement(children: .contain)
        .accessibilityAction(named: isEditing ? "Collapse" : "Edit", toggle)
        .feedback(self)
    }

}

/// A range's step as the square the editor fills, with its label before it. A boolean has none.
private struct PingStepSquare: View {
    let ping: Ping
    let value: Int

    var body: some View {
        let steps = ping.kind.steps
        if steps.indices.contains(value - 1) {
            let label = steps[value - 1]
            if !label.isEmpty {
                Text(label).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary).lineLimit(1)
            }
            Text("\(value)")
                .font(AppFont.number(14))
                .foregroundStyle(Theme.onPrimary)
                .frame(width: 34, height: 34)
                .background(Theme.textPrimary, in: .rect(cornerRadius: 8))
        }
    }
}

/// Logs drawn as one row at the first one's time (`PingGroup`): each ping once, wrapping, with how many times it was
/// logged in its color. A tap opens every log in it as its own row.
private struct PingGroupRow: View {
    let group: PingGroup
    let gutter: CGFloat
    let open: () -> Void

    var body: some View {
        let first = group.entries[0]
        let time = first.log.loggedAt.formatted(date: .omitted, time: .shortened)
        HStack(alignment: .top, spacing: 0) {
            Text(time).font(AppFont.time).lineLimit(1).minimumScaleFactor(0.8).foregroundStyle(Theme.textSecondary)
                .frame(width: gutter, height: 44, alignment: .trailing)
            Circle().fill(first.ping.tint).frame(width: 9, height: 9)
                .padding(3).background(Theme.background, in: .circle)
                .frame(width: PingTimelineMetrics.node, height: 44)
                .accessibilityHidden(true)
            HStack(spacing: 8) {
                FlowLayout(spacing: 12) {
                    ForEach(group.items, id: \.ping.id) { item in
                        HStack(spacing: 6) {
                            PingTitle(ping: item.ping)
                            if item.count > 1 {
                                Text("×\(item.count)").font(AppFont.rowTitle).foregroundStyle(item.ping.tint)
                            }
                        }
                        .frame(height: 32)
                    }
                }
                .padding(.vertical, 6)
                Spacer(minLength: 8)
                if group.items.count == 1 { PingStepSquare(ping: first.ping, value: first.log.value).frame(height: 44) }
            }
            .padding(.leading, 4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(.rect)
        .onTapGesture(perform: open)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(([time] + group.items.map { $0.count > 1 ? "\($0.ping.name) \($0.count) times" : $0.ping.name }).joined(separator: ", "))
        .accessibilityAddTraits(.isButton)
        .accessibilityAction(named: "Edit", open)
        .feedback(self)
    }
}

/// A row's time in the gutter. While the row is open it is a button for a wheel that moves the log to another time of
/// its day; the wheel writes when it closes, so the row moves once.
private struct PingTimeLabel: View {
    let log: PingLog
    let isEditing: Bool

    @Environment(LocalStore.self) private var store
    @State private var picking = false
    @State private var time = Date.now

    var body: some View {
        let text = log.loggedAt.formatted(date: .omitted, time: .shortened)
        if isEditing {
            Button(text) {
                time = log.loggedAt
                picking = true
            }
            .buttonStyle(.plain)
            .font(AppFont.time).lineLimit(1).minimumScaleFactor(0.8)
            .underline()
            .foregroundStyle(Theme.textPrimary)
            .frame(maxHeight: .infinity)
            .contentShape(.rect)
            .accessibilityLabel("Time, \(text)")
            .popover(isPresented: $picking) {
                DatePicker("Time", selection: $time, displayedComponents: .hourAndMinute)
                    .datePickerStyle(.wheel)
                    .labelsHidden()
                    .padding(.horizontal, 8)
                    .presentationCompactAdaptation(.popover)
                    .onDisappear {
                        guard time != log.loggedAt else { return }
                        let time = time
                        store.modify(PingLog.self, id: log.id) { $0.loggedAt = time }
                    }
            }
        } else {
            Text(text).font(AppFont.time).lineLimit(1).minimumScaleFactor(0.8).foregroundStyle(Theme.textSecondary)
        }
    }
}

/// A log's note, typed in its row. It writes when the field loses focus or the row closes, not on every key.
private struct PingNoteField: View {
    let log: PingLog
    let name: String

    @Environment(LocalStore.self) private var store
    @State private var note = ""
    @FocusState private var focused: Bool

    var body: some View {
        TextField("Note", text: $note, axis: .vertical)
            .font(AppFont.rowTitle)
            .lineLimit(1...4)
            .focused($focused)
            .accessibilityLabel("\(name) note")
            .onAppear { note = log.note }
            .onChange(of: log.note) { _, stored in
                if !focused { note = stored }
            }
            .onChange(of: focused) { _, focused in
                if !focused { save() }
            }
            .onDisappear(perform: save)
    }

    private func save() {
        let note = note.trimmingCharacters(in: .whitespacesAndNewlines)
        guard note != log.note else { return }
        store.modify(PingLog.self, id: log.id) { $0.note = note }
    }
}

/// Something the rest of the app recorded, as a line across the timeline with its title on it.
private struct TimelineMarkerRow: View {
    let marker: TimelineMarker
    let gutter: CGFloat

    var body: some View {
        HStack(spacing: 0) {
            Text(marker.at.formatted(date: .omitted, time: .shortened))
                .font(AppFont.time).lineLimit(1).minimumScaleFactor(0.8)
                .foregroundStyle(Theme.textTertiary)
                .frame(width: gutter, alignment: .trailing)
            line.padding(.leading, PingTimelineMetrics.node / 2).frame(width: PingTimelineMetrics.node + 4)
            HStack(spacing: 6) {
                Image(systemName: marker.kind.systemImage).font(.system(size: 11, weight: .semibold)).accessibilityHidden(true)
                Text(marker.title).font(AppFont.chip).lineLimit(1)
            }
            .foregroundStyle(Theme.textSecondary)
            .padding(.horizontal, 8)
            .layoutPriority(1)
            line.frame(minWidth: 12)
            // On the right, where a ping row puts its value.
            if !marker.detail.isEmpty {
                Text(marker.detail).font(AppFont.rowDetail).foregroundStyle(Theme.textTertiary).lineLimit(1)
                    .padding(.leading, 8)
                    .layoutPriority(1)
            }
        }
        .frame(height: 32)
        .accessibilityElement(children: .combine)
        .feedback(self)
    }

    private var line: some View {
        Rectangle().fill(Theme.separator).frame(height: 1).accessibilityHidden(true)
    }
}

extension TimelineMarker.Kind {
    var systemImage: String {
        switch self {
        case .asleep: "moon.fill"
        case .wake: "sun.max.fill"
        case .meal: "fork.knife"
        case .workout: "dumbbell.fill"
        case .weighIn: "scalemass.fill"
        case let .activity(type):
            switch type {
            case "walking", "hiking": "figure.walk"
            case "running": "figure.run"
            case "cycling": "figure.outdoor.cycle"
            case "swimming": "figure.pool.swim"
            case "traditional_strength_training", "functional_strength_training": "dumbbell.fill"
            case "yoga": "figure.yoga"
            default: "figure.mixed.cardio"
            }
        }
    }
}
