import SwiftUI

struct MoreTab: View {
    @AppStorage(WeightUnit.storageKey) private var weightUnit = WeightUnit.kg

    var body: some View {
        NavigationStack {
            Form {
                Section("General") {
                    Picker("Weight Unit", systemImage: "scalemass", selection: $weightUnit) {
                        ForEach(WeightUnit.allCases) { Text($0.rawValue).tag($0) }
                    }
                }
                Section("Feature Settings") {
                    NavigationLink { RestTimerSettings() } label: {
                        Label("Rest Timer", systemImage: "timer")
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

private struct RestTimerSettings: View {
    var body: some View {
        Form {
            Section("Timer Duration") {
                ForEach(RestCategory.allCases) { RestDurationRow(category: $0) }
            }
        }
        .navigationTitle("Rest Timer")
    }
}

private struct RestDurationRow: View {
    let category: RestCategory
    @AppStorage private var seconds: Int

    init(category: RestCategory) {
        self.category = category
        _seconds = AppStorage(wrappedValue: category.defaultSeconds, category.storageKey)
    }

    var body: some View {
        Stepper(value: $seconds, in: 0...600, step: 15) {
            LabeledContent(category.displayName, value: Duration.seconds(seconds).formatted(.time(pattern: .minuteSecond)))
        }
    }
}
