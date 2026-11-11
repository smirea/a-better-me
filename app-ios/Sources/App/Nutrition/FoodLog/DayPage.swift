import Feedback
import SwiftUI

/// One day's timeline: a pill per hour, or per meal section in the Sections display, with its + and totals, and the
/// entries under it.
struct DayPage: View {
    let day: CalendarDay

    @Environment(FoodLogState.self) private var state
    @Observe(AppSettings.current) private var settings
    @Observe private var entries: [FoodEntry]
    /// One width for every hour pill, so "8 AM" and "12 PM" line up; it scales with the text.
    @ScaledMetric private var hourPillWidth: CGFloat = 60
    /// Section pills share one width, which fits "Breakfast" with little padding.
    @ScaledMetric private var sectionPillWidth: CGFloat = 72
    @State private var groups = ViewMemo<GroupsKey, [TimelineGroup]>()
    /// The page's height above the bottom bars, which a day of Sections too short to scroll fills. The bars' inset is
    /// already out of the container's size.
    @State private var visibleHeight: CGFloat = 0

    init(day: CalendarDay) {
        self.day = day
        _entries = Observe(FoodEntry.on(day))
    }

    private var timeline: NutritionSettings.Timeline { settings.nutrition.timeline }
    private var isSections: Bool { timeline.display == .sections }
    private var column: TimelineColumn {
        isSections
            ? TimelineColumn(pillWidth: sectionPillWidth, tileInset: EntryRow.circleSize / 2, hasLine: false)
            : TimelineColumn(pillWidth: hourPillWidth, tileInset: hourPillWidth + SlotRow.spacing, hasLine: true)
    }

    private struct GroupsKey: Equatable {
        let entries: [FoodEntry]
        let timeline: NutritionSettings.Timeline
        let sections: [MealSection]
    }

    private static let bottomPadding: CGFloat = 8

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                let groups = self.groups(GroupsKey(entries: entries, timeline: timeline, sections: settings.nutrition.mealSections)) {
                    FoodLog.groups(entries, settings: settings.nutrition)
                }
                let column = self.column
                FillHeight(minHeight: isSections ? visibleHeight - Self.bottomPadding : 0) {
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(Array(groups.enumerated()), id: \.element.id) { index, group in
                            if isSections, index > 0, group.rows.isEmpty || groups[index - 1].rows.isEmpty {
                                Spacer(minLength: 0)
                            }
                            SlotRow(
                                day: day, group: group, sections: settings.nutrition.mealSections, pillWidth: column.pillWidth,
                                showsTotals: timeline.hourlyTotals, addsOnLongPress: timeline.addFoodsToHour == .longPress, premove: timeline.premove
                            )
                            ForEach(group.rows) { row in
                                EntryRow(
                                    row: row, column: column, showsTime: timeline.foodTimestamps && !isSections, hidesDetails: timeline.hideFoodDetails
                                )
                                .id(row.id)
                            }
                        }
                    }
                }
                .background(alignment: .leading) {
                    if column.hasLine {
                        Rectangle().fill(Theme.separator).frame(width: 1).padding(.leading, column.pillWidth / 2)
                    }
                }
                .padding(.horizontal, Theme.margin)
                .padding(.bottom, Self.bottomPadding)
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
        .onScrollGeometryChange(for: CGFloat.self) { $0.containerSize.height } action: { _, height in
            visibleHeight = height
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

/// Offers its content at least `minHeight`, so the spacers around a short day's empty sections share what the page
/// leaves; a day that scrolls is taller, so its spacers get nothing. `.frame(minHeight:)` sized itself to the height but
/// still laid the stack out at its ideal height, leaving the sections bunched at the top.
private struct FillHeight: Layout {
    let minHeight: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        guard let content = subviews.first else { return .zero }
        let ideal = content.sizeThatFits(ProposedViewSize(width: proposal.width, height: nil))
        guard ideal.height < minHeight else { return ideal }
        return content.sizeThatFits(ProposedViewSize(width: proposal.width, height: minHeight))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        subviews.first?.place(at: bounds.origin, proposal: ProposedViewSize(bounds.size))
    }
}

/// Where the tiles start, and whether a line runs down the pills. Time centers the line on the hour pills, with each
/// tile's time on it in the gutter. Sections has no line and nests the tiles under the pill, indented by half a check
/// circle, so select mode's circles, centered on the tiles' left edges, line up with the pills' left edges.
private struct TimelineColumn {
    let pillWidth: CGFloat
    let tileInset: CGFloat
    let hasLine: Bool
}

/// The hour's or section's pill, its + (a paste button while pasting inline, a move button under Premove), and its
/// macro totals. Tapping the pill selects its entries; under the long-press setting, holding it adds food there.
private struct SlotRow: View {
    static let spacing: CGFloat = 6

    let day: CalendarDay
    let group: TimelineGroup
    let sections: [MealSection]
    let pillWidth: CGFloat
    let showsTotals: Bool
    let addsOnLongPress: Bool
    let premove: Bool

    @Environment(FoodLogState.self) private var state
    @Environment(LocalStore.self) private var store

    var body: some View {
        Group {
            let label = group.slot.label
            if state.pending?.inline == true {
                Button { state.paste(to: target, in: store) } label: {
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

    /// The minute food added here lands at: the hour's start, or for a section now when today's clock is inside it,
    /// else its typical minute.
    private var minute: Int {
        switch group.slot {
        case let .hour(hour): hour * 60
        case let .section(section): sections.logMinute(for: section, on: day, now: .now)
        }
    }

    private var target: PasteTarget {
        switch group.slot {
        case let .hour(hour): .hour(day, hour: hour)
        case let .section(section): .section(day, section, minute: minute)
        }
    }

    private func requestLog() {
        if case let .section(section) = group.slot {
            state.requestLog(minute: minute, section: section)
        } else {
            state.requestLog(minute: minute)
        }
    }

    private func row(pill: some View, control: some View) -> some View {
        HStack(spacing: Self.spacing) {
            pill
            control
            Spacer(minLength: 8)
            if showsTotals, !group.rows.isEmpty {
                HourTotals(amounts: group.totals)
            }
        }
        .frame(height: 40)
    }

    private func pill(_ label: String, isActive: Bool) -> some View {
        let isCurrent = day == .today && group.minutes.contains(Date.now.minuteOfDay())
        return Chip(title: label, isActive: isActive, size: .small, width: pillWidth)
            // A ring standing off the pill, drawn behind it so the pills keep one width; selection fills the pill instead.
            .background {
                if isCurrent { Capsule().strokeBorder(Theme.textPrimary, lineWidth: 1.5).padding(-3) }
            }
    }

    private func interactivePill(_ label: String) -> some View {
        let ids = group.rows.map(\.entry.id)
        let isSelected = state.selecting && !ids.isEmpty && ids.allSatisfy(state.selection.contains)
        let addsHere = addsOnLongPress && !state.selecting
        return pill(label, isActive: isSelected)
            .frame(height: 40)
            .contentShape(.rect)
            .gesture(LongPressGesture(minimumDuration: 0.35).exclusively(before: TapGesture()).onEnded { gesture in
                if case .first = gesture, addsHere { requestLog() } else { state.selectHour(ids) }
            })
            .accessibilityElement()
            .accessibilityLabel(label)
            .accessibilityValue(ids.isEmpty ? "No foods" : "\(ids.count) \(ids.count == 1 ? "food" : "foods")")
            .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
            .accessibilityHint(ids.isEmpty ? "" : "Selects these foods")
            .accessibilityAction { state.selectHour(ids) }
            .accessibilityActions {
                if addsHere {
                    Button("Add food at \(label)") { requestLog() }
                }
            }
    }

    @ViewBuilder
    private func control(_ label: String) -> some View {
        if premove, state.selecting, state.pending == nil {
            Button("Move to \(label)", systemImage: "arrow.left") {
                state.relocate(state.selectedEntries, .move, to: target, in: store)
            }
            .buttonStyle(HourIconStyle(isPrimary: true))
            .disabled(state.selection.isEmpty)
        } else if !addsOnLongPress {
            Button("Add food at \(label)", systemImage: "plus") { requestLog() }
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

/// A food tile with its time on the timeline's line, and in select mode a check circle floating half over its left
/// edge. Pasting inline hides the circles, so the destination day's foods don't read as a new selection. Tapping the
/// tile opens its editor, or toggles it in select mode. A long press starts select mode on it: the bar holds the
/// selection's actions, so there is no context menu. Swiping
/// a tile left reveals Remove and Copy, as MacroFactor's does; it has no full swipe, because a left swipe that misses
/// the blank space was meant to page.
private struct EntryRow: View {
    let row: TimelineRow
    let column: TimelineColumn
    let showsTime: Bool
    let hidesDetails: Bool

    static let circleSize: CGFloat = 20

    @Environment(FoodLogState.self) private var state
    @Environment(LocalStore.self) private var store

    var body: some View {
        let entry = row.entry
        let isSelected = state.selection.contains(entry.id)
        let showsCircle = state.selecting && state.pending?.inline != true
        HStack(spacing: 0) {
            Color.clear.frame(width: column.tileInset).overlay(alignment: .leading) {
                if showsTime, row.showsTime {
                    Text(NutritionFormat.time(entry.minute)).font(AppFont.caption(11)).foregroundStyle(Theme.textSecondary)
                        .frame(width: column.pillWidth)
                }
            }
            FoodRow(food: entry.food, serving: entry.serving, showsDetail: !hidesDetails)
                // The circle covers the tile's first half circle, so the icon steps right to clear it.
                .padding(.leading, showsCircle ? 12 + Self.circleSize / 2 : 12)
                .padding(.trailing, 12)
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
                .accessibilityAction { state.tap(entry) }
                .accessibilityAction(named: isSelected ? "Deselect" : "Select") { state.select(entry.id) }
                .accessibilityAction(named: "Edit") { state.editing = entry }
        }
        // On the row rather than the tile, whose swipe clips it.
        .overlay(alignment: .leading) {
            if showsCircle {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: Self.circleSize))
                    .foregroundStyle(Theme.textPrimary)
                    .background(Theme.background, in: .circle)
                    .padding(.leading, column.tileInset - Self.circleSize / 2)
            }
        }
        // The gutter's clear color would otherwise take a share of the height a short day of Sections spreads.
        .fixedSize(horizontal: false, vertical: true)
        .contentShape(.rect)
        .animation(.snappy, value: showsCircle)
        // A tap gesture recognizes on release however long the hold, so separate tap and long-press gestures both fired.
        .gesture(LongPressGesture(minimumDuration: 0.35).exclusively(before: TapGesture()).onEnded { gesture in
            switch gesture {
            case .first: state.startSelection(at: entry.id)
            case .second: state.tap(entry)
            }
        })
        .padding(.bottom, 6)
        .feedback(self)
    }
}
