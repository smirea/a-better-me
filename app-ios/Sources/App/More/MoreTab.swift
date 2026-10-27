import SwiftUI

/// The catch-all tab: Levels, Strategy, the workout history, and the one settings tree for both halves.
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
                    row(.levels, "Levels", "trophy")
                    row(.strategy, "Strategy", "chart.line.uptrend.xyaxis")
                    row(.workoutHistory, "Workout History", "list.bullet.rectangle")
                }
                ThemedSection("General") {
                    row(.units, "Units", "ruler")
                    row(.profile, "Profile", "person.crop.circle")
                    row(.dashboard, "Dashboard", "square.grid.2x2")
                }
                ThemedSection("Workouts") {
                    row(.workout, "Workout", "dumbbell")
                    row(.exercises, "Exercises", "figure.strengthtraining.traditional")
                    row(.gymProfiles, "Gym Profiles", "building.2")
                }
                ThemedSection("Nutrition") {
                    row(.foodLog, "Food Log", "fork.knife")
                    row(.expenditure, "Expenditure", "bolt.fill")
                    row(.strategySettings, "Strategy Settings", "circle.hexagongrid")
                    row(.foodsRecipes, "Foods & Recipes", "carrot")
                }
                ThemedSection("Integrations") {
                    row(.appleHealth, "Apple Health", "heart.fill")
                }
                ThemedSection("Data") {
                    row(.dataVisibility, "Data Visibility", "eye")
                    AssetsRow()
                }
                ThemedSection("Automation") {
                    row(.apiTokens, "API Tokens", "key")
                }
            }
            .themedList()
            .screenTitle("More")
            .navigationDestination(for: MoreRoute.self) { $0.destination }
            .navigationDestination(for: Muscle.self) { MuscleLevelsView(muscle: $0) }
            .navigationDestination(for: StrategyRoute.self) { $0.destination }
        }
    }

    private func row(_ route: MoreRoute, _ title: String, _ systemImage: String) -> some View {
        NavigationLink(value: route) { RowLabel(title: title, systemImage: systemImage) }
    }
}

/// More's screens are path values registered at its root, with the destinations Levels and Strategy push. A
/// value link inside a screen pushed with a view destination never fired, so nothing here pushes by view.
private enum MoreRoute: Hashable {
    case levels, strategy, workoutHistory, units, profile, dashboard, workout, exercises, gymProfiles, foodLog, expenditure, strategySettings, foodsRecipes, appleHealth, dataVisibility, apiTokens

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

/// Shows a progress bar only while downloading, so a finished download leaves just its size.
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
    }
}
