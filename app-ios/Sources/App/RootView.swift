import SwiftUI

enum AppTab: Hashable {
    case dashboard, workout, add, levels, more
}

struct RootView: View {
    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(LiveWorkoutPresenter.self) private var presenter
    @Environment(LocalStore.self) private var store
    @Observe(CustomExercise.all) private var customExercises
    @Observe(WorkoutSession.inProgress) private var activeSession
    @State private var tab = AppTab.workout
    @State private var showingNewWorkout = false

    var body: some View {
        TabView(selection: $tab) {
            // The tab bar's selection keeps the accent, so each tab's content restores the app's white tint.
            Tab("Dashboard", systemImage: "square.grid.2x2", value: .dashboard) { DashboardTab().tint(Theme.textPrimary) }
            Tab("Workout", systemImage: "dumbbell", value: .workout) { WorkoutTab().tint(Theme.textPrimary) }
            Tab("New", systemImage: "plus", value: .add, role: .prominent) { Color.clear }
            Tab("Levels", systemImage: "trophy", value: .levels) { LevelsTab().tint(Theme.textPrimary) }
            Tab("More", systemImage: "ellipsis.circle", value: .more) { MoreTab().tint(Theme.textPrimary) }
        }
        .tint(Theme.accent)
        .tabViewBottomAccessory(isEnabled: activeSession != nil) { ActiveSessionBar() }
        .resolvingWorkoutStart()
        .onChange(of: tab) { previous, current in
            // "+" acts as a button, like the reference app's center tab: it presents a sheet and keeps the tab.
            guard current == .add else { return }
            tab = previous
            showingNewWorkout = true
        }
        .sheet(isPresented: $showingNewWorkout) { NewWorkoutSheet() }
        // A session's insert and the observation that shows it land a moment apart, so the cover waits for both.
        .fullScreenCover(isPresented: Binding(get: { presenter.isExpanded && activeSession != nil }, set: { presenter.isExpanded = $0 })) {
            if let activeSession { LiveWorkoutView(session: activeSession).id(activeSession.id) }
        }
        .onChange(of: customExercises.map(\.exercise), initial: true) { _, exercises in
            catalog.setCustom(exercises)
        }
        .task { await GymSeed.run(store, equipment: catalog.equipment) }
    }
}
