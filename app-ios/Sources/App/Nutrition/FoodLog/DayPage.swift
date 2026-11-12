import Feedback
import SwiftUI

/// One day's timeline: a pill per hour, or per meal section in the Sections display, with its + and totals, and the
/// entries under it.
struct DayPage: View {
    let day: CalendarDay

    @Environment(FoodLogState.self) private var state
    @Environment(MealCatalog.self) private var meals
    @Observe(AppSettings.current) private var settings
    @Observe private var entries: [FoodEntry]
    @Observe private var recipeIngredients: [UUID: RecipeTileIngredients]
    /// One width for every hour pill, so "8 AM" and "12 PM" line up; it scales with the text.
    @ScaledMetric private var hourPillWidth: CGFloat = 60
    /// Section pills share one width, which fits "Breakfast" with little padding.
    @ScaledMetric private var sectionPillWidth: CGFloat = 72
    @State private var groups = ViewMemo<GroupsKey, [TimelineGroup]>()
    /// The page's height above the bottom bars. Less the header, it is what a day of Sections too short to scroll
    /// fills. Read from the page's frame, since a scroll geometry change never reports the first height.
    @State private var pageHeight: CGFloat = 0

    init(day: CalendarDay) {
        self.day = day
        _entries = Observe(FoodEntry.on(day))
        _recipeIngredients = Observe(FoodEntry.recipeIngredients(on: day))
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
        let groups = self.groups(GroupsKey(entries: entries, timeline: timeline, sections: settings.nutrition.mealSections)) {
            FoodLog.groups(entries, settings: settings.nutrition)
        }
        ScrollViewReader { proxy in
            ScrollView {
                let column = self.column
                FillHeight(minHeight: isSections ? pageHeight - state.header.height - Self.bottomPadding : 0) {
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(Array(groups.enumerated()), id: \.element.id) { index, group in
                            if isSections, index > 0, group.rows.isEmpty || groups[index - 1].rows.isEmpty {
                                Spacer(minLength: 0)
                            }
                            SlotRow(
                                day: day, group: group, sections: settings.nutrition.mealSections, pillWidth: column.pillWidth,
                                showsTotals: timeline.hourlyTotals, rating: settings.nutrition.mealRating,
                                addsOnLongPress: timeline.addFoodsToHour == .longPress, premove: timeline.premove
                            )
                            ForEach(group.rows) { row in
                                EntryRow(
                                    row: row, ingredients: recipeIngredients[row.id], column: column,
                                    showsTime: timeline.foodTimestamps && !isSections, hidesDetails: timeline.hideFoodDetails
                                )
                                .id(row.id)
                            }
                            if let meal = group.meal, let fallback = group.mealFallbackName {
                                MealLineRow(meal: meal, fallback: fallback, entries: group.rows.map(\.entry))
                                    .padding(.leading, column.tileInset)
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
            .contentMargins(.top, state.header.height, for: .scrollContent)
            .scrollTargetBehavior(HeaderSnap(row: state.header.row))
            .onChange(of: entries) { old, new in
                guard Date.now < state.revealsAdditionsUntil, let added = FoodLog.added(from: old, to: new) else { return }
                withAnimation { proxy.scrollTo(added, anchor: .center) }
            }
        }
        .onScrollGeometryChange(for: PageScroll.self) { PageScroll($0) } action: { _, scroll in
            state.setScrolled(FoodLog.headerSlide(offset: scroll.offset, row: state.header.row, maxOffset: scroll.maxOffset), on: day)
        }
        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { pageHeight = $0 }
        .task(id: groups.compactMap(\.meal)) {
            for group in groups {
                if let meal = group.meal { meals.suggest(meal, from: group.rows.map(\.entry)) }
            }
        }
        .feedback(self)
    }
}

/// The line under a section's foods once they make a meal: the recipe it was saved as and how many times it was
/// logged, which opens the recipe, or the name the model suggested (`MealComponents.fallbackName` until it does, or
/// where it can't) and Create, which saves it as one and logs it in place of the foods.
/// It reads the index itself, so a change to it re-renders only the meal lines.
private struct MealLineRow: View {
    let meal: MealComponents
    let fallback: String
    let entries: [FoodEntry]

    @Environment(MealCatalog.self) private var meals
    @Environment(FoodLogState.self) private var state
    @Environment(LocalStore.self) private var store

    var body: some View {
        row(meals.index.line(for: meal, fallback: fallback))
    }

    private func row(_ line: MealIndex.Line) -> some View {
        Group {
            switch line {
            case let .saved(recipe, count):
                Button { state.path.append(FoodLogRoute.recipe(recipe.id)) } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "frying.pan").foregroundStyle(Theme.textSecondary)
                        Text(recipe.name).lineLimit(1)
                        Spacer(minLength: 8)
                        Text("Logged \(count)×").foregroundStyle(Theme.textSecondary).monospacedDigit()
                        Image(systemName: "chevron.right").font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.textSecondary)
                    }
                    .frame(minHeight: 36)
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .disabled(state.selecting)
                .accessibilityLabel("\(recipe.name), logged \(count) \(count == 1 ? "time" : "times")")
                .accessibilityHint("Opens the recipe")
            case let .suggested(name):
                HStack(spacing: 8) {
                    Image(systemName: "sparkles").foregroundStyle(Theme.textSecondary)
                    Text(name).lineLimit(1).foregroundStyle(Theme.textSecondary)
                        .accessibilityLabel("Suggested meal name, \(name)")
                    Spacer(minLength: 8)
                    Button("Create") { state.createMeal(name, from: entries, in: store) }
                        .chipButton()
                        .disabled(state.selecting)
                        .accessibilityLabel("Create \(name)")
                }
                .frame(minHeight: 36)
            }
        }
        .font(AppFont.chip)
        .foregroundStyle(Theme.textPrimary)
        .padding(.leading, 12)
        .padding(.bottom, 6)
        .feedback(self)
    }
}

private struct PageScroll: Equatable {
    let offset: Double
    let maxOffset: Double

    init(_ geometry: ScrollGeometry) {
        offset = geometry.contentOffset.y + geometry.contentInsets.top
        maxOffset = geometry.contentSize.height - geometry.containerSize.height
    }
}

/// Lets a page come to rest only with the header row fully shown or fully slid away.
private struct HeaderSnap: ScrollTargetBehavior {
    let row: Double

    /// The target counts from the content's top, and the container's size already leaves out the insets.
    func updateTarget(_ target: inout ScrollTarget, context: TargetContext) {
        let maxOffset = context.contentSize.height - context.containerSize.height
        target.rect.origin.y = FoodLog.headerSnap(target: target.rect.origin.y, row: row, maxOffset: maxOffset)
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
/// Meal Rating tag, and its macro totals. Tapping the pill selects its entries; under the long-press setting, holding it
/// adds food there.
private struct SlotRow: View {
    static let spacing: CGFloat = 6

    let day: CalendarDay
    let group: TimelineGroup
    let sections: [MealSection]
    let pillWidth: CGFloat
    let showsTotals: Bool
    let rating: MealRating
    let addsOnLongPress: Bool
    let premove: Bool

    @Environment(FoodLogState.self) private var state
    @Environment(LocalStore.self) private var store
    @State private var explainsRating = false

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
        let totals = group.totals
        let score = rating.enabled ? rating.formula.score(totals) : nil
        return HStack(spacing: Self.spacing) {
            pill
            control
            if let score {
                // Where the row runs out of width (larger text, a wide section pill) the tag shrinks to a dot of its
                // color, so the totals never truncate.
                ViewThatFits(in: .horizontal) {
                    trailing(totals, tag: ratingTag(score, showsText: true))
                    trailing(totals, tag: ratingTag(score, showsText: false))
                }
            } else {
                trailing(totals, tag: EmptyView())
            }
        }
        .frame(height: 40)
        .sheet(isPresented: $explainsRating) {
            MealRatingSheet(meal: group.slot.label, amounts: totals)
        }
    }

    private func trailing(_ totals: NutrientAmounts, tag: some View) -> some View {
        HStack(spacing: 0) {
            tag
            Spacer(minLength: 8)
            if showsTotals, !group.rows.isEmpty {
                HourTotals(amounts: totals)
            }
        }
    }

    /// Pasting inline turns the whole row into the paste button, so there the tag is not a button of its own.
    @ViewBuilder
    private func ratingTag(_ score: MealRating.Score, showsText: Bool) -> some View {
        if state.pending?.inline == true {
            MealRatingTag(score, showsText: showsText)
        } else {
            MealRatingButton(title: group.slot.label, score: score, formula: rating.formula, showsText: showsText) { explainsRating = true }
        }
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
    /// A logged recipe's ingredients, which its tile lists under its totals.
    let ingredients: RecipeTileIngredients?
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
            VStack(alignment: .leading, spacing: 6) {
                FoodRow(food: entry.food, serving: entry.serving, showsDetail: !hidesDetails)
                if let ingredients {
                    IngredientLines(ingredients: ingredients, showsAmounts: !hidesDetails)
                        // Under the name, past the 28 pt icon and the row's 12 pt spacing.
                        .padding(.leading, 40)
                }
            }
            // One element, so VoiceOver reads the ingredients with the food and the actions below land on the tile.
            .accessibilityElement(children: .combine)
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

/// A logged recipe's ingredients under its tile's name, one line each with its amount when the width allows, and no
/// nutrition, since the tile's totals above are what counts.
private struct IngredientLines: View {
    let ingredients: RecipeTileIngredients
    let showsAmounts: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            ForEach(Array(ingredients.lines.enumerated()), id: \.offset) { _, line in
                ViewThatFits(in: .horizontal) {
                    if showsAmounts {
                        HStack(spacing: 8) {
                            Text(line.name).fixedSize()
                            Spacer(minLength: 0)
                            Text(line.amount).fixedSize().monospacedDigit()
                        }
                    }
                    Text(line.name).lineLimit(1)
                }
            }
            if ingredients.more > 0 {
                Text("+\(ingredients.more) more")
            }
        }
        .font(AppFont.rowDetail)
        .foregroundStyle(Theme.textSecondary)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Ingredients: " + (ingredients.lines.map(\.name) + (ingredients.more > 0 ? ["\(ingredients.more) more"] : [])).joined(separator: ", "))
    }
}
