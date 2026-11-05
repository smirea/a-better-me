import Feedback
import SwiftUI

enum LoggerRoute: Hashable {
    case food(LoggerPick)
    case plateItem(UUID)
    case plate
    /// The row as it was when its detail opened, so an edit never lands on a food a later read put in its place.
    case rambleRow(RambleRow)
}

/// MacroFactor's logger (research spec §5): one full-height sheet with the banner (exit, time chip, what the plate
/// leaves of the day, the plate) over the Scan, Photo, Search, Quick Add, and Library tabs. Describe is not built
/// (docs/decisions/nutrition.md). Logging the plate closes it.
struct LoggerSheet: View {
    let start: LoggerStart
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var session: LoggerSession?
    @State private var failure: String?

    var body: some View {
        Group {
            if let session {
                LoggerContent(session: session, close: { dismiss() })
                    .environment(\.ingredientPicker, .search)
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
            do {
                session = LoggerSession(store: store, search: try await FoodSearch.load(store: store), start: start)
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
        let rambling = session.tab == .ramble && path.allSatisfy { if case .rambleRow = $0 { true } else { false } }
        VStack(spacing: 0) {
            if !rambling {
                LoggerBanner(session: session, exit: exit, chooseTime: { choosingTime = true }, openPlate: openPlate)
                    .id(session.time.day)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
            // Above the stack, so the Library's own navigation bar (title, sort, create, filter) sits under the tabs;
            // a pushed detail or the plate covers them, as in MacroFactor.
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
                    .navigationDestination(for: LoggerRoute.self) { route in
                    switch route {
                    case let .food(pick): FoodDetailView(session: session, editing: nil, pick: pick)
                    case let .plateItem(id):
                        if let item = session.plate.item(id) { FoodDetailView(session: session, editing: id, pick: item.pick) }
                    case .plate: PlateView(session: session, open: { path.append(.plateItem($0)) }).id(session.time.day)
                    case let .rambleRow(row):
                        if case let .food(food) = row.content {
                            FoodDetailView(session: session, editing: nil, pick: food.pick, ramble: RambleEdit(
                                update: { session.ramble.setServing($0, of: row) },
                                day: row.day,
                                others: session.ramble.rows
                                    .filter { $0.id != row.id && $0.day == row.day }
                                    .flatMap(\.planned)
                                    .reduce(into: NutrientAmounts()) { $0 = $0 + $1.pick.portion.amounts }
                            ))
                        }
                    }
                }
            }
        }
        .onChange(of: session.logged) { close() }
        .onDisappear { session.ramble.cancel() }
        .alert("Exit the Plate?", isPresented: $confirmingExit) {
            Button("Exit", role: .destructive, action: close)
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(session.plate.isEmpty ? "The foods from your ramble will be cleared." : "Foods you added to your plate will be cleared.")
        }
        .sheet(isPresented: $choosingTime) {
            switch settings.nutrition.logger.timeSelection {
            case .datePicker: LogTimePicker(session: session)
            case .timePad: LogHourPad(session: session)
            }
        }
    }

    @ViewBuilder private var tab: some View {
        let detail: (LoggerPick) -> Void = { path.append(.food($0)) }
        let open = settings.nutrition.logger.optimization == .context ? addAndShowPlate : detail
        switch session.tab {
        case .scan: ScanTab(session: session, open: detail).toolbar(.hidden, for: .navigationBar)
        case .photo: PhotoTab(session: session, showPlate: openPlate).toolbar(.hidden, for: .navigationBar)
        case .ramble:
            RambleTab(
                session: session, open: { path.append(.rambleRow($0)) }, close: exit,
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
            FoodLibraryView(tab: session.library, onOpen: { open(LoggerPick($0.portion)) }, onAdd: { session.add(LoggerPick($0)) })
                .safeAreaInset(edge: .bottom) {
                    HStack {
                        Spacer()
                        LogFoodsButton(session: session).controlSize(.large)
                    }
                    .padding(.horizontal, Theme.margin)
                    .padding(.bottom, 8)
                }
        }
    }

    private func exit() {
        if session.hasUnlogged { confirmingExit = true } else { close() }
    }

    /// Optimize for context: a tapped result goes on the plate, and the plate shows.
    private func addAndShowPlate(_ pick: LoggerPick) {
        session.add(pick)
        openPlate()
    }

    private func openPlate() {
        if path.last != .plate { path.append(.plate) }
    }
}

/// The logger's top band: exit, the time chip, and the plate over the day's calories and macros with the plate counted
/// in, drawn as the Food Log's summary is. Swiping the totals steps through Nutrition Display, as swiping
/// MacroFactor's banner does.
private struct LoggerBanner: View {
    let session: LoggerSession
    let exit: () -> Void
    let chooseTime: () -> Void
    let openPlate: () -> Void
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings
    @Observe(NutritionPlan.all) private var plans
    @Observe<[FoodEntry]> private var entries: [FoodEntry]
    @Observe<NutritionDay> private var dayRow: NutritionDay

    init(session: LoggerSession, exit: @escaping () -> Void, chooseTime: @escaping () -> Void, openPlate: @escaping () -> Void) {
        self.session = session
        self.exit = exit
        self.chooseTime = chooseTime
        self.openPlate = openPlate
        _entries = Observe(FoodEntry.on(session.time.day))
        _dayRow = Observe(NutritionDay.one(session.time.day))
    }

    var body: some View {
        let display = settings.nutrition.logger.nutritionDisplay
        let day = session.time.day
        let lines = FoodLog.summary(
            dayRow.totals(entries), plate: session.plateWithPending,
            target: NutritionPlan.effective(on: day, in: plans)?.target(on: day), showOverages: settings.nutrition.showOverages
        )
        VStack(spacing: 10) {
            GlassEffectContainer {
                HStack(spacing: 10) {
                    RoundIconButton("Close", systemImage: "xmark", action: exit)
                    Button(action: chooseTime) {
                        Text(session.time.label()).font(AppFont.headline(14))
                    }
                    .chipButton()
                    .accessibilityLabel("Log time, \(session.time.label())")
                    Spacer(minLength: 0)
                    plateButton
                }
            }
            MacroTotalsBars(lines: lines, page: display.page)
                .gesture(DragGesture(minimumDistance: 20).onEnded { drag in
                    guard abs(drag.translation.width) > 30, abs(drag.translation.width) > abs(drag.translation.height) else { return }
                    store.updateSettings { $0.nutrition.logger.nutritionDisplay = display.cycled(by: drag.translation.width < 0 ? 1 : -1) }
                })
                .sensoryFeedback(.selection, trigger: display)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(lines.map(\.spoken).joined(separator: ", "))
                .accessibilityAdjustableAction { direction in
                    store.updateSettings { $0.nutrition.logger.nutritionDisplay = display.cycled(by: direction == .increment ? 1 : -1) }
                }
        }
        .padding(.horizontal, Theme.margin)
        .padding(.top, 14)
        .padding(.bottom, 6)
        .animation(.snappy, value: session.plate.items.count)
        .feedback(self)
    }

    /// White once the plate holds a food, so the way to review and log it stands out.
    @ViewBuilder private var plateButton: some View {
        let button = Button(action: openPlate) {
            HStack(spacing: 6) {
                Image(systemName: "fork.knife")
                if !session.plate.isEmpty {
                    Text("\(session.plate.items.count)").font(AppFont.headline(15)).contentTransition(.numericText())
                }
            }
        }
        .accessibilityLabel("Your Plate, \(session.plate.items.count) foods")
        if session.plate.isEmpty {
            button.chipButton()
        } else {
            button.prominentButton().buttonBorderShape(.capsule)
        }
    }
}

extension NutritionSettings.Logger.NutritionDisplay {
    var page: MacroLine.Page {
        switch self {
        case .plateOnly: .plate
        case .dayAndPlate: .eaten
        case .remainingAfterPlate: .remaining
        }
    }
}

extension LoggerSession {
    /// The plate as the banner counts it: with the food detail's amount or the Quick Add being typed.
    var plateWithPending: NutrientAmounts {
        pending.map { plate.totals + $0.amounts } ?? plate.totals
    }
}

extension FoodLibraryView.Item {
    /// A food or recipe at its default serving, a favorite at its saved one.
    var portion: FoodPortion {
        switch self {
        case let .food(food): FoodPortion(food.snapshot)
        case let .recipe(recipe): FoodPortion(recipe.snapshot)
        case let .favorite(favorite): favorite.portion
        }
    }
}

/// "Select Date and Time": a wheel of days and an hour. The minute comes from the clock when the plate is logged.
private struct LogTimePicker: View {
    let session: LoggerSession
    @Environment(\.dismiss) private var dismiss
    @State private var day: CalendarDay
    @State private var hour: Int
    private let today = CalendarDay.today

    init(session: LoggerSession) {
        self.session = session
        _day = State(initialValue: session.time.day)
        _hour = State(initialValue: session.time.hour)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                HStack(spacing: 0) {
                    Picker("Day", selection: $day) {
                        ForEach(days, id: \.self) { Text(NutritionFormat.dayTitle($0, today: today)).tag($0) }
                    }
                    Picker("Hour", selection: $hour) {
                        ForEach(0..<24, id: \.self) { Text(NutritionFormat.hour($0)).tag($0) }
                    }
                    .frame(width: 120)
                }
                .pickerStyle(.wheel)
                .frame(height: 170)
                Button {
                    session.time = LogTime(day: day, hour: hour)
                    dismiss()
                } label: {
                    Text("Select Date and Time")
                }
                .secondaryPill()
                Button {
                    session.time = LogTime(day: day, hour: hour)
                    session.logPlate()
                } label: {
                    Text("Log to Date and Time")
                }
                .primaryPill()
                .disabled(session.plate.isEmpty)
            }
            .padding(.horizontal, Theme.margin)
            .detailTitle("Select Date and Time")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
            }
        }
        .presentationDetents([.height(380)])
        .presentationBackground(Theme.surface)
        .feedback(self)
    }

    /// A month back through a week ahead, plus the chosen day when it lies outside them.
    private var days: [CalendarDay] {
        var days = (-30...7).map { today.adding(days: $0) }
        if !days.contains(session.time.day) { days.append(session.time.day) }
        return days.sorted()
    }
}

/// Time Pad: the 24 hours of the chosen day as buttons, without a date.
private struct LogHourPad: View {
    let session: LoggerSession
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 4), spacing: 8) {
                ForEach(0..<24, id: \.self) { hour in
                    let selected = hour == session.time.hour
                    Button {
                        session.time.hour = hour
                        dismiss()
                    } label: {
                        Chip(title: NutritionFormat.hour(hour), isActive: selected)
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(selected ? .isSelected : [])
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
}
