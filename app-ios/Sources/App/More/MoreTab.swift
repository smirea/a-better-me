import Feedback
import SwiftUI

struct MoreTab: View {
    @Environment(LocalStore.self) private var store

    var body: some View {
        NavigationStack {
            Form {
                if let rows = store.snapshotRows {
                    ThemedSection {
                        RowLabel(title: "Downloading… \(rows) rows", systemImage: "arrow.down.circle")
                    }
                }
                ThemedSection("Progress") {
                    row(.levels)
                    row(.strategy)
                    row(.workoutHistory)
                }
                ThemedSection("General") {
                    row(.units)
                    row(.profile)
                    row(.dashboard)
                }
                ThemedSection("Workouts") {
                    row(.workout)
                    row(.exercises)
                    row(.gymProfiles)
                }
                ThemedSection("Nutrition") {
                    row(.foodLog)
                    row(.expenditure)
                    row(.strategySettings)
                    row(.foodsRecipes)
                }
                ThemedSection("Integrations") {
                    row(.appleHealth)
                }
                ThemedSection("Data") {
                    row(.dataVisibility)
                    AssetsRow()
                }
                ThemedSection("Automation") {
                    row(.apiTokens)
                }
            }
            .themedList()
            .screenTitle("More")
            .navigationDestination(for: MoreRoute.self) { $0.destination }
            .navigationDestination(for: Muscle.self) { MuscleLevelsView(muscle: $0) }
            .navigationDestination(for: StrategyRoute.self) { $0.destination }
        }
        .feedback(self)
    }

    private func row(_ route: MoreRoute) -> some View {
        NavigationLink(value: route) { RowLabel(title: route.title, systemImage: route.systemImage) }
    }
}

/// More's screens are path values registered at its root, with the destinations Levels and Strategy push. A
/// value link inside a screen pushed with a view destination never fired, so nothing here pushes by view.
private enum MoreRoute: Hashable {
    case levels, strategy, workoutHistory, units, profile, dashboard, workout, exercises, gymProfiles, foodLog, expenditure, strategySettings, foodsRecipes, appleHealth, dataVisibility, apiTokens

    var title: String {
        switch self {
        case .levels: "Levels"
        case .strategy: "Strategy"
        case .workoutHistory: "Workout History"
        case .units: "Units"
        case .profile: "Profile"
        case .dashboard: "Dashboard"
        case .workout: "Workout"
        case .exercises: "Exercises"
        case .gymProfiles: "Gym Profiles"
        case .foodLog: "Food Log"
        case .expenditure: "Expenditure"
        case .strategySettings: "Strategy Settings"
        case .foodsRecipes: "Foods & Recipes"
        case .appleHealth: "Apple Health"
        case .dataVisibility: "Data Visibility"
        case .apiTokens: "API Tokens"
        }
    }

    var systemImage: String {
        switch self {
        case .levels: "trophy"
        case .strategy: "chart.line.uptrend.xyaxis"
        case .workoutHistory: "list.bullet.rectangle"
        case .units: "ruler"
        case .profile: "person.crop.circle"
        case .dashboard: "square.grid.2x2"
        case .workout: "dumbbell"
        case .exercises: "figure.strengthtraining.traditional"
        case .gymProfiles: "building.2"
        case .foodLog: "fork.knife"
        case .expenditure: "bolt.fill"
        case .strategySettings: "circle.hexagongrid"
        case .foodsRecipes: "carrot"
        case .appleHealth: "heart.fill"
        case .dataVisibility: "eye"
        case .apiTokens: "key"
        }
    }

    @ViewBuilder
    var destination: some View {
        switch self {
        case .levels: LevelsView()
        case .strategy: StrategyView()
        case .workoutHistory: WorkoutHistoryView()
        case .units: UnitsSettingsView()
        case .profile: ProfileSettingsView()
        case .dashboard: CustomizeDashboardView()
        case .workout: WorkoutSettingsView()
        case .exercises: ExerciseLibraryView()
        case .gymProfiles: GymProfilesView()
        case .foodLog: FoodLogSettingsView()
        case .expenditure: ExpenditureSettingsView()
        case .strategySettings: StrategySettingsView()
        case .foodsRecipes: FoodLibraryView()
        case .appleHealth: HealthSettingsView()
        case .dataVisibility: DataVisibilityView()
        case .apiTokens: ApiTokensView()
        }
    }
}

private struct AssetsRow: View {
    var body: some View {
        let store = AssetStore.shared
        Button { store.refresh() } label: {
            VStack(alignment: .leading, spacing: 8) {
                RowLabel(title: store.statusLine, systemImage: "icloud.and.arrow.down")
                if store.phase == .downloading, let progress = store.progress {
                    ProgressView(value: progress.fraction).progressViewStyle(.bar(Theme.textPrimary))
                }
            }
        }
        .accessibilityLabel(store.statusLine)
        .accessibilityHint("Checks for missing exercise images and downloads them now, on cellular too")
        .feedback(self)
    }
}
