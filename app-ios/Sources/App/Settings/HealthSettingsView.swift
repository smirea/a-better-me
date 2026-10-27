import HealthKit
import HealthKitUI
import SwiftUI

/// Settings > Apple Health: what the app reads and writes. Reads and workouts need no switch; writing food does,
/// because MacroFactor may already write the same meals.
struct HealthSettingsView: View {
    @State private var healthStore = HKHealthStore()
    @State private var requestTrigger = false
    @State private var energyAllowed = false
    private let nutrition = NutritionHealth.shared

    var body: some View {
        Form {
            Section {
                RowLabel(title: "Body Weight and Steps", detail: "Charted on the Dashboard", systemImage: "scalemass")
                RowLabel(title: "Heart Rate and Energy", detail: "Read during workouts", systemImage: "heart.text.square")
            } header: {
                SectionTitle("Reads").textCase(nil)
            }
            Section {
                RowLabel(title: "Workouts", detail: "Each finished workout, with its heart rate and energy", systemImage: "figure.strengthtraining.traditional")
                SettingToggle(
                    title: "Nutrition", detail: "Logged food as dietary energy, macros, and the micronutrients Health has types for",
                    systemImage: "fork.knife",
                    isOn: Binding(get: { nutrition.isEnabled }, set: { on in
                        if on { Task { await enable() } } else { nutrition.isEnabled = false }
                    })
                )
                if nutrition.isEnabled, let last = nutrition.lastWrite {
                    LabeledContent("Last written", value: "\(last.day) · \(last.samples) samples")
                        .font(AppFont.caption(13))
                }
            } header: {
                SectionTitle("Writes").textCase(nil)
            } footer: {
                Text(footer)
            }
        }
        .themedList()
        .navigationTitle("Apple Health")
        .navigationBarTitleDisplayMode(.inline)
        .healthDataAccessRequest(store: healthStore, shareTypes: DietaryHealth.shareTypes, readTypes: [], trigger: requestTrigger) { @Sendable _ in
            // HealthKit calls back off the main thread, where a main-actor closure traps.
            Task { @MainActor in
                refreshAccess()
                NutritionHealth.shared.isEnabled = true
            }
        }
        .onAppear(perform: refreshAccess)
    }

    private var footer: String {
        if nutrition.isEnabled, !energyAllowed {
            return "Health does not allow A Better Me to write dietary energy. Allow it in the Health app under Sharing > Apps."
        }
        return "Each day is written when its log changes, and re-writing a day replaces what the app wrote for it. History older than \(DietaryHealth.recentDays) days is not written, so food MacroFactor already sent to Health is not doubled."
    }

    private func enable() async {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        let status = try? await healthStore.statusForAuthorizationRequest(toShare: DietaryHealth.shareTypes, read: [])
        if status == .shouldRequest {
            requestTrigger.toggle()
        } else {
            nutrition.isEnabled = true
            refreshAccess()
        }
    }

    private func refreshAccess() {
        energyAllowed = healthStore.authorizationStatus(for: HKQuantityType(.dietaryEnergyConsumed)) == .sharingAuthorized
    }
}
