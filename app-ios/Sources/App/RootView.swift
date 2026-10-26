import SwiftUI

/// The tab bar's slots. Slots 3 and 5 show the current mode's tab, so flipping the mode keeps the selection.
enum AppTab: Hashable {
    case switchMode, dashboard, log, add, progress
}

struct RootView: View {
    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(LiveWorkoutPresenter.self) private var presenter
    @Environment(LocalStore.self) private var store
    @Observe(CustomExercise.all) private var customExercises
    @Observe(WorkoutSession.inProgressID) private var activeSessionID
    @AppStorage("appMode") private var mode = AppMode.workouts
    @State private var tab = AppTab.log
    @State private var showingNew = false

    var body: some View {
        TabView(selection: $tab) {
            Tab(mode.other.title, systemImage: mode.other.systemImage, value: .switchMode) { Color.clear }
                .accessibilityLabel("Switch to \(mode.other.title)")
            // The tab bar's selection keeps the accent, so each tab's content restores the app's white tint.
            Tab("Dashboard", systemImage: "square.grid.2x2", value: .dashboard) { DashboardTab().tint(Theme.textPrimary) }
            switch mode {
            case .workouts:
                Tab("Workout", systemImage: "dumbbell", value: .log) { WorkoutTab().tint(Theme.textPrimary) }
            case .nutrition:
                Tab("Food Log", systemImage: "fork.knife", value: .log) { FoodLogTab().tint(Theme.textPrimary) }
            }
            Tab("New", systemImage: "plus", value: .add, role: .prominent) { Color.clear }
            switch mode {
            case .workouts:
                Tab("Levels", systemImage: "trophy", value: .progress) { LevelsTab().tint(Theme.textPrimary) }
            case .nutrition:
                Tab("Strategy", systemImage: "chart.line.uptrend.xyaxis", value: .progress) { ComingSoon(title: "Strategy").tint(Theme.textPrimary) }
            }
        }
        .tint(Theme.accent)
        .tabViewBottomAccessory(isEnabled: activeSessionID != nil) { ActiveSessionBar() }
        .resolvingWorkoutStart()
        .onChange(of: tab) { previous, current in
            // Slot 1 and "+" act as buttons, like the reference app's center tab: they act and keep the selected tab.
            switch current {
            case .switchMode: mode = mode.other
            case .add: showingNew = true
            default: return
            }
            tab = previous
        }
        .sheet(isPresented: $showingNew) {
            switch mode {
            case .workouts: NewWorkoutSheet()
            case .nutrition: ComingSoon(title: "Log Food").presentationDetents([.medium])
            }
        }
        // A session's insert and the observation that shows it land a moment apart, so the cover waits for both.
        .fullScreenCover(isPresented: Binding(get: { presenter.isExpanded && activeSessionID != nil }, set: { presenter.isExpanded = $0 })) {
            LiveWorkoutView()
        }
        .onChange(of: customExercises.map(\.exercise), initial: true) { _, exercises in
            catalog.setCustom(exercises)
        }
        .task { await GymSeed.run(store, equipment: catalog.equipment) }
        .onOpenURL { url in
            if url == LiveActivityLink.liveWorkout { presenter.isExpanded = true }
        }
    }
}
