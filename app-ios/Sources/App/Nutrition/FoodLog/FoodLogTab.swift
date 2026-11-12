import Feedback
import SwiftUI

/// MacroFactor's Food Log: one header row (Calendar, the day strip, Day Options), the day's macro summary, and a
/// timeline of hours that pages between days.
struct FoodLogTab: View {
    @Environment(LocalStore.self) private var store
    @State private var state = FoodLogState()
    @State private var showingCalendar = false

    var body: some View {
        NavigationStack(path: $state.path) {
            DayPager()
                // The pages still scroll under the bottom bars, but not under the status bar once the header row has
                // slid away.
                .mask { Rectangle().ignoresSafeArea(edges: .bottom) }
                .overlay(alignment: .top) { FoodLogHeader(showingCalendar: $showingCalendar) }
                .background(Theme.background)
                .background { ShownDayEntries(day: state.day).id(state.day) }
                .safeAreaInset(edge: .bottom) { FoodLogBottomBar() }
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
        }
        .environment(state)
        .sheet(item: $state.logRequest) { LoggerSheet(start: LoggerStart($0)) }
        .sheet(item: $state.editing) { EntryEditor(entry: $0).environment(state) }
        .sheet(item: $state.recipeRequest) { request in
            RecipeEditor(draft: request.draft, onCreate: { state.replace(request.entries, with: $0, in: store) })
        }
        .sheet(isPresented: $showingCalendar) { CalendarSheet().environment(state) }
        .feedback(self)
    }
}

/// The header row and the day's summary over the timeline. The pages keep the header's height clear above their first
/// row, and the row slides away 1:1 as the shown day scrolls down, as if it were the timeline's own first row, unless
/// Calendar Week Banner pins it. Sliding moves only this overlay, so nothing under the finger is laid out again.
private struct FoodLogHeader: View {
    @Binding var showingCalendar: Bool

    @Environment(FoodLogState.self) private var state
    @Observe(NutritionPlan.all) private var plans
    @Observe(AppSettings.current) private var settings

    var body: some View {
        let banner = settings.nutrition.timeline.calendarWeekBanner
        VStack(spacing: 6) {
            HStack(spacing: 8) {
                Button("Calendar", systemImage: "calendar") {
                    if state.day == .today { showingCalendar = true } else { state.day = .today }
                }
                .accessibilityHint(state.day == .today ? "Opens the calendar" : "Goes to today")
                .headerButton()
                if banner == .hide {
                    Spacer(minLength: 0)
                } else {
                    DayStrip(selected: state.day, plans: plans)
                }
                DayMenu(day: state.day).id(state.day).headerButton()
            }
            .padding(.horizontal, Theme.margin)
            .onGeometryChange(for: Double.self) { $0.size.height } action: { state.header.row = $0 + 6 }
            DaySummary(day: state.day, plans: plans).id(state.day)
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

private extension View {
    /// The bottom bar's Your Foods circle: a fixed frame, so the Calendar button and the ⋯ menu match.
    func headerButton() -> some View {
        labelStyle(.iconOnly)
            .foregroundStyle(Theme.textPrimary)
            .frame(width: 48, height: 48)
            .contentShape(.circle)
            .glassEffect(.regular.interactive(), in: .circle)
            .buttonStyle(.plain)
    }
}

/// The day's four summary columns in two pages, swiped between as in MacroFactor: eaten against target, then what is left.
/// A day no plan covers has nothing to fill a bar against, so it shows what was eaten and a link to set targets.
/// Tapping the lines opens the Nutrition Overview. The day's status and edited totals sit beside the page dots.
private struct DaySummary: View {
    let day: CalendarDay
    let plans: [NutritionPlan]

    @Environment(FoodLogState.self) private var state
    @Observe(AppSettings.current) private var settings
    @Observe(NutrientGoal.all) private var goals
    @Observe(BodyWeight.latest) private var latestWeight
    @Observe private var entries: [FoodEntry]
    @Observe private var row: NutritionDay
    /// Per-device view state, as the Workout tab's collapsed cards are, so the page survives a relaunch and a day change.
    @AppStorage("nutrition.foodLog.summaryPage") private var page = MacroLine.Page.eaten

    init(day: CalendarDay, plans: [NutritionPlan]) {
        self.day = day
        self.plans = plans
        _entries = Observe(FoodEntry.on(day))
        _row = Observe(NutritionDay.one(day))
    }

    var body: some View {
        let targets = NutrientTargets.of(day, plans: plans, goals: goals, profile: settings.profile, latestWeightKg: latestWeight?.weightKg)
        let target = targets.target
        let totals = row.totals(entries)
        let lines = targets.summary(totals, settings: settings)
        let rating = MealRatingBadge(title: NutritionFormat.dayTitle(day), amounts: totals)
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
            // Over the summary rather than inside it, which reads as one VoiceOver element, so the rating stays a button.
            .overlay(alignment: .bottom) {
                if target != nil {
                    HStack(spacing: 6) {
                        rating
                        Group {
                            if let status { Text(status) }
                            Spacer()
                            if let edited { Text(edited) }
                        }
                        .allowsHitTesting(false)
                    }
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
                    rating
                }
                .font(AppFont.rowDetail)
            }
        }
        .padding(.horizontal, Theme.margin)
        .feedback(self)
    }
}

/// The days as horizontal pages: swiping the timeline moves a day, as MacroFactor's does. Select mode holds the page.
private struct DayPager: View {
    @Environment(FoodLogState.self) private var state
    @State private var origin = CalendarDay.today
    @State private var position: Int?

    var body: some View {
        ScrollView(.horizontal) {
            LazyHStack(spacing: 0) {
                ForEach(-FoodLogState.daysBack...FoodLogState.daysAhead, id: \.self) { offset in
                    DayPage(day: origin.adding(days: offset))
                        .containerRelativeFrame(.horizontal)
                }
            }
            .scrollTargetLayout()
        }
        .scrollTargetBehavior(.paging)
        .scrollPosition(id: $position)
        .scrollIndicators(.hidden)
        .scrollDisabled(state.selecting && state.pending?.inline != true)
        .onAppear { position = origin.days(to: state.day) }
        .onChange(of: position) { _, position in
            guard let position else { return }
            let day = origin.adding(days: position)
            if day != state.day { state.day = day }
        }
        .onChange(of: state.day) { _, day in
            let target = origin.days(to: day)
            guard position != target else { return }
            if let position, abs(position - target) == 1 {
                withAnimation { self.position = target }
            } else {
                position = target
            }
        }
    }
}

/// Select Date: the native month calendar, and Go to Today.
private struct CalendarSheet: View {
    @Environment(FoodLogState.self) private var state
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            DatePicker(
                "Day",
                selection: Binding(get: { state.day.date }, set: { state.day = CalendarDay($0); dismiss() }),
                in: CalendarDay.today.adding(days: -FoodLogState.daysBack).date...CalendarDay.today.adding(days: FoodLogState.daysAhead).date,
                displayedComponents: .date
            )
            .datePickerStyle(.graphical)
            .padding(.horizontal, Theme.margin)
            .detailTitle("Select Date")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
                ToolbarItem(placement: .bottomBar) {
                    Button("Go to Today") {
                        state.day = .today
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .feedback(self)
    }
}
