import SwiftUI

/// The one settings tree for both halves, pushed from the Dashboard's gear. MacroFactor's and MacroFactor Workouts'
/// More pages collapse into it (docs/decisions/nutrition.md#settings-and-health).
struct SettingsView: View {
    @Environment(LocalStore.self) private var store

    var body: some View {
        Form {
            if let rows = store.snapshotRows {
                Section {
                    SettingLabel(title: "Downloading… \(rows) rows", detail: nil, systemImage: "arrow.down.circle")
                }
            }
            Section {
                NavigationLink { UnitsSettingsView() } label: {
                    SettingLabel(title: "Units", detail: nil, systemImage: "ruler")
                }
                NavigationLink { ProfileSettingsView() } label: {
                    SettingLabel(title: "Profile", detail: nil, systemImage: "person.crop.circle")
                }
                NavigationLink { CustomizeDashboardView() } label: {
                    SettingLabel(title: "Dashboard", detail: nil, systemImage: "square.grid.2x2")
                }
            } header: {
                SectionTitle("General").textCase(nil)
            }
            Section {
                NavigationLink { WorkoutSettingsView() } label: {
                    SettingLabel(title: "Workout", detail: nil, systemImage: "dumbbell")
                }
                NavigationLink { ExerciseLibraryView() } label: {
                    SettingLabel(title: "Exercises", detail: nil, systemImage: "list.bullet.rectangle")
                }
                NavigationLink { GymProfilesView() } label: {
                    SettingLabel(title: "Gym Profiles", detail: nil, systemImage: "building.2")
                }
            } header: {
                SectionTitle("Workouts").textCase(nil)
            }
            Section {
                NavigationLink { FoodLogSettingsView() } label: {
                    SettingLabel(title: "Food Log", detail: nil, systemImage: "fork.knife")
                }
                NavigationLink { ExpenditureSettingsView() } label: {
                    SettingLabel(title: "Expenditure", detail: nil, systemImage: "bolt.fill")
                }
                NavigationLink { StrategySettingsView() } label: {
                    SettingLabel(title: "Strategy", detail: nil, systemImage: "circle.hexagongrid")
                }
                NavigationLink { FoodLibraryView() } label: {
                    SettingLabel(title: "Foods & Recipes", detail: nil, systemImage: "carrot")
                }
            } header: {
                SectionTitle("Nutrition").textCase(nil)
            }
            Section {
                NavigationLink { HealthSettingsView() } label: {
                    SettingLabel(title: "Apple Health", detail: nil, systemImage: "heart.fill")
                }
            } header: {
                SectionTitle("Integrations").textCase(nil)
            }
            Section {
                NavigationLink { DataVisibilityView() } label: {
                    SettingLabel(title: "Data Visibility", detail: nil, systemImage: "eye")
                }
                Button { AssetStore.shared.refresh() } label: {
                    SettingLabel(title: AssetStore.shared.statusLine, detail: nil, systemImage: "icloud.and.arrow.down")
                }
                .accessibilityLabel(AssetStore.shared.statusLine)
                .accessibilityHint("Checks for missing exercise images and downloads them now, on cellular too")
            } header: {
                SectionTitle("Data").textCase(nil)
            }
            Section {
                NavigationLink { ApiTokensView() } label: {
                    SettingLabel(title: "API Tokens", detail: nil, systemImage: "key")
                }
            } header: {
                SectionTitle("Automation").textCase(nil)
            }
        }
        .themedList()
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
    }
}
