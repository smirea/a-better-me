import SwiftUI

/// One exercise's equipment settings from the live workout: the bar weight the calculator loads on, the calculator's
/// offset where the gym allows one, and the Equipment Weights override. Every change writes to the exercise's
/// `ExerciseSettings.overrides`.
struct EquipmentSettingsView: View {
    let exerciseID: ExerciseID
    /// What the chosen option loads, for the bar menu. `nil` or fixed steps show no bar section.
    let loading: Loading?
    let offsetEnabled: Bool
    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings
    @Observe private var current: ExerciseSettings?
    @State private var offsetText = ""

    init(exerciseID: ExerciseID, loading: Loading?, offsetEnabled: Bool) {
        self.exerciseID = exerciseID
        self.loading = loading
        self.offsetEnabled = offsetEnabled
        _current = Observe(ExerciseSettings.one(exerciseID))
    }

    var body: some View {
        let unit = settings.weightUnit
        let overrides = current?.overrides ?? ExerciseOverrides()
        Form {
            if let plates = loading?.plates, let baseID = plates.baseID, plates.baseWeights.count > 1 {
                Section {
                    Picker("Bar Weight", selection: Binding(
                        get: { overrides.barWeightKg?[baseID].flatMap { chosen in plates.baseWeights.first { abs(unit.toKg($0) - chosen) < 0.005 } } },
                        set: { weight in
                            edit { settings in
                                var bars = settings.overrides.barWeightKg ?? [:]
                                bars[baseID] = weight.map(unit.toKg)
                                settings.overrides.barWeightKg = bars.isEmpty ? nil : bars
                            }
                        }
                    )) {
                        Text("Default (heaviest)").tag(Double?.none)
                        ForEach(plates.baseWeights, id: \.self) { Text("\(SetField.plain($0)) \(unit.rawValue)").tag(Optional($0)) }
                    }
                    .accessibilityLabel("Bar Weight")
                } header: {
                    SectionTitle("Bar Weight").textCase(nil)
                } footer: {
                    Text("The \(catalog.equipment[baseID]?.name ?? "bar") weight the plate calculator loads on for this exercise.")
                }
                .listRowBackground(Theme.surface)
            }
            if offsetEnabled {
                Section {
                    Picker("Offset", selection: Binding(get: { OffsetKind(overrides.plateOffset) }, set: { kind in
                        edit { $0.overrides.plateOffset = kind.offset(value: Self.parse(offsetText) ?? 0, unit: unit) }
                    })) {
                        ForEach(OffsetKind.allCases, id: \.self) { Text($0.title(unit: unit)).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .accessibilityLabel("Offset kind")
                    if let offset = overrides.plateOffset {
                        LabeledContent("Offset amount") {
                            TextField("0", text: $offsetText)
                                .keyboardType(.numbersAndPunctuation)
                                .multilineTextAlignment(.trailing)
                                .accessibilityLabel("Offset amount")
                                .onChange(of: offsetText) { _, text in
                                    guard let value = Self.parse(text) else { return }
                                    edit { $0.overrides.plateOffset = OffsetKind(offset).offset(value: value, unit: unit) }
                                }
                        }
                    }
                } header: {
                    SectionTitle("Offset Weight").textCase(nil)
                } footer: {
                    Text("Adds the ability to optionally offset the total weight targeted by the weight calculator. A negative offset loads less than the logged weight.")
                }
                .listRowBackground(Theme.surface)
            }
            Section {
                NavigationLink {
                    EquipmentWeightsOverrideView(exerciseID: exerciseID)
                } label: {
                    LabeledContent("Equipment Weights", value: ExerciseOverrideRow.equipmentWeights.summary(current))
                }
                .accessibilityLabel("Equipment Weights")
            }
            .listRowBackground(Theme.surface)
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .font(AppFont.medium(15))
        .tint(Theme.textPrimary)
        .navigationTitle("Equipment Settings")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { offsetText = Self.text(of: overrides.plateOffset, unit: unit) }
    }

    private enum OffsetKind: CaseIterable {
        case none, percent, weight

        init(_ offset: PlateOffset?) {
            switch offset {
            case nil: self = .none
            case .percent: self = .percent
            case .kilograms: self = .weight
            }
        }

        func title(unit: WeightUnit) -> String {
            switch self {
            case .none: "None"
            case .percent: "% target weight"
            case .weight: unit.rawValue
            }
        }

        func offset(value: Double, unit: WeightUnit) -> PlateOffset? {
            switch self {
            case .none: nil
            case .percent: .percent(value)
            case .weight: .kilograms(unit.toKg(value))
            }
        }
    }

    private static func text(of offset: PlateOffset?, unit: WeightUnit) -> String {
        switch offset {
        case nil: ""
        case let .percent(percent): percent.formatted(.number.precision(.fractionLength(0...2)))
        case let .kilograms(kg): unit.format(kg: kg)
        }
    }

    /// Signed, unlike a load's weight field.
    private static func parse(_ text: String) -> Double? {
        Double(text.replacing(",", with: ".").trimmingCharacters(in: .whitespaces))
    }

    private func edit(_ change: @escaping @Sendable (inout ExerciseSettings) -> Void) {
        store.modify(ExerciseSettings.self, id: exerciseID, orInsert: { ExerciseSettings(id: exerciseID) }, change)
    }
}
