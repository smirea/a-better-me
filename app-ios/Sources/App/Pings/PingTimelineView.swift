import Feedback
import GRDB
import SwiftUI
import UIKit

/// One day of the Pings tab: a bar down the left with a row per log at its time, and a line across for each thing the
/// rest of the app recorded that day. It reads top down, oldest first. A day too short to fill the page starts under the
/// header; a taller one opens on its latest row, beside the drawer.
struct PingTimelinePage: View {
    let day: CalendarDay
    /// The logs whose rows are open as editors.
    @Binding var editing: Set<UUID>
    /// The note the drawer's Text started, drawn on its day until it is written or dropped.
    @Binding var newNote: TimelineNote?
    /// The log or note the drawer just wrote, which the page scrolls to when it lands.
    let added: UUID?
    /// How much of the screen's bottom the drawer covers, so the last row scrolls clear of it.
    let covered: CGFloat
    /// How many pings exist, since a day with nothing on it says so differently when there is nothing to log.
    let pingCount: Int
    let history: (Ping) -> Void
    let create: () -> Void

    @Observe private var timeline: PingTimeline
    @State private var rows = ViewMemo<PingTimeline, [PingTimelineRow]>()
    @State private var safeBottom: CGFloat = 0
    @FocusState private var typing: UUID?

    init(
        day: CalendarDay, editing: Binding<Set<UUID>>, newNote: Binding<TimelineNote?>, added: UUID?, covered: CGFloat, pingCount: Int,
        history: @escaping (Ping) -> Void, create: @escaping () -> Void
    ) {
        self.day = day
        _editing = editing
        _newNote = newNote
        self.added = added
        self.covered = covered
        self.pingCount = pingCount
        self.history = history
        self.create = create
        _timeline = Observe(PingTimeline.on(day))
    }

    var body: some View {
        let timeline = withNewNote
        let rows = self.rows(timeline) { timeline.rows() }
        // A log that joins a group adds no row, so the scroll to it watches the logs, and the notes.
        let logs = rows.flatMap { row in
            if case .note = row { [row.id] } else { row.entries.map(\.log.key) }
        }
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
                    ScrollView {
                        VStack(spacing: 0) {
                            PingTimelineList(rows: rows, day: day, editing: $editing, newNote: $newNote, typing: $typing, history: history)
                                .padding(.horizontal, Theme.margin)
                                .padding(.top, 8)
                            // What a scroll to the latest row aims at, so the row keeps some room under it.
                            Color.clear.frame(height: 16).id(Self.end)
                        }
                    }
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
                        // A tap on the page around the rows ends editing, as one on another row does.
                        .contentShape(.rect)
                        .onTapGesture { PingTimelineList.endEditing(typing: $typing, editing: $editing) }
                        .onChange(of: logs) { old, new in
                            guard let added = added.map(PingLog.key), new.contains(added), !old.contains(added) else { return }
                            reveal(added, drawnAs: nil, in: rows, proxy)
                        }
                        // The scroll view leaves the row being typed under the rising keyboard.
                        .onChange(of: safeBottom) { old, new in
                            guard new > old, let typing else { return }
                            // An open group draws each log as its own row.
                            reveal(PingLog.key(typing), drawnAs: PingLog.key(typing), in: rows, proxy)
                        }
                }
            }
        }
        .onGeometryChange(for: CGFloat.self) { $0.safeAreaInsets.bottom } action: { safeBottom = $0 }
        // Written, the new note is the stored one from here on.
        .onChange(of: self.timeline.notes) { _, notes in
            if let newNote, notes.contains(where: { $0.id == newNote.id }) { self.newNote = nil }
        }
        .feedback(self)
    }

    private static let end = "timeline-end"

    /// Scrolls the row that holds the log or note with `key` up to the bottom of the page, with room under it. A closed
    /// group is drawn as its row; `drawnAs` names the drawn row when that is the log's own.
    private func reveal(_ key: String, drawnAs: String?, in rows: [PingTimelineRow], _ proxy: ScrollViewProxy) {
        guard let row = rows.first(where: { $0.id == key || $0.entries.contains { $0.log.key == key } }) else { return }
        let target = row.id == rows.last?.id ? Self.end : drawnAs ?? row.id
        withAnimation(.snappy(duration: 0.3)) { proxy.scrollTo(target, anchor: .bottom) }
    }

    /// The day as stored, with the note Text started when it is on this day and not written yet.
    private var withNewNote: PingTimeline {
        guard let newNote, CalendarDay(newNote.notedAt) == day, !timeline.notes.contains(where: { $0.id == newNote.id }) else {
            return timeline
        }
        var timeline = timeline
        timeline.notes.append(newNote)
        return timeline
    }
}

/// Embeddable Pings timeline for screens that already live inside their own `ScrollView` (such as Strain & Stress).
/// Observes the day's timeline off the main thread so pushing the screen or changing days never blocks main.
struct EmbeddedPingTimeline: View {
    let day: CalendarDay
    let history: (Ping) -> Void

    @Environment(LocalStore.self) private var store
    @State private var timeline = PingTimeline()
    @State private var rows = ViewMemo<PingTimeline, [PingTimelineRow]>()
    @State private var editing: Set<UUID> = []
    @FocusState private var typing: UUID?

    var body: some View {
        let rows = self.rows(timeline) { timeline.rows() }
        VStack(spacing: 0) {
            if !rows.isEmpty {
                PingTimelineList(rows: rows, day: day, editing: $editing, newNote: .constant(nil), typing: $typing, history: history)
                    .feedback(self)
            }
        }
        .task(id: day) {
            editing = []
            let query = PingTimeline.on(day)
            let observation = ValueObservation.trackingConstantRegion(query.fetch).removeDuplicates()
            do {
                for try await next in observation.values(in: store.database.pool) {
                    guard !Task.isCancelled else { break }
                    timeline = next
                }
            } catch {}
        }
    }
}

/// The Pings timeline's vertical bar and rows, shared between `PingTimelinePage` and `EmbeddedPingTimeline`. A long
/// press lifts a closed ping row, a drag slides it between the others, and the drop moves its logs to just after the row
/// above it (`PingTimeline.dropTime`). While a note is typed, a tap on another row only ends the typing.
struct PingTimelineList: View {
    let rows: [PingTimelineRow]
    let day: CalendarDay
    @Binding var editing: Set<UUID>
    @Binding var newNote: TimelineNote?
    /// The log or note whose text has the keyboard.
    var typing: FocusState<UUID?>.Binding
    let history: (Ping) -> Void

    @Environment(LocalStore.self) private var store
    /// Fits "12:51 PM" in the monospaced time font on one line.
    @ScaledMetric private var gutter: CGFloat = 68
    @State private var drag: TimelineDrag?
    /// Read only when a drag starts, so a row resizing, as an editor opens, never redraws the list.
    @State private var heights = RowHeights()

    var body: some View {
        let ids = rows.map(\.id)
        let shown = shown
        VStack(spacing: 0) {
            ForEach(drag?.preview(shown) ?? shown) { row in
                rowView(row)
                    .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { heights.values[row.id] = $0 }
                    .modifier(TimelineLift(offset: drag?.id == row.id ? drag?.offset : nil))
                    .gesture(LongPressMove(
                        isEnabled: drag == nil || drag?.id == row.id ? isMovable(row) : false,
                        began: { lift(row, in: shown) }, changed: { move(by: $0, in: shown) }, ended: { drop($0, in: shown) }
                    ))
                    .accessibilityActions {
                        if isMovable(row), let index = shown.firstIndex(of: row) {
                            if index > 0 { Button("Move Up") { place(row, at: index - 1, in: shown) } }
                            if index < shown.count - 1 { Button("Move Down") { place(row, at: index + 1, in: shown) } }
                        }
                    }
            }
        }
        .background(alignment: .leading) {
            Rectangle().fill(Theme.separator).frame(width: 1).padding(.leading, gutter + PingTimelineMetrics.node / 2)
                .accessibilityHidden(true)
        }
        .animation(.snappy(duration: 0.3), value: ids)
        .animation(.snappy(duration: 0.25), value: editing)
        .sensoryFeedback(.impact(weight: .medium), trigger: drag?.id) { _, id in id != nil }
        .sensoryFeedback(.selection, trigger: drag?.target)
        // The dropped row waits in its new place until the write comes back and puts it there for good.
        .onChange(of: rows) {
            guard let drag else { return }
            if drag.landed || !shown.contains(where: { $0.id == drag.id }) { self.drag = nil }
        }
    }

    /// The rows as drawn: a group is its logs' own rows while any of them is open, and closes back into one when they
    /// all do.
    private var shown: [PingTimelineRow] {
        rows.flatMap { row -> [PingTimelineRow] in
            if case let .group(group) = row, group.entries.contains(where: { editing.contains($0.id) }) {
                return group.entries.map(PingTimelineRow.entry)
            }
            return [row]
        }
    }

    /// Takes the keyboard away and closes every open row: the tap around the rows, or on another row while one is typed.
    static func endEditing(typing: FocusState<UUID?>.Binding, editing: Binding<Set<UUID>>) {
        typing.wrappedValue = nil
        editing.wrappedValue = []
    }

    private func tapped(_ action: () -> Void) {
        if typing.wrappedValue == nil { action() } else { Self.endEditing(typing: typing, editing: $editing) }
    }

    @ViewBuilder private func rowView(_ row: PingTimelineRow) -> some View {
        let time = drag?.id == row.id ? drag?.time : nil
        switch row {
        case let .entry(entry):
            PingEntryRow(
                entry: entry, isEditing: editing.contains(entry.id), gutter: gutter, movingTo: time, typing: typing,
                toggle: { editing.formSymmetricDifference([entry.id]) }, tap: { tapped { editing.formSymmetricDifference([entry.id]) } },
                history: { history(entry.ping) }
            )
            .transition(.scale(scale: 0.85, anchor: .leading).combined(with: .opacity))
        case let .group(group):
            PingGroupRow(group: group, gutter: gutter, movingTo: time, open: { editing.formUnion(group.entries.map(\.id)) }) {
                tapped { editing.formUnion(group.entries.map(\.id)) }
            }
            .transition(.opacity)
        case let .marker(marker):
            TimelineMarkerRow(marker: marker, gutter: gutter)
        case let .note(note):
            let isNew = newNote?.id == note.id
            TimelineNoteRow(
                note: note, isNew: isNew, isEditing: isNew || editing.contains(note.id), gutter: gutter, movingTo: time, typing: typing,
                toggle: { editing.formSymmetricDifference([note.id]) }, tap: { tapped { editing.formSymmetricDifference([note.id]) } },
                move: { time in
                    if newNote?.id == note.id { newNote?.notedAt = time } else { store.modify(TimelineNote.self, id: note.id) { $0.notedAt = time } }
                },
                drop: {
                    if newNote?.id == note.id { newNote = nil } else { store.delete(TimelineNote.self, id: note.id) }
                },
                discard: { if newNote?.id == note.id { newNote = nil } }
            )
            .transition(.scale(scale: 0.85, anchor: .leading).combined(with: .opacity))
        }
    }

    /// An open editor holds a text field, so only a closed ping or note row lifts.
    private func isMovable(_ row: PingTimelineRow) -> Bool {
        switch row {
        case let .entry(entry): !editing.contains(entry.id)
        case let .note(note): !editing.contains(note.id) && newNote?.id != note.id
        case .group: true
        case .marker: false
        }
    }

    private func lift(_ row: PingTimelineRow, in shown: [PingTimelineRow]) {
        guard let index = shown.firstIndex(of: row) else { return }
        drag = TimelineDrag(id: row.id, from: index, heights: shown.map { heights.values[$0.id] ?? 44 })
    }

    private func move(by translation: CGFloat, in shown: [PingTimelineRow]) {
        guard var next = drag, !next.landed else { return }
        next.translation = translation
        let target = next.target(for: translation)
        if target != next.target {
            next.target = target
            next.time = target == next.from ? nil : time(of: next.id, at: target, in: shown)
            withAnimation(.snappy(duration: 0.25)) { drag = next }
        } else {
            drag = next
        }
    }

    private func drop(_ committed: Bool, in shown: [PingTimelineRow]) {
        guard let drag, !drag.landed, let row = shown.first(where: { $0.id == drag.id }) else { return }
        guard committed, drag.target != drag.from else {
            withAnimation(.snappy(duration: 0.25)) { self.drag = nil }
            return
        }
        withAnimation(.snappy(duration: 0.25)) { self.drag?.landed = true }
        if !write(row, at: drag.target, in: shown) { withAnimation(.snappy(duration: 0.25)) { self.drag = nil } }
    }

    /// The accessibility Move Up and Move Down, without the drag.
    private func place(_ row: PingTimelineRow, at index: Int, in shown: [PingTimelineRow]) {
        _ = write(row, at: index, in: shown)
    }

    private func time(of id: String, at index: Int, in shown: [PingTimelineRow]) -> Date? {
        PingTimeline.dropTime(at: index, in: shown.filter { $0.id != id }, on: day)
    }

    /// False when nothing changed.
    private func write(_ row: PingTimelineRow, at index: Int, in shown: [PingTimelineRow]) -> Bool {
        if case let .note(note) = row {
            guard let time = time(of: row.id, at: index, in: shown), time != note.notedAt else { return false }
            store.modify(TimelineNote.self, id: note.id) { $0.notedAt = time }
            return true
        }
        let moved = zip(row.entries, PingTimeline.drop(row, at: index, in: shown.filter { $0.id != row.id }, on: day))
            .filter { $0.log.loggedAt != $1.loggedAt }
            .map(\.1)
        for log in moved {
            let time = log.loggedAt
            store.modify(PingLog.self, id: log.id) { $0.loggedAt = time }
        }
        return !moved.isEmpty
    }
}

/// A row lifted off the timeline. While it moves, the list draws it at `target` among the others, which slide aside, and
/// offsets it so it stays under the finger.
private struct TimelineDrag {
    let id: String
    /// Where it was in the drawn rows when lifted.
    let from: Int
    let height: CGFloat
    /// The other rows' tops and middles, with the lifted row taken out and pushing each down by half its height: the
    /// lifted row passes a row when its middle passes that one's. Measured once, when it lifts.
    private let tops: [CGFloat]
    private let middles: [CGFloat]
    var translation: CGFloat = 0
    var target: Int
    /// Where the drop would put it, shown in its time column while it moves.
    var time: Date?
    /// Dropped and written; it stays drawn at `target` until the rows come back from the database.
    var landed = false

    /// `heights` holds every drawn row's height, in order.
    init(id: String, from: Int, heights: [CGFloat]) {
        self.id = id
        self.from = from
        height = heights[from]
        target = from
        var others = heights
        others.remove(at: from)
        var tops: [CGFloat] = [0]
        var middles: [CGFloat] = []
        for other in others {
            middles.append(tops[tops.count - 1] + (other + heights[from]) / 2)
            tops.append(tops[tops.count - 1] + other)
        }
        self.tops = tops
        self.middles = middles
    }

    /// The slot whose rows above all have their middles above the lifted row's middle.
    func target(for translation: CGFloat) -> Int {
        let middle = tops[from] + height / 2 + translation
        return middles.firstIndex { $0 >= middle } ?? middles.count
    }

    var offset: CGFloat { landed ? 0 : tops[from] + translation - tops[target] }

    func preview(_ rows: [PingTimelineRow]) -> [PingTimelineRow] {
        guard let index = rows.firstIndex(where: { $0.id == id }) else { return rows }
        var rows = rows
        let row = rows.remove(at: index)
        rows.insert(row, at: min(target, rows.count))
        return rows
    }
}

private final class RowHeights {
    var values: [String: CGFloat] = [:]
}

/// The lifted row's look, as the Ramble tab lifts a row into focus.
private struct TimelineLift: ViewModifier {
    let offset: CGFloat?

    func body(content: Content) -> some View {
        let lifted = offset != nil
        content
            .background {
                if lifted {
                    RoundedRectangle(cornerRadius: Theme.cornerRadius).fill(Theme.surface)
                        .shadow(color: .black.opacity(0.5), radius: 18, y: 8)
                        .padding(.horizontal, -8)
                }
            }
            .scaleEffect(lifted ? 1.02 : 1)
            .offset(y: offset ?? 0)
            .zIndex(lifted ? 1 : 0)
    }
}

/// A long press that then follows the finger up and down, reporting how far it moved. It is UIKit's, so it waits out
/// the press before taking the touch: a drag that starts sooner scrolls, and a sideways one swipes the row.
private struct LongPressMove: UIGestureRecognizerRepresentable {
    let isEnabled: Bool
    let began: () -> Void
    let changed: (CGFloat) -> Void
    /// Whether the finger lifted, rather than the system cancelling the press.
    let ended: (Bool) -> Void

    func makeCoordinator(converter: CoordinateSpaceConverter) -> Coordinator { Coordinator() }

    func makeUIGestureRecognizer(context: Context) -> UILongPressGestureRecognizer {
        let press = UILongPressGestureRecognizer()
        press.minimumPressDuration = 0.35
        return press
    }

    func updateUIGestureRecognizer(_ recognizer: UILongPressGestureRecognizer, context: Context) {
        recognizer.isEnabled = isEnabled
    }

    func handleUIGestureRecognizerAction(_ recognizer: UILongPressGestureRecognizer, context: Context) {
        let y = recognizer.location(in: nil).y
        switch recognizer.state {
        case .began:
            context.coordinator.start = y
            began()
        case .changed: changed(y - context.coordinator.start)
        case .ended: ended(true)
        case .cancelled, .failed: ended(false)
        default: break
        }
    }

    final class Coordinator {
        var start: CGFloat = 0
    }
}

enum PingTimelineMetrics {
    /// The column the bar runs down the middle of, with a row's dot or tick on it.
    static let node: CGFloat = 24
}

/// A logged ping on the timeline: its time, a dot on the bar, and the ping with what was logged. A tap opens it as an
/// editor: the steps change the value and the note is typed in place. A tap on the time, open or closed, opens its picker.
private struct PingEntryRow: View {
    let entry: PingEntry
    let isEditing: Bool
    let gutter: CGFloat
    /// Where a drag would drop it, shown in place of its time while it moves.
    let movingTo: Date?
    let typing: FocusState<UUID?>.Binding
    let toggle: () -> Void
    /// A tap on the row, which only ends the typing while a note is typed.
    let tap: () -> Void
    let history: () -> Void

    @Environment(LocalStore.self) private var store

    var body: some View {
        let log = entry.log
        HStack(alignment: .top, spacing: 0) {
            TimelineTimeLabel(at: log.loggedAt, isEditing: isEditing, movingTo: movingTo) { time in
                store.modify(PingLog.self, id: log.id) { $0.loggedAt = time }
            }
            .frame(width: gutter, height: 44, alignment: .trailing)
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
                        PingNoteField(log: log, name: entry.ping.name, typing: typing)
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
        .onTapGesture(perform: tap)
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
    let movingTo: Date?
    let open: () -> Void
    let tap: () -> Void

    var body: some View {
        let first = group.entries[0]
        let time = (movingTo ?? first.log.loggedAt).formatted(date: .omitted, time: .shortened)
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
        .onTapGesture(perform: tap)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(([time] + group.items.map { $0.count > 1 ? "\($0.ping.name) \($0.count) times" : $0.ping.name }).joined(separator: ", "))
        .accessibilityAddTraits(.isButton)
        .accessibilityAction(named: "Edit", open)
        .feedback(self)
    }
}

/// A row's time in the gutter, a button for a wheel that moves the log to another time of its day, whether the row is
/// open or not: the owner asked (2026-11-24) for a tap on the time to go straight to the picker. Underlined while the row
/// is open, where the editor's controls show. The wheel writes when it closes, so the row moves once.
private struct TimelineTimeLabel: View {
    let at: Date
    let isEditing: Bool
    let movingTo: Date?
    let move: (Date) -> Void

    @State private var picking = false
    @State private var time = Date.now

    var body: some View {
        let text = (movingTo ?? at).formatted(date: .omitted, time: .shortened)
        Button(text) {
            time = at
            picking = true
        }
        .buttonStyle(.plain)
        .font(AppFont.time).lineLimit(1).minimumScaleFactor(0.8)
        .underline(isEditing)
        .foregroundStyle(isEditing || movingTo != nil ? Theme.textPrimary : Theme.textSecondary)
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
                    guard time != at else { return }
                    move(time)
                }
        }
    }
}

/// A log's note, typed in its row. It writes when the field loses focus or the row closes, not on every key, and keeps
/// what is typed until then as a draft, so a killed app gives it back when the row opens again.
private struct PingNoteField: View {
    let log: PingLog
    let name: String
    let typing: FocusState<UUID?>.Binding

    @Environment(LocalStore.self) private var store
    @State private var note: String

    init(log: PingLog, name: String, typing: FocusState<UUID?>.Binding) {
        self.log = log
        self.name = name
        self.typing = typing
        _note = State(initialValue: log.note)
    }

    var body: some View {
        let focused = typing.wrappedValue == log.id
        TextField("Note", text: $note, axis: .vertical)
            .font(AppFont.rowTitle)
            .lineLimit(1...4)
            .focused(typing, equals: log.id)
            .accessibilityLabel("\(name) note")
            .onChange(of: log.note) { _, stored in
                if !focused { note = stored }
            }
            .onChange(of: focused) { _, focused in
                if !focused { save() }
            }
            .onDisappear(perform: save)
            .persistDraft($note, key: draftKey)
    }

    private var draftKey: String { "pings.log-note.\(log.key)" }

    private func save() {
        DraftStore.clear(draftKey)
        let note = note.trimmingCharacters(in: .whitespacesAndNewlines)
        guard note != log.note else { return }
        store.modify(PingLog.self, id: log.id) { $0.note = note }
    }
}

/// A note on the timeline, at its time with a hollow ring on the bar, since it belongs to no ping. A tap opens it for
/// editing in place; emptied, it is deleted when it closes. It moves like a ping row: a tap on its time, a long press. A
/// new one, from the drawer's Text, opens with the cursor in it and is stored only once it has text.
private struct TimelineNoteRow: View {
    let note: TimelineNote
    let isNew: Bool
    let isEditing: Bool
    let gutter: CGFloat
    let movingTo: Date?
    let typing: FocusState<UUID?>.Binding
    let toggle: () -> Void
    let tap: () -> Void
    let move: (Date) -> Void
    let drop: () -> Void
    let discard: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            TimelineTimeLabel(at: note.notedAt, isEditing: isEditing, movingTo: movingTo, move: move)
                .frame(width: gutter, height: 44, alignment: .trailing)
            Circle().strokeBorder(Theme.textSecondary, lineWidth: 1.5).frame(width: 9, height: 9)
                .padding(3).background(Theme.background, in: .circle)
                .frame(width: PingTimelineMetrics.node, height: 44)
                .accessibilityHidden(true)
            Group {
                if isEditing {
                    TimelineNoteField(note: note, isNew: isNew, typing: typing, discard: discard)
                } else {
                    Text(note.text).font(AppFont.rowTitle).foregroundStyle(Theme.textPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(.vertical, 11)
            .frame(minHeight: 44)
            .padding(.leading, 4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(.rect)
        .onTapGesture(perform: tap)
        .rowSwipeActions(trailing: [.destructive("Delete", action: drop)], fullSwipe: true)
        .accessibilityElement(children: .contain)
        .accessibilityAction(named: isEditing ? "Collapse" : "Edit", toggle)
        .feedback(self)
    }
}

/// An open note's text, focused as it opens. It writes when the field loses focus or the row closes, not on every key,
/// and keeps what is typed until then as a draft, so a killed app gives it back when the note opens again. A new note
/// left empty is dropped without ever being stored.
private struct TimelineNoteField: View {
    let note: TimelineNote
    let isNew: Bool
    let typing: FocusState<UUID?>.Binding
    let discard: () -> Void

    @Environment(LocalStore.self) private var store
    @State private var text: String
    /// Set once a new note is stored, since its row stays open until the stored note comes back.
    @State private var written = false

    init(note: TimelineNote, isNew: Bool, typing: FocusState<UUID?>.Binding, discard: @escaping () -> Void) {
        self.note = note
        self.isNew = isNew
        self.typing = typing
        self.discard = discard
        _text = State(initialValue: note.text)
    }

    var body: some View {
        let focused = typing.wrappedValue == note.id
        TextField("Note", text: $text, axis: .vertical)
            .font(AppFont.rowTitle)
            .lineLimit(1...8)
            .focused(typing, equals: note.id)
            .accessibilityLabel("Note")
            .onAppear { typing.wrappedValue = note.id }
            .onChange(of: note.text) { _, stored in
                if !focused { text = stored }
            }
            .onChange(of: focused) { _, focused in
                if !focused { save() }
            }
            .onDisappear(perform: save)
            .persistDraft($text, key: draftKey)
    }

    private var draftKey: String { "pings.note.\(note.key)" }

    private func save() {
        DraftStore.clear(draftKey)
        let text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if isNew {
            guard !written else { return }
            if text.isEmpty { return discard() }
            written = true
            store.insert(TimelineNote(id: note.id, text: text, at: note.notedAt))
            return
        }
        guard text != note.text else { return }
        if text.isEmpty {
            store.delete(TimelineNote.self, id: note.id)
        } else {
            store.modify(TimelineNote.self, id: note.id) { $0.text = text }
        }
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
