import SwiftUI

struct MoreTab: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    var body: some View {
        NavigationStack {
            Form {
                if let rows = store.snapshotRows {
                    Section {
                        SettingLabel(title: "Downloading… \(rows) rows", detail: nil, systemImage: "arrow.down.circle")
                    }
                }
                Section {
                    Picker(selection: Binding(get: { settings.weightUnit }, set: { unit in store.updateSettings { $0.weightUnit = unit } })) {
                        ForEach(WeightUnit.allCases) { Text($0.rawValue).tag($0) }
                    } label: {
                        SettingLabel(title: "Weight Unit", detail: nil, systemImage: "scalemass")
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
                    SectionTitle("Feature Settings").textCase(nil)
                }
                Section("Automation") {
                    NavigationLink { ApiTokensView() } label: {
                        Label("API Tokens", systemImage: "key")
                    }
                }
            }
            .themedList()
            .screenTitle("More")
        }
    }
}
