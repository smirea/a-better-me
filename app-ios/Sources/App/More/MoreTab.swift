import SwiftUI

struct MoreTab: View {
    @AppStorage(WeightUnit.storageKey) private var weightUnit = WeightUnit.kg
    @AppStorage(WorkoutSettingsKey.defaultRestSeconds) private var defaultRestSeconds = 120

    var body: some View {
        NavigationStack {
            Form {
                Section("General") {
                    Picker("Weight Unit", systemImage: "scalemass", selection: $weightUnit) {
                        ForEach(WeightUnit.allCases) { Text($0.rawValue).tag($0) }
                    }
                }
                Section("Feature Settings") {
                    Stepper(value: $defaultRestSeconds, in: 0...600, step: 15) {
                        LabeledContent {
                            Text(Duration.seconds(defaultRestSeconds).formatted(.time(pattern: .minuteSecond)))
                        } label: {
                            Label("Default Rest", systemImage: "timer")
                        }
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
