import HealthKitUI
import SwiftUI
import UIKit

enum AppTab: Hashable {
    case dashboard, nutrition, workout, pings, add
}

/// What "+" opens from the root: the New Workout sheet, or on Dashboard a choice between the halves over today's pings.
/// On Nutrition "+" opens the Food Log's scanner instead, and on Pings it turns the tab bar into the pings' drawer.
enum AddSheet: Identifiable {
    case food, workout, choose

    var id: Self { self }
}

/// The sheets the root presents: "+", and the screens a quick action opens.
private enum RootSheet: Hashable, Identifiable {
    case add(AddSheet)
    case logger(LoggerStart)
    case weight

    var id: Self { self }
}

struct RootView: View {
    @Environment(\.scenePhase) private var scenePhase
    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(LiveWorkoutPresenter.self) private var presenter
    @Environment(LocalStore.self) private var store
    @Observe(WorkoutSession.inProgressID) private var activeSessionID
    @Observe(AppSettings.summaryNutrients) private var summaryNutrients
    @Environment(HealthData.self) private var health
    @State private var tab = AppTab.dashboard
    @State private var dashboardPath = NavigationPath()
    @State private var sheet: RootSheet?
    /// Here rather than in the tab, so "+" can open the scanner on the day the Food Log shows. Its `day` is the app's
    /// one shown day: Nutrition, Workout, and Pings all read and write it, so the Food Log's rules for a day change (a
    /// bare selection ends, a pending copy or move follows) run whichever tab moved it.
    @State private var foodLog = FoodLogState()
    /// The day that was today when the app last came forward, so a return on a new day moves the shown day with it.
    @State private var today = CalendarDay.today
    @State private var addingPings = false
    @State private var inbox = QuickActionInbox.shared

    var body: some View {
        TabView(selection: $tab) {
            // The tab bar's selection keeps the accent, so each tab's content restores the app's white tint.
            Tab("Dashboard", systemImage: "square.grid.2x2", value: .dashboard) { DashboardTab(path: $dashboardPath).tint(Theme.textPrimary) }
            Tab("Nutrition", systemImage: "fork.knife", value: .nutrition) { FoodLogTab(state: foodLog).tint(Theme.textPrimary) }
            Tab("Workout", systemImage: "dumbbell", value: .workout) { WorkoutTab(day: $foodLog.day).tint(Theme.textPrimary) }
            Tab("Pings", systemImage: "hand.tap", value: .pings) { PingsTab(day: $foodLog.day, adding: $addingPings).tint(Theme.textPrimary) }
            Tab("New", systemImage: "plus", value: .add, role: .prominent) { Color.clear }
        }
        .tint(Theme.accent)
        .tabViewBottomAccessory(isEnabled: activeSessionID != nil) { ActiveSessionBar() }
        .resolvingWorkoutStart()
        .onChange(of: tab) { previous, current in
            // "+" acts like a button: it acts for the previous tab and keeps that tab selected.
            guard current == .add else { return }
            tab = previous
            switch previous {
            case .nutrition: foodLog.requestLog(start: .scan)
            case .workout: sheet = .add(.workout)
            case .dashboard, .add: sheet = .add(.choose)
            case .pings: addingPings = true
            }
        }
        .sheet(item: $sheet) { sheet in
            switch sheet {
            case .add(let add): AddSheetView(sheet: add)
            case .logger(let start): LoggerSheet(start: start)
            case .weight: BodyWeightLogSheet()
            }
        }
        // A session's insert and the observation that shows it land a moment apart, so the cover waits for both.
        .fullScreenCover(isPresented: Binding(get: { presenter.isExpanded && activeSessionID != nil }, set: { presenter.isExpanded = $0 })) {
            LiveWorkoutView()
        }
        .healthDataAccessRequest(store: health.store, shareTypes: AppPermissions.healthShare, readTypes: AppPermissions.healthRead, trigger: health.requestTrigger) { _ in
            Task {
                await health.load()
                await AppPermissions.requestRest()
            }
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            Task { await health.refresh() }
            Task { await GarminSync.shared.refreshIfStale() }
            if today != .today {
                if foodLog.day == today { foodLog.day = .today }
                today = .today
            }
        }
        .task {
            AppPermissions.launchStarted()
            Task { await GarminSync.shared.refreshIfStale() }
            if await !health.refresh() { await AppPermissions.requestRest() }
        }
        .task { await GymSeed.run(store, equipment: catalog.equipment) }
        .onOpenURL { url in
            if url == LiveActivityLink.liveWorkout { presenter.isExpanded = true }
            if let action = QuickAction(url: url) { inbox.pending = action }
        }
        .onChange(of: inbox.pending, initial: true) { _, action in
            guard let action else { return }
            inbox.pending = nil
            Task { await open(action) }
        }
        .environment(\.summaryNutrients, summaryNutrients)
    }

    private func open(_ action: QuickAction) async {
        // Tabs present their own sheets (the logger, the calendar, editors) from state the root can't reach, so the
        // root dismisses everything UIKit stacked above it.
        let root = UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow?.rootViewController }.first
        if presenter.isExpanded || sheet != nil || root?.presentedViewController != nil {
            presenter.isExpanded = false
            sheet = nil
            root?.dismiss(animated: true)
            // SwiftUI drops a presentation requested while another is still animating away.
            try? await Task.sleep(for: .milliseconds(500))
        }
        switch action {
        case .dashboard: tab = .dashboard
        case .steps:
            tab = .dashboard
            dashboardPath = NavigationPath([DashboardRoute.steps])
        case .foodLog:
            tab = .nutrition
            foodLog.day = .today
        case .weight: sheet = .weight
        case .newWorkout:
            tab = .workout
            sheet = .add(.workout)
        case .emptyWorkout: presenter.startOrResume({ .empty }, in: store)
        case .search, .barcode, .quickAdd, .ramble, .foods, .recipes, .favorites:
            // A widget logs now, so the Food Log under the logger shows today too.
            tab = .nutrition
            foodLog.day = .today
            sheet = action.logger.map(RootSheet.logger)
        }
    }
}

/// "+" from Dashboard asks which half to add to, then becomes that half's sheet in place: Log Food opens the scanner, as
/// "+" does on Nutrition. Today's pings list under the two, logged from here without leaving the Dashboard.
private struct AddSheetView: View {
    @State var sheet: AddSheet
    @Environment(\.dismiss) private var dismiss
    @Observe(Ping.count) private var pingCount

    var body: some View {
        switch sheet {
        case .food: LoggerSheet(start: LoggerStart(tab: .scan))
        case .workout: NewWorkoutSheet()
        case .choose:
            NavigationStack {
                PingLogger(onLogged: { dismiss() }) {
                    HStack(spacing: 12) {
                        choice("Log Food", systemImage: "fork.knife") { sheet = .food }
                        choice("Workout", systemImage: "dumbbell") { sheet = .workout }
                    }
                } empty: {
                    EmptyView()
                }
                .detailTitle("Add")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button(role: .close) { dismiss() }
                    }
                }
            }
            .presentationDetents(pingCount == 0 ? [.height(210)] : [.medium, .large])
            .feedback("Add")
        }
    }

    private func choice(_ title: String, systemImage: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: systemImage).font(.title2).frame(height: 28)
                Text(title).font(AppFont.headline(15))
            }
            .frame(maxWidth: .infinity, minHeight: 96)
        }
        .buttonStyle(.glass)
        .buttonBorderShape(.roundedRectangle(radius: Theme.cornerRadius))
    }
}
