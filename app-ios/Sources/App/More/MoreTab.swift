import SwiftUI

struct MoreTab: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    var body: some View {
        NavigationStack {
            Form {
                Section("General") {
                    Picker(
                        "Weight Unit", systemImage: "scalemass",
                        selection: Binding(get: { settings.weightUnit }, set: { unit in store.updateSettings { $0.weightUnit = unit } })
                    ) {
                        ForEach(WeightUnit.allCases) { Text($0.rawValue).tag($0) }
                    }
                    NavigationLink { SyncSettingsView() } label: {
                        LabeledContent { Text(store.syncState.title).foregroundStyle(Theme.textSecondary) } label: {
                            Label("Sync", systemImage: "arrow.triangle.2.circlepath")
                        }
                    }
                }
                Section("Feature Settings") {
                    NavigationLink { WorkoutSettingsView() } label: {
                        Label("Workout", systemImage: "dumbbell")
                    }
                    NavigationLink { ExerciseLibraryView() } label: {
                        Label("Exercises", systemImage: "list.bullet.rectangle")
                    }
                }
            }
            .screenTitle("More")
        }
    }
}
