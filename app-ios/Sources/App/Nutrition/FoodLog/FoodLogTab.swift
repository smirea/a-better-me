import SwiftUI

/// MacroFactor's Food Log: a week strip, the day's macro summary, and a timeline of hours that pages between days.
struct FoodLogTab: View {
    @State private var state = FoodLogState()
    @State private var showingCalendar = false

    var body: some View {
        NavigationStack(path: $state.path) {
            VStack(spacing: 0) {
                FoodLogHeader()
                DayPager()
            }
            .background(Theme.background)
            .background { ShownDayEntries(day: state.day).id(state.day) }
            .safeAreaInset(edge: .bottom) { FoodLogBottomBar() }
            .screenTitle(NutritionFormat.dayTitle(state.day))
            .toolbar {
                if state.day != .today {
                    ToolbarItem {
                        Button("Today", systemImage: "arrow.uturn.backward") { state.day = .today }
                    }
                }
                ToolbarItem {
                    Button("Calendar", systemImage: "calendar") { showingCalendar = true }
                }
                ToolbarItem {
                    DayMenu(day: state.day).id(state.day)
                }
            }
            .navigationDestination(for: FoodLogRoute.self) { route in
                switch route {
                case let .overview(day): NutritionOverview(day: day)
                case let .contributors(day, nutrient): ContributorsView(day: day, nutrient: nutrient)
                }
            }
        }
        .environment(state)
        .sheet(item: $state.logRequest) { LoggerSheet(start: LoggerStart($0)) }
        .sheet(item: $state.editing) { EntryEditor(entry: $0).environment(state) }
        .sheet(item: $state.recipeRequest) { RecipeEditor(draft: $0.draft) }
        .sheet(item: $state.note) { NoteEditor(draft: $0) }
        .sheet(isPresented: $showingCalendar) { CalendarSheet().environment(state) }
    }
}

/// The week strip and the day's macro summary over the timeline. The summary stays; the strip follows Calendar Week
/// Banner, folding away while the timeline is scrolled down unless it is pinned.
private struct FoodLogHeader: View {
    @Environment(FoodLogState.self) private var state
    @Observe(NutritionPlan.all) private var plans
    @Observe(AppSettings.current) private var settings

    var body: some View {
        let banner = settings.nutrition.timeline.calendarWeekBanner
        VStack(spacing: 6) {
            if banner == .showAndPin || banner == .show && !state.scrolledDays.contains(state.day) {
                WeekStrip(anchor: state.day, weeks: -(FoodLogState.daysBack / 7 + 1)...(FoodLogState.daysAhead / 7 + 1)) {
                    WeekPills(monday: $0, plans: plans)
                }
                .transition(.move(edge: .top).combined(with: .opacity))
            }
            DaySummary(day: state.day, plans: plans).id(state.day)
        }
        .padding(.bottom, 6)
        .background(Theme.header)
    }
}

/// The week strip's pills, each outline filling with the day's calories against its target. One week per view, so a
/// page observes only its own entries.
private struct WeekPills: View {
    let monday: CalendarDay
    let plans: [NutritionPlan]

    @Environment(FoodLogState.self) private var state
    @Observe private var entries: [FoodEntry]
    @Observe private var rows: [NutritionDay]

    init(monday: CalendarDay, plans: [NutritionPlan]) {
        self.monday = monday
        self.plans = plans
        _entries = Observe(FoodEntry.between(monday, monday.adding(days: 6)))
        _rows = Observe(NutritionDay.between(monday, monday.adding(days: 6)))
    }

    var body: some View {
        let byDay = Dictionary(grouping: entries, by: \.day)
        let rowByDay = Dictionary(rows.map { ($0.id, $0) }) { first, _ in first }
        let kcal = Dictionary(uniqueKeysWithValues: monday.week.map { day in
            (day, (rowByDay[day] ?? NutritionDay(id: day)).totals(byDay[day] ?? [])[.energy] ?? 0)
        })
        ForEach(monday.week, id: \.self) { day in
            let target = NutritionPlan.effective(on: day, in: plans)?.target(on: day).energy
            DayPill(
                day: day, isSelected: day == state.day,
                ring: DayRing(fraction: FoodLog.ringProgress(kcal: kcal[day] ?? 0, target: target), color: Theme.calories)
            ) { state.day = day }
        }
    }
}

/// The day's four macro lines in two pages: eaten against target, then what is left. Without a plan it shows what
/// was eaten. Tapping it opens the Nutrition Overview.
private struct DaySummary: View {
    let day: CalendarDay
    let plans: [NutritionPlan]

    @Environment(FoodLogState.self) private var state
    @Observe(AppSettings.current) private var settings
    @Observe private var entries: [FoodEntry]
    @Observe private var row: NutritionDay

    init(day: CalendarDay, plans: [NutritionPlan]) {
        self.day = day
        self.plans = plans
        _entries = Observe(FoodEntry.on(day))
        _row = Observe(NutritionDay.one(day))
    }

    var body: some View {
        let target = NutritionPlan.effective(on: day, in: plans)?.target(on: day)
        let lines = FoodLog.summary(row.totals(entries), target: target, showOverages: settings.nutrition.showOverages)
        VStack(spacing: 4) {
            if row.status != .none || row.override != nil {
                DayStatusBadges(row: row)
            }
            Group {
                if target == nil {
                    MacroColumns(lines: lines, page: .consumed)
                } else {
                    TabView {
                        MacroColumns(lines: lines, page: .consumed)
                        MacroColumns(lines: lines, page: .remaining)
                    }
                    .tabViewStyle(.page(indexDisplayMode: .always))
                    .frame(height: 64)
                }
            }
            .contentShape(Rectangle())
            .onTapGesture { state.path.append(.overview(day)) }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isButton)
            .accessibilityHint("Opens the Nutrition Overview")
        }
        .padding(.horizontal, Theme.margin)
    }
}

private struct DayStatusBadges: View {
    let row: NutritionDay

    var body: some View {
        HStack(spacing: 6) {
            if row.status != .none { badge(row.status.title, systemImage: row.status.symbol) }
            if row.override != nil { badge("Edited totals", systemImage: "pencil") }
            Spacer()
        }
    }

    private func badge(_ title: String, systemImage: String) -> some View {
        Label(title, systemImage: systemImage)
            .font(AppFont.rowDetail)
            .foregroundStyle(Theme.textSecondary)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Theme.surfaceRaised, in: Capsule())
    }
}

private struct MacroColumns: View {
    enum Page { case consumed, remaining }

    let lines: [MacroLine]
    let page: Page

    var body: some View {
        HStack(spacing: 10) {
            ForEach(lines) { line in
                let color = line.nutrient.color
                VStack(alignment: .leading, spacing: 5) {
                    Text("\(prefix(line.nutrient)) \(Text(text(line)).font(AppFont.rowDetail))")
                        .font(AppFont.headline(12))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    ProgressView(value: fill(line))
                        .progressViewStyle(.bar(color, height: 3))
                        .scaleEffect(x: page == .remaining ? -1 : 1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(.bottom, lines.first?.target == nil ? 0 : 30)
        .contentShape(Rectangle())
    }

    private func prefix(_ id: NutrientID) -> Text {
        id == .energy ? Text(calorieGlyph) : Text(id.rawValue.uppercased())
    }

    private func text(_ line: MacroLine) -> String {
        let consumed = Int(line.consumed.rounded())
        switch (page, line.target, line.remaining) {
        case let (.remaining, _, remaining?): return "\(Int(remaining.rounded())) left"
        case let (_, target?, _): return "\(consumed) / \(Int(target.rounded()))"
        default: return "\(consumed)"
        }
    }

    private func fill(_ line: MacroLine) -> Double {
        switch page {
        case .consumed: line.progress
        case .remaining: line.target == nil ? 0 : 1 - line.progress
        }
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
    }
}
