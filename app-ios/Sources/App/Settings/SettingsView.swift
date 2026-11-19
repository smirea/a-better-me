import Feedback
import SwiftUI

/// Every setting and the screens that have no tab, in one list the Dashboard's gear pushes.
struct SettingsView: View {
    @Environment(LocalStore.self) private var store

    var body: some View {
        Form {
            if let rows = store.snapshotRows {
                ThemedSection {
                    RowLabel(title: "Downloading… \(rows) rows", systemImage: "arrow.down.circle")
                }
            }
            ThemedSection("General") {
                row(.units)
                row(.profile)
                row(.dashboard)
                row(.pings)
                row(.appleHealth)
                row(.changelog)
            }
            ThemedSection("Nutrition") {
                row(.strategy)
                row(.foodLog)
                row(.expenditure)
                row(.foodsRecipes)
                row(.supplements)
            }
            ThemedSection("Workouts") {
                row(.levels)
                row(.workoutHistory)
                row(.workout)
                row(.exercises)
                row(.gymProfiles)
            }
            ThemedSection("Development") {
                row(.dataVisibility)
                AssetsRow()
                row(.apiTokens)
            }
        }
        .themedList()
        .detailTitle("Settings")
        .feedback(self)
    }

    private func row(_ route: SettingsRoute) -> some View {
        NavigationLink(value: route) { RowLabel(title: route.title, systemImage: route.systemImage) }
    }
}

extension View {
    /// Registers the screens Settings pushes, and the ones Levels, Strategy, and Supplements push from there, at the
    /// root of the stack that shows Settings. A value link inside a screen pushed with a view destination never fired,
    /// so nothing here pushes by view.
    func settingsDestinations() -> some View {
        navigationDestination(for: SettingsRoute.self) { $0.destination }
            .navigationDestination(for: Muscle.self) { MuscleLevelsView(muscle: $0) }
            .navigationDestination(for: StrategyRoute.self) { $0.destination }
            .navigationDestination(for: SupplementRoute.self) { $0.destination }
    }
}

enum SettingsRoute: Hashable {
    case levels, strategy, workoutHistory, units, profile, dashboard, pings, workout, exercises, gymProfiles, foodLog, expenditure, foodsRecipes, supplements, appleHealth, changelog, dataVisibility, apiTokens

    var title: String {
        switch self {
        case .levels: "Levels"
        case .strategy: "Strategy"
        case .workoutHistory: "Workout History"
        case .units: "Units"
        case .profile: "Profile"
        case .dashboard: "Dashboard"
        case .pings: "Pings"
        case .workout: "Workout"
        case .exercises: "Exercises"
        case .gymProfiles: "Gym Profiles"
        case .foodLog: "Food Log"
        case .expenditure: "Expenditure"
        case .foodsRecipes: "Foods & Recipes"
        case .supplements: "Supplements"
        case .appleHealth: "Apple Health"
        case .changelog: "Changelog"
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
        case .pings: "hand.tap"
        case .workout: "dumbbell"
        case .exercises: "figure.strengthtraining.traditional"
        case .gymProfiles: "building.2"
        case .foodLog: "fork.knife"
        case .expenditure: "bolt.fill"
        case .foodsRecipes: "carrot"
        case .supplements: "pills"
        case .appleHealth: "heart.fill"
        case .changelog: "clock.arrow.circlepath"
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
        case .pings: ManagePingsView()
        case .workout: WorkoutSettingsView()
        case .exercises: ExerciseLibraryView()
        case .gymProfiles: GymProfilesView()
        case .foodLog: FoodLogSettingsView()
        case .expenditure: ExpenditureSettingsView()
        case .foodsRecipes: FoodLibraryView()
        case .supplements: SupplementsView()
        case .appleHealth: HealthSettingsView()
        case .changelog: ChangelogView()
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
