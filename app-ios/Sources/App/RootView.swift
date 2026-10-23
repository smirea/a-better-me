import SwiftUI

enum AppTab: Hashable {
    case dashboard, workout, add, levels, more
}

struct RootView: View {
    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(LiveWorkoutPresenter.self) private var presenter
    @Observe(CustomExercise.all) private var customExercises
    @Observe(WorkoutSession.inProgress) private var activeSession
    @State private var tab = AppTab.workout
    @State private var showingNewWorkout = false

    var body: some View {
        TabView(selection: $tab) {
            Tab("Dashboard", systemImage: "square.grid.2x2", value: .dashboard) { DashboardTab() }
            Tab("Workout", systemImage: "dumbbell", value: .workout) { WorkoutTab() }
            Tab("New", systemImage: "plus", value: .add, role: .prominent) { Color.clear }
            Tab("Levels", systemImage: "trophy", value: .levels) { LevelsTab() }
            Tab("More", systemImage: "ellipsis.circle", value: .more) { MoreTab() }
        }
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
            if let activeSession { LiveWorkoutView(session: activeSession) }
        }
        .onChange(of: customExercises.map(\.exercise), initial: true) { _, exercises in
            catalog.setCustom(exercises)
        }
    }
}
