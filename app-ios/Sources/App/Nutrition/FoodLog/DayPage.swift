import Feedback
import SwiftUI

/// One day's timeline: an hour pill per hour with its + and totals, and the entries under their hour.
struct DayPage: View {
    let day: CalendarDay

    @Environment(FoodLogState.self) private var state
    @Observe(AppSettings.current) private var settings
    @Observe private var entries: [FoodEntry]
    /// One width for every hour pill, so "8 AM" and the current "12 PM" with its dot line up; it scales with the text.
    @ScaledMetric private var pillWidth: CGFloat = 60

    init(day: CalendarDay) {
        self.day = day
        _entries = Observe(FoodEntry.on(day))
    }

    private var timeline: NutritionSettings.Timeline { settings.nutrition.timeline }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(FoodLog.hours(entries, timeline: timeline)) { hour in
                        HourRow(
                            day: day, hour: hour, pillWidth: pillWidth, showsTotals: timeline.hourlyTotals,
                            addsOnLongPress: timeline.addFoodsToHour == .longPress, premove: timeline.premove
                        )
                        ForEach(hour.rows) { row in
                            EntryRow(row: row, pillWidth: pillWidth, showsTime: timeline.foodTimestamps, hidesDetails: timeline.hideFoodDetails)
                                .id(row.id)
                        }
                    }
                }
                .background(alignment: .leading) {
                    Rectangle().fill(Theme.separator).frame(width: 1).padding(.leading, pillWidth / 2)
                }
                .padding(.horizontal, Theme.margin)
                .padding(.bottom, 8)
            }
            .scrollIndicators(.hidden)
            .onChange(of: entries) { old, new in
                guard Date.now < state.revealsAdditionsUntil, let added = FoodLog.added(from: old, to: new) else { return }
                withAnimation { proxy.scrollTo(added, anchor: .center) }
            }
        }
        .onScrollGeometryChange(for: Bool?.self) { geometry in
            FoodLog.collapsesStrip(
                offset: geometry.contentOffset.y + geometry.contentInsets.top,
                slack: geometry.contentSize.height + geometry.contentInsets.top + geometry.contentInsets.bottom - geometry.containerSize.height
            )
        } action: { _, scrolled in
            guard let scrolled else { return }
            withAnimation(.snappy) { state.setScrolled(scrolled, on: day) }
        }
        .feedback(self)
    }
}

/// Observes the shown day's entries for the bars. It sits outside the pager so a page never reads `state.day`, which
/// would re-render every loaded page on each swipe.
struct ShownDayEntries: View {
    @Environment(FoodLogState.self) private var state
    @Observe private var entries: [FoodEntry]

    init(day: CalendarDay) {
        _entries = Observe(FoodEntry.on(day))
    }

    var body: some View {
        Color.clear.onChange(of: entries, initial: true) {
            if state.entries != entries { state.entries = entries }
        }
    }
}

/// The hour pill, its + (a paste button while pasting inline, a move button under Premove), and the hour's macro
/// totals. Tapping the pill selects the hour's entries; under the long-press setting, holding it adds food there.
private struct HourRow: View {
    static let spacing: CGFloat = 6

    let day: CalendarDay
    let hour: TimelineHour
    let pillWidth: CGFloat
    let showsTotals: Bool
    let addsOnLongPress: Bool
    let premove: Bool

    @Environment(FoodLogState.self) private var state
    @Environment(LocalStore.self) private var store

    var body: some View {
        Group {
            let label = NutritionFormat.hour(hour.hour)
            if state.pending?.inline == true {
                Button { state.paste(to: .hour(day, hour: hour.hour), in: store) } label: {
                    let paste = Image(systemName: "doc.on.clipboard.fill").hourIcon(isPrimary: true).frame(width: 32, height: 40)
                    row(pill: pill(label, isActive: false), control: paste).contentShape(.rect)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Paste at \(label)")
            } else {
                row(pill: interactivePill(label), control: control(label))
            }
        }
        .feedback(self)
    }

    private func row(pill: some View, control: some View) -> some View {
        HStack(spacing: Self.spacing) {
            pill
            control
            Spacer(minLength: 8)
            if showsTotals, !hour.rows.isEmpty {
                HourTotals(amounts: hour.totals)
            }
        }
        .frame(height: 40)
    }

    private func pill(_ label: String, isActive: Bool) -> some View {
        let isCurrent = day == .today && Calendar.current.component(.hour, from: .now) == hour.hour
        return Chip(title: label, trailingImage: isCurrent ? "circlebadge.fill" : nil, isActive: isActive, size: .small, width: pillWidth)
    }

    private func interactivePill(_ label: String) -> some View {
        let ids = hour.rows.map(\.entry.id)
        let isSelected = state.selecting && !ids.isEmpty && ids.allSatisfy(state.selection.contains)
        let addsHere = addsOnLongPress && !state.selecting
        return pill(label, isActive: isSelected)
            .frame(height: 40)
            .contentShape(.rect)
            .onTapGesture { state.selectHour(ids) }
            .gesture(LongPressGesture(minimumDuration: 0.35).onEnded { _ in state.requestLog(minute: hour.hour * 60) }, isEnabled: addsHere)
            .accessibilityElement()
            .accessibilityLabel(label)
            .accessibilityValue(ids.isEmpty ? "No foods" : "\(ids.count) \(ids.count == 1 ? "food" : "foods")")
            .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
            .accessibilityHint(ids.isEmpty ? "" : "Selects this hour's foods")
            .accessibilityAction { state.selectHour(ids) }
            .accessibilityActions {
                if addsHere {
                    Button("Add food at \(label)") { state.requestLog(minute: hour.hour * 60) }
                }
            }
    }

    @ViewBuilder
    private func control(_ label: String) -> some View {
        if premove, state.selecting, state.pending == nil {
            Button("Move to \(label)", systemImage: "arrow.left") {
                state.relocate(state.selectedEntries, .move, to: .hour(day, hour: hour.hour), in: store)
            }
            .buttonStyle(HourIconStyle(isPrimary: true))
            .disabled(state.selection.isEmpty)
        } else if !addsOnLongPress {
            Button("Add food at \(label)", systemImage: "plus") { state.requestLog(minute: hour.hour * 60) }
                .buttonStyle(HourIconStyle(isPrimary: false))
                .disabled(state.selecting)
        }
    }
}

private extension View {
    func hourIcon(isPrimary: Bool) -> some View {
        font(.system(size: 10, weight: .bold))
            .frame(width: 22, height: 22)
            .background(isPrimary ? Theme.textPrimary : Theme.surfaceRaised, in: Circle())
            .foregroundStyle(isPrimary ? Theme.onPrimary : Theme.textPrimary)
    }
}

private struct HourIconStyle: ButtonStyle {
    let isPrimary: Bool

    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .labelStyle(.iconOnly)
            .hourIcon(isPrimary: isPrimary)
            .opacity(configuration.isPressed || !isEnabled ? 0.5 : 1)
            .frame(width: 32, height: 40)
            .contentShape(.rect)
    }
}

/// "510 ઠ 33 P 18 F 56 C", each amount followed by its letter badge.
private struct HourTotals: View {
    let amounts: NutrientAmounts

    var body: some View {
        HStack(spacing: 10) {
            ForEach(NutrientID.macros, id: \.self) { id in
                HStack(spacing: 4) {
                    Text((amounts[id] ?? 0).wholeText).font(AppFont.medium(12)).monospacedDigit()
                    Group {
                        if id == .energy { calorieGlyph } else { Text(id.rawValue.uppercased()) }
                    }
                    .font(.system(size: 8, weight: .heavy))
                    .frame(width: 15, height: 15)
                    .background(Theme.surfaceRaised, in: Circle())
                }
            }
        }
        .foregroundStyle(Theme.textPrimary)
        .accessibilityElement(children: .combine)
    }
}

/// A food tile with its time, or its check circle in select mode, in the gutter. Pasting inline hides the circles,
/// so the destination day's foods don't read as a new selection. Tapping the tile or its circle toggles it, and a
/// long press starts select mode on it: the selection's bar holds its actions, so there is no context menu. Swiping
/// a tile left reveals Remove and Copy, as MacroFactor's does; it has no full swipe, because a left swipe that misses
/// the blank space was meant to page.
private struct EntryRow: View {
    let row: TimelineRow
    let pillWidth: CGFloat
    let showsTime: Bool
    let hidesDetails: Bool

    @Environment(FoodLogState.self) private var state
    @Environment(LocalStore.self) private var store

    var body: some View {
        let entry = row.entry
        let isSelected = state.selection.contains(entry.id)
        let showsCircle = state.selecting && state.pending?.inline != true
        HStack(spacing: HourRow.spacing) {
            ZStack {
                Color.clear
                if showsCircle {
                    Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 20))
                        .foregroundStyle(Theme.textPrimary)
                } else if showsTime, row.showsTime {
                    Text(NutritionFormat.time(entry.minute)).font(AppFont.caption(11)).foregroundStyle(Theme.textSecondary)
                }
            }
            .frame(width: pillWidth)
            HStack(spacing: 12) {
                FoodRow(food: entry.food, serving: entry.serving, showsDetail: !hidesDetails)
                RoundIconButton("Edit \(entry.food.name)", systemImage: "pencil", size: .small) { state.editing = entry }
                    .disabled(state.selecting)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Theme.surface, in: .rect(cornerRadius: Theme.smallCornerRadius))
            .overlay {
                if isSelected {
                    RoundedRectangle(cornerRadius: Theme.smallCornerRadius).strokeBorder(Theme.textSecondary, lineWidth: 1)
                }
            }
            .rowSwipeActions(trailing: state.selecting ? [] : [
                .destructive("Remove") { store.deleteEntries([entry.id]) },
                SwipeAction(title: "Copy", systemImage: "doc.on.doc") { state.copy(entry) },
            ])
            .accessibilityAddTraits(isSelected ? .isSelected : [])
            .accessibilityAction(named: isSelected ? "Deselect" : "Select") { state.select(entry.id) }
        }
        .contentShape(.rect)
        .onTapGesture { state.select(entry.id) }
        .onLongPressGesture(minimumDuration: 0.35) { state.startSelection(at: entry.id) }
        .padding(.bottom, 6)
        .feedback(self)
    }
}
