import Feedback
import SwiftUI

/// Settings > Data Visibility: one page for which nutrients and body measurements the app shows. Hiding never deletes
/// data. MacroFactor's progress photo poses wait for photos, and period tracking is off for the owner.
struct DataVisibilityView: View {
    var body: some View {
        Form {
            ThemedSection {
                NavigationLink { NutrientVisibilityView() } label: {
                    RowLabel(title: "Nutrient Visibility", systemImage: "leaf")
                }
                NavigationLink { BodyMetricsVisibilityView() } label: {
                    RowLabel(title: "Body Metrics Visibility", systemImage: "figure.arms.open")
                }
            }
        }
        .themedList()
        .detailTitle("Data Visibility")
        .feedback(self)
    }
}

private struct NutrientVisibilityView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    private static let alwaysShown: [NutrientID] = [.energy, .protein, .fat, .carbs]

    var body: some View {
        Form {
            ForEach(NutrientGroup.allCases, id: \.self) { group in
                let nutrients = NutrientRegistry.all.filter { $0.group == group && !Self.alwaysShown.contains($0.id) }
                if !nutrients.isEmpty {
                    ThemedSection(group.title) {
                        ForEach(nutrients) { nutrient in
                            Toggle(nutrient.name, isOn: Binding(
                                get: { !settings.nutrition.hiddenNutrients.contains(nutrient.id) },
                                set: { shown in store.updateSettings { settings in
                                    if shown { settings.nutrition.hiddenNutrients.remove(nutrient.id) } else { settings.nutrition.hiddenNutrients.insert(nutrient.id) }
                                } }
                            ))
                            .tint(Theme.accent)
                        }
                    }
                }
            }
        }
        .themedList()
        .detailTitle("Nutrient Visibility")
        .feedback(self)
    }
}

private struct BodyMetricsVisibilityView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    var body: some View {
        Form {
            ForEach([BodyMetricGroup.upperBody, .arms, .legs], id: \.self) { group in
                ThemedSection(group.rawValue) {
                    ForEach(group.kinds, id: \.self) { kind in
                        Toggle(kind.title, isOn: Binding(
                            get: { settings.nutrition.visibleBodyMetrics.contains(kind) },
                            set: { shown in store.updateSettings { settings in
                                if shown { settings.nutrition.visibleBodyMetrics.insert(kind) } else { settings.nutrition.visibleBodyMetrics.remove(kind) }
                            } }
                        ))
                        .tint(Theme.accent)
                    }
                }
            }
        }
        .themedList()
        .detailTitle("Body Metrics Visibility")
        .feedback(self)
    }
}

