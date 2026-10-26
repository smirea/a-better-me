import SwiftUI

enum LoggerRoute: Hashable {
    case food(LoggerPick)
    case plateItem(UUID)
    case plate
}

/// MacroFactor's logger (research spec §5): one full-height sheet with the banner (exit, time chip, what the plate
/// leaves of the day, the plate) over the Scan, Search, Quick Add, and Library tabs. Describe and AI are not built
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
            } else if let failure {
                ContentUnavailableView("Food search is unavailable", systemImage: "exclamationmark.triangle", description: Text(failure))
            } else {
                Color.clear
            }
        }
        .background(Theme.background)
        .presentationDetents([.large])
        .interactiveDismissDisabled(session?.plate.isEmpty == false)
        .task {
            guard session == nil else { return }
            do {
                session = LoggerSession(store: store, search: try FoodSearch(store: store), start: start)
            } catch {
                failure = String(describing: error)
            }
        }
    }
}

private struct LoggerContent: View {
    @Bindable var session: LoggerSession
    let close: () -> Void
    @State private var path: [LoggerRoute] = []
    @State private var confirmingExit = false
    @State private var choosingTime = false

    var body: some View {
        VStack(spacing: 0) {
            LoggerBanner(session: session, exit: exit, chooseTime: { choosingTime = true }, openPlate: openPlate)
                .id(session.time.day)
            NavigationStack(path: $path) {
                VStack(spacing: 0) {
                    Picker("Logger tab", selection: $session.tab) {
                        ForEach(LoggerTab.allCases, id: \.self) { tab in
                            Text(tab.title).tag(tab)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 8)
                    tab
                        .frame(maxHeight: .infinity)
                }
                .background(Theme.background)
                .toolbar(.hidden, for: .navigationBar)
                .navigationDestination(for: LoggerRoute.self) { route in
                    switch route {
                    case let .food(pick): FoodDetailView(session: session, editing: nil, pick: pick)
                    case let .plateItem(id):
                        if let item = session.plate.item(id) { FoodDetailView(session: session, editing: id, pick: item.pick) }
                    case .plate: PlateView(session: session, open: { path.append(.plateItem($0)) })
                    }
                }
            }
        }
        .onChange(of: session.logged) { close() }
        .confirmationDialog("Exit the Plate?", isPresented: $confirmingExit, titleVisibility: .visible) {
            Button("Exit", role: .destructive, action: close)
            Button("Stay", role: .cancel) {}
        } message: {
            Text("Foods you added to your plate will be cleared.")
        }
        .sheet(isPresented: $choosingTime) {
            LogTimePicker(session: session)
        }
    }

    @ViewBuilder private var tab: some View {
        let open: (LoggerPick) -> Void = { path.append(.food($0)) }
        switch session.tab {
        case .scan: ScanTab(session: session, open: open)
        case .search: SearchTab(session: session, open: open)
        case .quickAdd: QuickAddTab(session: session)
        case .library: LibraryTab(session: session, open: open)
        }
    }

    private func exit() {
        if session.plate.isEmpty { close() } else { confirmingExit = true }
    }

    private func openPlate() {
        if path.last != .plate { path.append(.plate) }
    }
}

/// The logger's top band: exit, the time chip, each banner nutrient as what the plate leaves of the day's target, and
/// the plate.
private struct LoggerBanner: View {
    let session: LoggerSession
    let exit: () -> Void
    let chooseTime: () -> Void
    let openPlate: () -> Void
    @Observe(AppSettings.current) private var settings
    @Observe(NutritionPlan.all) private var plans
    @Observe<[FoodEntry]> private var entries: [FoodEntry]

    init(session: LoggerSession, exit: @escaping () -> Void, chooseTime: @escaping () -> Void, openPlate: @escaping () -> Void) {
        self.session = session
        self.exit = exit
        self.chooseTime = chooseTime
        self.openPlate = openPlate
        _entries = Observe(FoodEntry.on(session.time.day))
    }

    var body: some View {
        let options = settings.nutrition.logger
        GlassEffectContainer {
            HStack(spacing: 10) {
                Button("Close", systemImage: "xmark", action: exit)
                    .labelStyle(.iconOnly)
                    .frame(width: 44, height: 44)
                    .glassEffect(.regular.interactive(), in: .circle)
                Button(action: chooseTime) {
                    Text(session.time.label())
                        .font(AppFont.headline(14))
                        .padding(.horizontal, 14)
                        .frame(height: 44)
                }
                .glassEffect(.regular.interactive(), in: .capsule)
                .accessibilityLabel("Log time, \(session.time.label())")
                VStack(alignment: .leading, spacing: 5) {
                    ForEach(options.bannerNutrients, id: \.self) { id in
                        bar(id, value(id), display: options.bannerDisplay)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Button(action: openPlate) {
                    HStack(spacing: 6) {
                        Image(systemName: "fork.knife")
                        if !session.plate.isEmpty {
                            Text("\(session.plate.items.count)").font(AppFont.headline(15)).contentTransition(.numericText())
                        }
                    }
                    .padding(.horizontal, 14)
                    .frame(height: 44)
                }
                .glassEffect(session.plate.isEmpty ? .regular.interactive() : .regular.tint(Theme.accent.opacity(0.5)).interactive(), in: .capsule)
                .accessibilityLabel("Your Plate, \(session.plate.items.count) foods")
            }
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, 6)
        .animation(.snappy, value: session.plate.items.count)
    }

    private func value(_ id: NutrientID) -> BannerValue {
        var plate = session.plate.totals
        if let pending = session.pending { plate = plate + pending.amounts }
        let day = entries.reduce(0) { $0 + ($1.amounts[id] ?? 0) }
        let target = NutritionPlan.effective(on: session.time.day, in: plans)?.target(on: session.time.day).amount(id)
        return BannerValue(day: day, plate: plate[id] ?? 0, target: target)
    }

    private func bar(_ id: NutrientID, _ value: BannerValue, display: LoggerBannerDisplay) -> some View {
        let amount = Int(value.amount(display, showOverages: settings.nutrition.showOverages).rounded())
        let prefix = id == .energy ? "" : "\(id.macroLetter) "
        let suffix = switch display {
        case .plateOnly: " in plate"
        case .dayAndPlate: value.target.map { " / \(Int($0.rounded()))" } ?? ""
        case .remainingAfterPlate: value.target == nil ? "" : " left"
        }
        return VStack(alignment: .leading, spacing: 2) {
            Text("\(prefix)\(amount)\(suffix)").font(AppFont.caption(11)).monospacedDigit()
            Capsule()
                .fill(Theme.surfaceRaised)
                .frame(height: 3)
                .overlay(alignment: .leading) {
                    GeometryReader { proxy in
                        Capsule().fill(MacroColor.of(id)).frame(width: proxy.size.width * (value.progress ?? 0))
                    }
                }
        }
        .frame(maxWidth: 110, alignment: .leading)
    }
}

extension DayTarget {
    func amount(_ id: NutrientID) -> Double? {
        switch id {
        case .energy: energy
        case .protein: protein
        case .fat: fat
        case .carbs: carbs
        default: nil
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
                        ForEach(days, id: \.self) { Text($0.relativeLabel(today: today)).tag($0) }
                    }
                    Picker("Hour", selection: $hour) {
                        ForEach(0..<24, id: \.self) { Text(LogTime.hourLabel($0)).tag($0) }
                    }
                    .frame(width: 120)
                }
                .pickerStyle(.wheel)
                .frame(height: 170)
                Button {
                    session.time = LogTime(day: day, hour: hour)
                    dismiss()
                } label: {
                    Text("Select Date and Time").frame(maxWidth: .infinity)
                }
                .buttonStyle(.glass)
                .controlSize(.large)
                Button {
                    session.time = LogTime(day: day, hour: hour)
                    session.logPlate()
                } label: {
                    Text("Log to Date and Time").frame(maxWidth: .infinity)
                }
                .buttonStyle(.glassProminent)
                .controlSize(.large)
                .disabled(session.plate.isEmpty)
            }
            .font(AppFont.headline(16))
            .padding(.horizontal, 20)
            .navigationTitle("Select Date and Time")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", systemImage: "xmark") { dismiss() }
                }
            }
        }
        .presentationDetents([.height(380)])
        .presentationBackground(Theme.surface)
    }

    /// A month back through a week ahead, plus the chosen day when it lies outside them.
    private var days: [CalendarDay] {
        var days = (-30...7).map { today.adding(days: $0) }
        if !days.contains(session.time.day) { days.append(session.time.day) }
        return days.sorted()
    }
}
