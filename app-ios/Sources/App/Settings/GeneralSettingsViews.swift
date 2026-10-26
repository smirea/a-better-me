import SwiftUI

/// Settings > Units: one list for both halves. The clock follows the system's 24-Hour Time, and nothing in the app
/// measures distance, so MacroFactor's Clock and Distance rows are left out.
struct UnitsSettingsView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    var body: some View {
        Form {
            Section {
                SettingChoice(
                    title: "Weight", systemImage: "scalemass", selection: store.binding(settings, \.weightUnit),
                    options: [SettingOption(value: .lb, title: "Pounds"), SettingOption(value: .kg, title: "Kilograms")]
                )
                SettingChoice(
                    title: "Energy", systemImage: "flame", selection: store.binding(settings, \.nutrition.energyUnit),
                    options: [SettingOption(value: .kcal, title: "Calories"), SettingOption(value: .kj, title: "Kilojoules")]
                )
                SettingChoice(
                    title: "Height", systemImage: "ruler", selection: store.binding(settings, \.nutrition.heightUnit),
                    options: [
                        SettingOption(value: .feetAndInches, title: "Feet and Inches"),
                        SettingOption(value: .centimeters, title: "Centimeters", detail: "Also body measurements"),
                    ]
                )
            }
        }
        .themedList()
        .navigationTitle("Units")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// Settings > Profile: the body inputs both halves read. The body figure and exercise access read the sex; the BMR and
/// the nutrient defaults read all three.
struct ProfileSettingsView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    var body: some View {
        let unit = settings.nutrition.heightUnit
        Form {
            Section {
                SettingChoice(
                    title: "Sex", systemImage: "figure.stand", selection: store.binding(settings, \.profile.sex),
                    options: [SettingOption(value: .male, title: "Male"), SettingOption(value: .female, title: "Female")]
                )
                SettingChoice(
                    title: "Height", systemImage: "ruler", selection: store.binding(settings, \.profile.heightCm),
                    options: [SettingOption(value: nil, title: "Not set")] + heights(unit).map { SettingOption(value: $0, title: SettingsRules.height($0, in: unit)) }
                )
                birthDate
            }
        }
        .themedList()
        .navigationTitle("Profile")
        .navigationBarTitleDisplayMode(.inline)
    }

    /// Tallest first, with the stored height kept as it is when it falls between two choices of the unit.
    private func heights(_ unit: NutritionSettings.HeightUnit) -> [Double] {
        var choices = SettingsRules.heightChoices(in: unit)
        if let stored = settings.profile.heightCm, !choices.contains(stored) { choices.append(stored) }
        return choices.sorted(by: >)
    }

    @ViewBuilder private var birthDate: some View {
        if let day = settings.profile.birthDate {
            DatePicker(
                selection: Binding(
                    get: { Calendar.current.date(from: DateComponents(year: day.year, month: day.month, day: day.day)) ?? .now },
                    set: { date in store.updateSettings { $0.profile.birthDate = CalendarDay(date) } }
                ),
                in: ...Date.now, displayedComponents: .date
            ) {
                SettingLabel(title: "Date of Birth", detail: nil, systemImage: "birthday.cake")
            }
        } else {
            LabeledContent {
                Button("Set") { store.updateSettings { $0.profile.birthDate = CalendarDay("1990-01-01") } }
                    .buttonStyle(.bordered)
                    .buttonBorderShape(.capsule)
                    .accessibilityLabel("Set Date of Birth")
            } label: {
                SettingLabel(title: "Date of Birth", detail: "Not set", systemImage: "birthday.cake")
            }
        }
    }
}
