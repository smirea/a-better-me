import Feedback
import SwiftUI

/// MacroFactor's Food Log: one header row (Calendar, the day strip, Day Options), the day's macro summary, and a
/// timeline of hours that pages between days.
struct FoodLogTab: View {
    @Environment(LocalStore.self) private var store
    @Bindable var state: FoodLogState

    var body: some View {
        NavigationStack(path: $state.path) {
            DayPager(day: $state.day, held: state.selecting && state.pending == nil) { DayPage(day: $0) }
                // The pages still scroll under the bottom bars, but not under the status bar once the header row has
                // slid away.
                .mask { Rectangle().ignoresSafeArea(edges: .bottom) }
                .overlay(alignment: .top) { FoodLogHeader() }
                .background(Theme.background)
                .background { ShownDayEntries(day: state.day).id(state.day) }
                .safeAreaInset(edge: .bottom, spacing: 0) { FoodLogBottomBar() }
                // Selecting or pasting puts its own bar of actions at the bottom, so the tab bar steps aside for it.
                .toolbarVisibility(state.selecting || state.pending != nil ? .hidden : .automatic, for: .tabBar)
                .animation(.snappy, value: state.selecting || state.pending != nil)
                // The header row replaces the bar; the title still names the day for VoiceOver and pushed screens' back button.
                .navigationTitle(NutritionFormat.dayTitle(state.day))
                .toolbarVisibility(.hidden, for: .navigationBar)
                .navigationDestination(for: FoodLogRoute.self) { route in
                    switch route {
                    case let .overview(day): NutritionOverview(day: day)
                    case let .contributors(day, nutrient): ContributorsView(day: day, nutrient: nutrient)
                    case .strategy: StrategyView()
                    case let .recipe(id): RecipeDetailView(recipeID: id)
                    }
                }
                .navigationDestination(for: StrategyRoute.self) { $0.destination }
                .navigationDestination(for: SupplementRoute.self) { $0.destination }
        }
        .environment(state)
        .sheet(item: $state.logRequest) { LoggerSheet(start: LoggerStart($0)) }
        .sheet(item: $state.editing) { EntryEditor(entry: $0).environment(state) }
        .sheet(item: $state.altering) { AlterEntry(entry: $0) }
        .sheet(item: $state.recipeRequest) { request in
            RecipeEditor(draft: request.draft, onCreate: { state.replace(request.entries, with: $0, in: store) })
        }
        .feedback(self)
    }
}

/// The header row and the day's summary over the timeline. The pages keep the header's height clear above their first
/// row, and the row slides away 1:1 as the shown day scrolls down, as if it were the timeline's own first row, unless
/// Calendar Week Banner pins it. Sliding moves only this overlay, so nothing under the finger is laid out again.
private struct FoodLogHeader: View {
    @Environment(FoodLogState.self) private var state
    @Observe(NutritionPlan.all) private var plans
    @Observe(AppSettings.current) private var settings

    var body: some View {
        @Bindable var state = state
        let banner = settings.nutrition.timeline.calendarWeekBanner
        VStack(spacing: 6) {
            DayHeaderRow(day: $state.day) {
                if banner == .hide {
                    Spacer(minLength: 0)
                } else {
                    DayStrip(selected: state.day) { day in
                        CaloriePill(day: day, plans: plans, isSelected: day == state.day) { state.day = day }
                    }
                }
            } menu: {
                DayMenu(day: state.day).id(state.day)
            }
            .onGeometryChange(for: Double.self) { $0.size.height } action: { state.header.row = $0 + 6 }
            DaySummary(day: state.day).id(state.day)
        }
        .background(Theme.background)
        .onGeometryChange(for: Double.self) { $0.size.height } action: { state.header.height = $0 }
        .modifier(HeaderSlide(pinned: banner == .showAndPin))
        // An overlay sorts after the pager, so VoiceOver would read the whole timeline before the header.
        .accessibilitySortPriority(1)
        // Clipping to the header's own frame keeps the sliding row from drawing over the status bar.
        .clipped()
        .feedback(self)
    }
}

/// Reads the shown day's scroll in its own view, so only the offset re-renders while the row slides.
private struct HeaderSlide: ViewModifier {
    let pinned: Bool

    @Environment(FoodLogState.self) private var state

    func body(content: Content) -> some View {
        content
            .offset(y: pinned ? 0 : -state.scrolled[state.day, default: 0])
            .animation(.snappy, value: state.day)
    }
}

/// A day's pill, its outline filling with the day's calories against its target. Each observes only its own day, and
/// the strip is lazy, so only the pills on screen query.
private struct CaloriePill: View {
    let day: CalendarDay
    let plans: [NutritionPlan]
    let isSelected: Bool
    let action: () -> Void

    @Observe private var entries: [FoodEntry]
    @Observe private var row: NutritionDay

    init(day: CalendarDay, plans: [NutritionPlan], isSelected: Bool, action: @escaping () -> Void) {
        self.day = day
        self.plans = plans
        self.isSelected = isSelected
        self.action = action
        _entries = Observe(FoodEntry.on(day), async: true)
        _row = Observe(NutritionDay.one(day), async: true)
    }

    var body: some View {
        let kcal = row.totals(entries)[.energy] ?? 0
        let target = NutritionPlan.effective(on: day, in: plans)?.target(on: day).energy
        DayPill(
            day: day, isSelected: isSelected,
            ring: DayRing(fraction: FoodLog.ringProgress(kcal: kcal, target: target), color: Theme.calories),
            action: action
        )
    }
}

/// The day's four summary columns in two pages, swiped between as in MacroFactor: eaten against target, then what is left.
/// A day no plan covers has nothing to fill a bar against, so it shows what was eaten and a link to set targets.
/// Tapping the lines opens the Nutrition Overview. The day's status and edited totals sit beside the page dots.
private struct DaySummary: View {
    let day: CalendarDay

    @Environment(FoodLogState.self) private var state
    private var owner = OwnerTargets()
    @Observe private var entries: [FoodEntry]
    @Observe private var row: NutritionDay
    /// Per-device view state, as the Workout tab's collapsed cards are, so the page survives a relaunch and a day change.
    @AppStorage("nutrition.foodLog.summaryPage") private var page = MacroLine.Page.eaten

    init(day: CalendarDay) {
        self.day = day
        _entries = Observe(FoodEntry.on(day))
        _row = Observe(NutritionDay.one(day))
    }

    var body: some View {
        let targets = owner.on(day)
        let target = targets.target
        let totals = row.totals(entries)
        let lines = targets.summary(totals, settings: owner.settings)
        let status = row.status == .none ? nil : row.status.title
        let edited = row.override == nil ? nil : "Edited totals"
        VStack(spacing: 4) {
            Group {
                if target == nil {
                    MacroTotalsBars(lines: lines, page: .eaten)
                } else {
                    // The bottom padding leaves room for the page dots.
                    TabView(selection: $page) {
                        MacroTotalsBars(lines: lines, page: .eaten).padding(.bottom, 30).tag(MacroLine.Page.eaten)
                        MacroTotalsBars(lines: lines, page: .remaining).padding(.bottom, 30).tag(MacroLine.Page.remaining)
                    }
                    .tabViewStyle(.page(indexDisplayMode: .always))
                    .frame(height: 64)
                    // The page dots sit at a fixed height inside the TabView and leave an empty band under them, which a
                    // shorter frame doesn't remove (it moves the dots onto the bars). The timeline overlaps the band instead.
                    .padding(.bottom, -14)
                }
            }
            .contentShape(Rectangle())
            .onTapGesture { state.path.append(FoodLogRoute.overview(day)) }
            // Combining the paged TabView reads only its page indicator, so the label spells the lines out.
            .accessibilityElement(children: .ignore)
            .accessibilityLabel((lines.map(\.spoken) + [status, edited].compactMap(\.self)).joined(separator: ", "))
            .accessibilityAddTraits(.isButton)
            .accessibilityHint("Opens the Nutrition Overview")
            .overlay(alignment: .bottom) {
                if target != nil {
                    HStack(spacing: 6) {
                        if let status { Text(status) }
                        Spacer()
                        if let edited { Text(edited) }
                    }
                    .allowsHitTesting(false)
                    .font(AppFont.caption(11))
                    .foregroundStyle(Theme.textSecondary)
                    .frame(height: 20)
                }
            }
            if target == nil {
                HStack(spacing: 4) {
                    Button { state.path.append(FoodLogRoute.strategy) } label: {
                        HStack(spacing: 4) {
                            Text("No targets for this day")
                                .foregroundStyle(Theme.textSecondary)
                            Text("Set Targets")
                            Image(systemName: "chevron.right").font(.system(size: 10, weight: .bold))
                        }
                        .contentShape(.rect)
                    }
                    .buttonStyle(.plain)
                    Spacer(minLength: 0)
                    Text([status, edited].compactMap(\.self).joined(separator: " · "))
                        .foregroundStyle(Theme.textSecondary)
                }
                .font(AppFont.rowDetail)
            }
        }
        .padding(.horizontal, Theme.margin)
        .feedback(self)
    }
}
