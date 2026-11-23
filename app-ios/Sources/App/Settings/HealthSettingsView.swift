import HealthKit
import HealthKitUI
import Feedback
import SwiftUI

/// Settings > Apple Health. Reads and workouts need no switch; writing food does, because MacroFactor may already write
/// the same meals. Each day is written when its log changes, and only the last `DietaryHealth.recentDays` days, so food
/// MacroFactor already sent is not doubled.
struct HealthSettingsView: View {
    private let healthStore = HealthStore.shared
    @State private var requestTrigger = false
    @State private var energyAllowed = false
    @State private var exportingSteps = false
    private let nutrition = NutritionHealth.shared

    var body: some View {
        Form {
            ThemedSection {
                SettingToggle(
                    title: "Write Nutrition", systemImage: "fork.knife",
                    isOn: Binding(get: { nutrition.isEnabled }, set: { on in
                        if on { Task { await enable() } } else { nutrition.isEnabled = false }
                    })
                )
                if let warning {
                    RowLabel(title: warning.title, detail: warning.detail, systemImage: "exclamationmark.triangle.fill", iconTint: Theme.coral)
                }
                if nutrition.isEnabled, let last = nutrition.lastWrite {
                    LabeledContent("Last Written", value: "\(last.day) · \(last.samples) samples")
                }
            }
            ThemedSection {
                Button { exportingSteps = true } label: {
                    RowLabel(title: "Export Step Samples", systemImage: "square.and.arrow.up")
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Export Step Samples")
            }
        }
        .themedList()
        .detailTitle("Apple Health")
        .sheet(isPresented: $exportingSteps) { StepSamplesExportSheet() }
        .healthDataAccessRequest(store: healthStore, shareTypes: DietaryHealth.shareTypes, readTypes: [], trigger: requestTrigger) { @Sendable _ in
            // HealthKit calls back off the main thread, where a main-actor closure traps.
            Task { @MainActor in
                refreshAccess()
                NutritionHealth.shared.isEnabled = true
            }
        }
        .onAppear(perform: refreshAccess)
        .feedback(self)
    }

    private var warning: (title: String, detail: String)? {
        if !HealthStore.isAvailable, HKHealthStore.isHealthDataAvailable() {
            return ("Health Is Off", "Run with --health on")
        }
        if nutrition.isEnabled, !energyAllowed {
            return ("Dietary Energy Not Allowed", "Health › Sharing › Apps")
        }
        return nil
    }

    private func enable() async {
        guard HealthStore.isAvailable else { return }
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
