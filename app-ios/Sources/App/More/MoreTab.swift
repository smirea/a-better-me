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
                    row("Levels", "trophy") { LevelsView() }
                    row("Strategy", "chart.line.uptrend.xyaxis") { StrategyView() }
                    row("Workout History", "list.bullet.rectangle") { WorkoutHistoryView() }
                }
                ThemedSection("General") {
                    row("Units", "ruler") { UnitsSettingsView() }
                    row("Profile", "person.crop.circle") { ProfileSettingsView() }
                    row("Dashboard", "square.grid.2x2") { CustomizeDashboardView() }
                }
                ThemedSection("Workouts") {
                    row("Workout", "dumbbell") { WorkoutSettingsView() }
                    row("Exercises", "figure.strengthtraining.traditional") { ExerciseLibraryView() }
                    row("Gym Profiles", "building.2") { GymProfilesView() }
                }
                ThemedSection("Nutrition") {
                    row("Food Log", "fork.knife") { FoodLogSettingsView() }
                    row("Expenditure", "bolt.fill") { ExpenditureSettingsView() }
                    row("Strategy Settings", "circle.hexagongrid") { StrategySettingsView() }
                    row("Foods & Recipes", "carrot") { FoodLibraryView() }
                }
                ThemedSection("Integrations") {
                    row("Apple Health", "heart.fill") { HealthSettingsView() }
                }
                ThemedSection("Data") {
                    row("Data Visibility", "eye") { DataVisibilityView() }
                    AssetsRow()
                }
                ThemedSection("Automation") {
                    row("API Tokens", "key") { ApiTokensView() }
                }
            }
            .themedList()
            .screenTitle("More")
        }
    }

    private func row(_ title: String, _ systemImage: String, @ViewBuilder destination: () -> some View) -> some View {
        NavigationLink(destination: destination) { RowLabel(title: title, systemImage: systemImage) }
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
