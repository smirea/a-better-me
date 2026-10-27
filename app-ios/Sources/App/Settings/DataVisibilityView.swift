import SwiftUI

/// Settings > Data Visibility: one page for which nutrients and body measurements the app shows. Hiding never deletes
/// data. MacroFactor's progress photo poses wait for photos, and period tracking is off for the owner.
struct DataVisibilityView: View {
    var body: some View {
        Form {
            Section {
                NavigationLink { NutrientVisibilityView() } label: {
                    RowLabel(title: "Nutrient Visibility", systemImage: "leaf")
                }
                NavigationLink { BodyMetricsVisibilityView() } label: {
                    RowLabel(title: "Body Metrics Visibility", systemImage: "figure.arms.open")
                }
            } header: {
                SectionTitle("Visibility Settings").textCase(nil)
            } footer: {
                Text("Hide the metrics you do not use to simplify the app. Hidden data is kept, and you can show it again at any time.")
            }
        }
        .themedList()
        .navigationTitle("Data Visibility")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct NutrientVisibilityView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    private static let alwaysShown: [NutrientID] = [.energy, .protein, .fat, .carbs]

    var body: some View {
        Form {
            Section {
                ForEach(Self.alwaysShown, id: \.self) { id in
                    LabeledContent(NutrientRegistry.nutrient(id)?.name ?? id.rawValue, value: "Default")
                }
            } header: {
                SectionTitle("Calories & Macros").textCase(nil)
            } footer: {
                Text("Hidden nutrients still count toward totals and still go to Apple Health.")
            }
            ForEach(NutrientGroup.allCases, id: \.self) { group in
                let nutrients = NutrientRegistry.all.filter { $0.group == group && !Self.alwaysShown.contains($0.id) }
                if !nutrients.isEmpty {
                    Section {
                        ForEach(nutrients) { nutrient in
                            Toggle(nutrient.name, isOn: Binding(
                                get: { !settings.nutrition.hiddenNutrients.contains(nutrient.id) },
                                set: { shown in store.updateSettings { settings in
                                    if shown { settings.nutrition.hiddenNutrients.remove(nutrient.id) } else { settings.nutrition.hiddenNutrients.insert(nutrient.id) }
                                } }
                            ))
                            .tint(Theme.accent)
                        }
                    } header: {
                        SectionTitle(group.title).textCase(nil)
                    }
                }
            }
        }
        .themedList()
        .navigationTitle("Nutrient Visibility")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct BodyMetricsVisibilityView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    private static let groups: [(title: String, kinds: [BodyMetricKind])] = [
        ("Upper Body", [.neck, .shoulders, .bust, .chest, .waist, .hips]),
        ("Arms", [.leftBicep, .rightBicep, .leftForearm, .rightForearm, .leftWrist, .rightWrist]),
        ("Legs", [.leftThigh, .rightThigh, .leftCalf, .rightCalf, .leftAnkle, .rightAnkle]),
    ]

    var body: some View {
        Form {
            Section {
                LabeledContent("Scale Weight", value: "Default")
                LabeledContent("Visual Body Fat", value: "Default")
            } header: {
                SectionTitle("Weight & Body Fat").textCase(nil)
            }
            ForEach(Self.groups, id: \.title) { group in
                Section {
                    ForEach(group.kinds, id: \.self) { kind in
                        Toggle(kind.title, isOn: Binding(
                            get: { settings.nutrition.visibleBodyMetrics.contains(kind) },
                            set: { shown in store.updateSettings { settings in
                                if shown { settings.nutrition.visibleBodyMetrics.insert(kind) } else { settings.nutrition.visibleBodyMetrics.remove(kind) }
                            } }
                        ))
                        .tint(Theme.accent)
                    }
                } header: {
                    SectionTitle(group.title).textCase(nil)
                }
            }
        }
        .themedList()
        .navigationTitle("Body Metrics Visibility")
        .navigationBarTitleDisplayMode(.inline)
    }
}

extension NutrientGroup {
    var title: String {
        switch self {
        case .general: "General"
        case .protein: "Protein Breakdown"
        case .carbohydrates: "Carb Breakdown"
        case .fats: "Fat Breakdown"
        case .vitamins: "Vitamins"
        case .minerals: "Minerals"
        }
    }
}

extension BodyMetricKind {
    /// "Left Bicep" from `leftBicep`.
    var title: String {
        String(describing: self).replacing(/([a-z])([A-Z])/) { "\($0.1) \($0.2)" }.capitalized
    }
}
