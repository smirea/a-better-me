import SwiftData
import SwiftUI

enum AppTab: Hashable {
    case dashboard, workout, add, levels, more
}

struct RootView: View {
    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(LiveWorkoutPresenter.self) private var presenter
    @Query private var customExercises: [CustomExercise]
    @Query(filter: #Predicate<WorkoutSession> { $0.endedAt == nil }) private var activeSessions: [WorkoutSession]
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
        .tabViewBottomAccessory(isEnabled: !activeSessions.isEmpty) { ActiveSessionBar() }
        .resolvingWorkoutStart()
        .onChange(of: tab) { previous, current in
            // "+" acts as a button, like the reference app's center tab: it presents a sheet and keeps the tab.
            guard current == .add else { return }
            tab = previous
            showingNewWorkout = true
        }
        .sheet(isPresented: $showingNewWorkout) { NewWorkoutSheet() }
        .fullScreenCover(isPresented: Bindable(presenter).isExpanded) {
            if let session = activeSessions.first { LiveWorkoutView(session: session) }
        }
        .onChange(of: customExercises.map(\.exercise), initial: true) { _, exercises in
            catalog.setCustom(exercises)
        }
    }
}
