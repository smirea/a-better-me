import Feedback
import SwiftUI

enum LoggerRoute: Hashable {
    case food(LoggerPick)
    /// A logged entry of the meal, or an ingredient, as it was when its detail opened.
    case mealItem(IngredientList.Item)
    case meal
    /// The row as it was when its detail opened, so an edit never lands on a food a later read put in its place.
    case rambleRow(RambleRow)
    case prepare(Recipe)
}

/// MacroFactor's logger (research spec §5): one full-height sheet with the banner (exit, time chip, the day's totals,
/// the meal) over the Scan, Photo, Ramble, Search, Quick Add, and Library tabs. Describe is not built
/// (docs/decisions/nutrition.md). Every add logs at once and the sheet stays open for the next food. With an
/// `.ingredients` destination the same sheet adds a recipe's ingredients instead, and nothing is logged.
struct LoggerSheet: View {
    let start: LoggerStart
    var destination = LoggerDestination.foodLog
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var session: LoggerSession?
    @State private var failure: String?

    var body: some View {
        Group {
            if let session {
                LoggerContent(session: session, close: { dismiss() })
            } else if let failure {
                ContentUnavailableView("Food search is unavailable", systemImage: "exclamationmark.triangle", description: Text(failure))
            } else {
                Color.clear
            }
        }
        .background(Theme.background)
        .presentationDetents([.large])
        .interactiveDismissDisabled(session?.hasUnlogged == true)
        .task {
            guard session == nil else { return }
            if let library = start.library { UserDefaults.standard.set(library.rawValue, forKey: FoodLibraryTab.storageKey) }
            do {
                session = LoggerSession(store: store, search: try await FoodSearch.load(store: store), start: start, destination: destination)
            } catch {
                failure = String(describing: error)
            }
        }
        .feedback(self)
    }
}

private struct LoggerContent: View {
    @Bindable var session: LoggerSession
    let close: () -> Void
    @Observe(AppSettings.current) private var settings
    @State private var path: [LoggerRoute] = []
    @State private var confirmingExit = false
    @State private var choosingTime = false

    var body: some View {
        // Ramble takes the whole screen: its own band holds close, its macros, and the other ways to log.
        let rambling = session.tab == .ramble && path.allSatisfy(\.isRambleRow)
        let back: (() -> Void)? = path.isEmpty ? nil : { path.removeLast() }
        VStack(spacing: 0) {
            if !rambling {
                LoggerBanner(session: session, back: back, exit: exit, chooseTime: { choosingTime = true }, openMeal: openMeal)
                    .id(session.time.day)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
            // Above the stack, so the Library's own navigation bar (title, sort, create, filter) sits under the tabs;
            // a pushed detail or the meal covers them, as in MacroFactor.
            if path.isEmpty, !rambling {
                Picker("Logger tab", selection: $session.tab) {
                    ForEach(LoggerTab.allCases, id: \.self) { tab in
                        Text(tab.segment).accessibilityLabel(tab.title).tag(tab)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, Theme.margin)
                .padding(.vertical, 8)
            }
            NavigationStack(path: $path) {
                tab
                    .frame(maxHeight: .infinity)
                    .background(Theme.background)
                    .keepsSwipeBack()
                    .navigationDestination(for: LoggerRoute.self) { route in
                        destination(route)
                            // The banner's Back pops a pushed screen, so its own bar has none. A Ramble row's detail has
                            // no banner above it and keeps the system one.
                            .navigationBarBackButtonHidden(!route.isRambleRow)
                    }
            }
        }
        .overlay(alignment: .bottom) {
            if let notice = session.notice {
                LoggerNoticeBar(session: session, notice: notice)
                    .padding(.horizontal, Theme.margin)
                    .padding(.bottom, 72)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.snappy, value: session.notice)
        .sensoryFeedback(.success, trigger: session.notice?.id) { _, new in new != nil }
        .onDisappear { session.ramble.cancel() }
        .alert("Exit Ramble?", isPresented: $confirmingExit) {
            Button("Exit", role: .destructive, action: close)
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("The foods from your ramble will be cleared.")
        }
        .sheet(isPresented: $choosingTime) {
            switch settings.nutrition.logger.timeSelection {
            case .datePicker: LogTimePicker(session: session)
            case .timePad: LogHourPad(session: session)
            }
        }
    }

    @ViewBuilder private func destination(_ route: LoggerRoute) -> some View {
        let prepare: (Recipe) -> Void = { path.append(.prepare($0)) }
        switch route {
        case let .food(pick): FoodDetailView(session: session, editing: nil, pick: pick, prepare: prepare)
        case let .mealItem(item): FoodDetailView(session: session, editing: item.id, pick: item.pick, prepare: prepare)
        case .meal: MealView(session: session, open: { path.append(.mealItem($0)) }).id(session.time.day)
        case let .rambleRow(row):
            if case let .food(food) = row.content {
                FoodDetailView(session: session, editing: nil, pick: food.pick, prepare: prepare, ramble: RambleEdit(
                    update: { session.ramble.setServing($0, of: row) },
                    day: row.day,
                    others: session.ramble.others(than: row)
                ))
            }
        case let .prepare(recipe): RecipePrepareView(recipe: recipe)
        }
    }

    @ViewBuilder private var tab: some View {
        // A food's detail never stacks on its own: a second Add on the copy underneath would log it twice.
        let detail: (LoggerPick) -> Void = { pick in if path.last != .food(pick) { path.append(.food(pick)) } }
        let open = settings.nutrition.logger.optimization == .context ? addAndShowMeal : detail
        switch session.tab {
        case .scan: ScanTab(session: session, open: detail).toolbar(.hidden, for: .navigationBar)
        case .photo: PhotoTab(session: session, showMeal: openMeal).toolbar(.hidden, for: .navigationBar)
        case .ramble:
            RambleTab(
                session: session, open: { path.append(.rambleRow($0)) }, close: exit, added: openMeal,
                switchTo: { tab in withAnimation(.snappy) { session.tab = tab } },
                search: { name in
                    session.setQuery(name, branded: settings.nutrition.searchBranded)
                    withAnimation(.snappy) { session.tab = .search }
                }
            )
            .toolbar(.hidden, for: .navigationBar)
        case .search: SearchTab(session: session, open: open).toolbar(.hidden, for: .navigationBar)
        case .quickAdd: QuickAddTab(session: session).toolbar(.hidden, for: .navigationBar)
        case .library:
            FoodLibraryView(session: session, onOpen: { open($0.pick) }, onPrepare: { path.append(.prepare($0)) })
        }
    }

    private func exit() {
        if session.hasUnlogged { confirmingExit = true } else { close() }
    }

    /// Optimize for context: a tapped result is logged, and the meal shows.
    private func addAndShowMeal(_ pick: LoggerPick) {
        session.add(pick)
        openMeal()
    }

    private func openMeal() {
        // A field still editing under the push comes back focused on Back, and its keyboard then covers the tab's bar
        // and the Undo notice. The meal button is outside the tab, so it ends the editing itself.
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
        if path.last != .meal { path.append(.meal) }
    }
}

/// "Logged Banana to Lunch · Undo", over the tab's bottom bar until the next add or a few seconds pass.
private struct LoggerNoticeBar: View {
    let session: LoggerSession
    let notice: LoggerNotice

    var body: some View {
        HStack(spacing: 12) {
            Text(notice.message).font(AppFont.chip).lineLimit(2)
            Spacer(minLength: 0)
            Button("Undo") { withAnimation(.snappy) { session.undo(notice) } }
                .font(AppFont.headline(14))
                .buttonStyle(.plain)
                .accessibilityLabel("Undo, \(notice.message)")
        }
        .padding(.horizontal, 18)
        .frame(minHeight: 44)
        .glassEffect(.regular, in: .capsule)
        .task(id: notice.id) {
            try? await Task.sleep(for: .seconds(4))
            if session.notice == notice { session.notice = nil }
        }
        .feedback(self)
    }
}

/// The logger's top band: exit, or Back while a screen is pushed over the tabs, the time chip, and the meal over the
/// day's totals with what is being added counted in.
private struct LoggerBanner: View {
    let session: LoggerSession
    let back: (() -> Void)?
    let exit: () -> Void
    let chooseTime: () -> Void
    let openMeal: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            GlassEffectContainer {
                HStack(spacing: 10) {
                    if let back {
                        RoundIconButton("Back", systemImage: "chevron.backward", action: back)
                    } else {
                        RoundIconButton("Close", systemImage: "xmark", action: exit)
                    }
                    if !session.addsIngredients {
                        Button(action: chooseTime) {
                            Text(timeLabel).font(AppFont.headline(14))
                        }
                        .chipButton()
                        .accessibilityLabel("Log time, \(timeLabel)")
                    }
                    Spacer(minLength: 0)
                    MealButton(session: session, open: openMeal)
                }
            }
            PlateDayTotals(day: session.time.day, plate: session.adding, plateOnly: session.addsIngredients)
        }
        .padding(.horizontal, Theme.margin)
        .padding(.top, 14)
        .padding(.bottom, 6)
        .feedback(self)
    }

    private var timeLabel: String { session.time.label(sections: session.showsSections ? session.sections : nil) }
}

/// The meal the logger adds to, and its count: what this day's section holds, or the recipe's ingredients. It opens
/// the meal, where each one is changed or removed.
private struct MealButton: View {
    let session: LoggerSession
    let open: () -> Void
    @Observe<[FoodEntry]> private var entries: [FoodEntry]

    init(session: LoggerSession, open: @escaping () -> Void) {
        self.session = session
        self.open = open
        _entries = Observe(FoodEntry.on(session.time.day))
    }

    var body: some View {
        let count = session.addsIngredients ? session.ingredients.items.count : entries.filter { $0.section == session.section.id }.count
        Button(action: open) {
            HStack(spacing: 6) {
                Image(systemName: "fork.knife")
                if count > 0 {
                    Text("\(count)").font(AppFont.headline(15)).contentTransition(.numericText())
                }
            }
        }
        .chipButton()
        .animation(.snappy, value: count)
        .accessibilityLabel("\(session.mealName), \(count == 1 ? "1 food" : "\(count) foods")")
        .feedback(self)
    }
}

private extension LoggerRoute {
    var isRambleRow: Bool { if case .rambleRow = self { true } else { false } }
}

extension LoggerSession {
    /// What the banner counts on top of the day: the food detail's amount or the Quick Add being typed, and in a recipe
    /// its ingredients.
    var adding: NutrientAmounts {
        let base = addsIngredients ? ingredients.totals : NutrientAmounts()
        return pending.map { base + $0.amounts } ?? base
    }
}

extension FoodLibraryView.Item {
    /// A food or recipe at its default serving, a favorite at its saved one, with the changes of an altered recipe.
    var pick: LoggerPick {
        switch self {
        case let .food(food): LoggerPick(FoodPortion(food.snapshot))
        case let .recipe(recipe): LoggerPick(FoodPortion(recipe.snapshot))
        case let .favorite(favorite): LoggerPick(favorite.portion, alterations: favorite.alterations)
        }
    }
}

/// "Select Date and Time": a wheel of days and an hour, or a meal section in the Sections display. The minute comes from
/// the clock when a food is logged.
private struct LogTimePicker: View {
    let session: LoggerSession
    @Environment(\.dismiss) private var dismiss
    @State private var day: CalendarDay
    @State private var hour: Int
    @State private var section: MealSection
    private let today = CalendarDay.today

    init(session: LoggerSession) {
        self.session = session
        _day = State(initialValue: session.time.day)
        _hour = State(initialValue: session.time.hour)
        _section = State(initialValue: session.section)
    }

    /// The day and the hour, or in the Sections display the section.
    private var chosen: LogTime {
        session.showsSections ? session.time(of: section, on: day) : LogTime(day: day, hour: hour)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                HStack(spacing: 0) {
                    Picker("Day", selection: $day) {
                        ForEach(days, id: \.self) { Text(NutritionFormat.dayTitle($0, today: today)).tag($0) }
                    }
                    if session.showsSections {
                        Picker("Section", selection: $section) {
                            ForEach(session.sections) { Text($0.name).tag($0) }
                        }
                        .frame(width: 150)
                    } else {
                        Picker("Hour", selection: $hour) {
                            ForEach(0..<24, id: \.self) { Text(NutritionFormat.hour($0)).tag($0) }
                        }
                        .frame(width: 120)
                    }
                }
                .pickerStyle(.wheel)
                .frame(height: 170)
                Button {
                    session.time = chosen
                    dismiss()
                } label: {
                    Text("Select Date and Time")
                }
                .primaryPill()
            }
            .padding(.horizontal, Theme.margin)
            .detailTitle("Select Date and Time")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
            }
        }
        .presentationDetents([.height(320)])
        .presentationBackground(Theme.surface)
        .feedback(self)
    }

    private var days: [CalendarDay] {
        var days = (-30...7).map { today.adding(days: $0) }
        if !days.contains(session.time.day) { days.append(session.time.day) }
        return days.sorted()
    }
}

/// Time Pad: the 24 hours of the chosen day as buttons, without a date, or in the Sections display its sections.
private struct LogHourPad: View {
    let session: LoggerSession
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if session.showsSections {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 2), spacing: 8) {
                        ForEach(session.sections) { section in
                            pad(section.name, selected: section.id == session.section.id) {
                                session.time = session.time(of: section, on: session.time.day)
                            }
                        }
                    }
                } else {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 4), spacing: 8) {
                        ForEach(0..<24, id: \.self) { hour in
                            pad(NutritionFormat.hour(hour), selected: hour == session.time.hour) { session.time.hour = hour }
                        }
                    }
                }
            }
            .padding(.horizontal, Theme.margin)
            .detailTitle("Select Time")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
            }
        }
        .presentationDetents([.height(400)])
        .presentationBackground(Theme.surface)
        .feedback(self)
    }

    private func pad(_ title: String, selected: Bool, choose: @escaping () -> Void) -> some View {
        Button {
            choose()
            dismiss()
        } label: {
            Chip(title: title, isActive: selected)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}
