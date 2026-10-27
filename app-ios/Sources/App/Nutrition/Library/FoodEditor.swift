import SwiftUI

/// Create Food and Edit Food: MacroFactor's wizard (§6.1) folded into one Form. Nutrients use its Food Detail layout,
/// every registry nutrient grouped as the app groups them. `onCreateAndAdd` adds the logger's "Create & Add".
struct FoodEditor: View {
    private let foodID: String?
    private let onCreateAndAdd: ((Food) -> Void)?
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var draft: FoodDraft
    @State private var showErrors = false
    @State private var choosingIcon = false
    @State private var confirmingDelete = false
    @State private var expanded: Set<NutrientSection>

    /// Edits `food`, or creates a food from `draft` (blank, or a duplicate's copy).
    init(food: Food? = nil, draft: FoodDraft? = nil, onCreateAndAdd: ((Food) -> Void)? = nil) {
        foodID = food?.id
        self.onCreateAndAdd = onCreateAndAdd
        let initial = draft ?? food.map(FoodDraft.init) ?? FoodDraft()
        _draft = State(initialValue: initial)
        _expanded = State(initialValue: Set(NutrientSection.allCases.filter { section in
            section.nutrients.contains { !(initial.nutrients[$0.id] ?? "").isEmpty }
        }))
    }

    var body: some View {
        let issues = showErrors ? draft.issues : [:]
        NavigationStack {
            Form {
                identity(issues)
                serving(issues)
                otherServings(issues)
                ForEach(NutrientSection.allCases) { nutrients($0, issues: issues) }
                if foodID != nil {
                    ThemedSection {
                        Button("Delete Food", systemImage: "trash", role: .destructive) { confirmingDelete = true }
                            .foregroundStyle(Theme.destructive)
                    }
                }
            }
            .themedList()
            .scrollDismissesKeyboard(.interactively)
            .detailTitle(foodID == nil ? "Create Food" : "Edit Food")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(role: .confirm) { save(adding: false) }
                }
                if onCreateAndAdd != nil {
                    ToolbarItem(placement: .bottomBar) {
                        Button("Create & Add") { save(adding: true) }
                    }
                }
            }
            .sheet(isPresented: $choosingIcon) { FoodIconPicker(selection: $draft.icon) }
            .confirmationDialog("Delete Custom Food", isPresented: $confirmingDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) {
                    if let foodID { store.deleteFood(foodID) }
                    dismiss()
                }
            } message: {
                Text("Are you sure you want to delete \(draft.name)? Logged entries keep their copy. This action cannot be undone.")
            }
        }
    }

    private func identity(_ issues: [FoodDraft.Field: String]) -> some View {
        ThemedSection("Food") {
            HStack(spacing: 12) {
                FoodIcon(icon: draft.icon, source: .custom, size: 36)
                RowLabel(title: draft.name.isEmpty ? "Custom Food" : draft.name, detail: draft.brand.isEmpty ? "Brand Unknown" : draft.brand)
                Spacer()
                Button("Edit Icon") { choosingIcon = true }
                    .buttonStyle(.bordered)
                    .buttonBorderShape(.capsule)
                    .controlSize(.small)
            }
            TextField("Food Name", text: $draft.name)
                .accessibilityLabel("Food Name")
            FieldIssue(issues[.name])
            TextField("Brand Name", text: $draft.brand)
                .accessibilityLabel("Brand Name")
            TextField("Barcode", text: $draft.barcode)
                .keyboardType(.numberPad)
                .accessibilityLabel("Barcode")
        }
    }

    private func serving(_ issues: [FoodDraft.Field: String]) -> some View {
        ThemedSection(
            "Nutrition For",
            footer: draft.basis == .serving ? "With a serving weight, every standard unit of weight is available when you log this food. If a serving is 4 pieces, enter 4 and pieces." : nil
        ) {
            Picker("Nutrition For", selection: $draft.basis) {
                ForEach(NutritionBasis.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            if draft.basis == .serving {
                HStack {
                    TextField("Serving Weight", text: $draft.servingWeight)
                        .keyboardType(.decimalPad)
                        .accessibilityLabel("Serving Weight")
                    Picker("Unit", selection: $draft.servingWeightUnit) {
                        ForEach(SizeUnit.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .labelsHidden()
                    .fixedSize()
                }
                FieldIssue(issues[.servingWeight])
                HStack {
                    TextField("1", text: $draft.servingQuantity)
                        .keyboardType(.decimalPad)
                        .frame(width: 64)
                        .accessibilityLabel("Serving Quantity")
                    Divider()
                    TextField("portion", text: $draft.servingName)
                        .accessibilityLabel("Serving Name")
                }
                FieldIssue(issues[.servingQuantity] ?? issues[.servingName])
            }
        }
    }

    private func otherServings(_ issues: [FoodDraft.Field: String]) -> some View {
        ThemedSection("Other Servings", footer: "More servings to log this food in, such as 1 slice = 30 g.") {
            ForEach($draft.measures) { $measure in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        TextField("1", text: $measure.quantity)
                            .keyboardType(.decimalPad)
                            .frame(width: 44)
                            .accessibilityLabel("Quantity")
                        TextField("slice", text: $measure.name)
                            .accessibilityLabel("Serving Name")
                        Text("=").foregroundStyle(Theme.textSecondary)
                        TextField("0", text: $measure.size)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 64)
                            .accessibilityLabel("Size in \(draft.measureSizeUnit)")
                        Text(draft.measureSizeUnit).foregroundStyle(Theme.textSecondary)
                    }
                    FieldIssue(issues[.measureQuantity(measure.id)] ?? issues[.measureName(measure.id)] ?? issues[.measureSize(measure.id)])
                }
            }
            .onDelete { draft.measures.remove(atOffsets: $0) }
            Button("Add Serving", systemImage: "plus") { draft.measures.append(FoodDraft.MeasureDraft()) }
        }
    }

    @ViewBuilder
    private func nutrients(_ section: NutrientSection, issues: [FoodDraft.Field: String]) -> some View {
        let rows = ForEach(section.nutrients) { nutrient in
            NutrientInputRow(nutrient: nutrient, text: nutrientText(nutrient.id), energyUnit: $draft.energyUnit, isMacro: section == .macros)
            FieldIssue(issues[.nutrient(nutrient.id)])
        }
        if section == .macros {
            ThemedSection(section.rawValue, subtitle: "Serving Size: \(draft.basisLabel)") {
                rows
            }
        } else {
            ThemedSection {
                DisclosureGroup(isExpanded: Binding {
                    expanded.contains(section)
                } set: {
                    if $0 { expanded.insert(section) } else { expanded.remove(section) }
                }) {
                    rows
                } label: {
                    Text(section.rawValue).font(AppFont.headline(16))
                }
            }
        }
    }

    private func nutrientText(_ id: NutrientID) -> Binding<String> {
        Binding { draft.nutrients[id] ?? "" } set: { draft.nutrients[id] = $0 }
    }

    private func save(adding: Bool) {
        showErrors = true
        guard let valid = draft.valid else { return }
        if let foodID {
            store.editFood(foodID) { valid.write(into: &$0) }
        } else {
            let food = valid.newFood()
            store.saveFood(food)
            if adding { onCreateAndAdd?(food) }
        }
        dismiss()
    }
}

/// One nutrient's amount per serving. Energy carries the kcal | kJ menu.
private struct NutrientInputRow: View {
    let nutrient: Nutrient
    @Binding var text: String
    @Binding var energyUnit: NutritionSettings.EnergyUnit
    let isMacro: Bool

    var body: some View {
        HStack {
            Text(nutrient.name).font(AppFont.body(15))
            Spacer()
            TextField(isMacro ? "recommended" : "optional", text: $text)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: 120)
                .accessibilityLabel(nutrient.name)
            if nutrient.id == .energy {
                Picker("Energy Unit", selection: $energyUnit) {
                    Text("kcal").tag(NutritionSettings.EnergyUnit.kcal)
                    Text("kJ").tag(NutritionSettings.EnergyUnit.kj)
                }
                .labelsHidden()
                .fixedSize()
            } else {
                Text(nutrient.unit.rawValue).font(AppFont.caption(13)).foregroundStyle(Theme.textSecondary).frame(width: 36, alignment: .leading)
            }
        }
    }
}

/// A validation message under its field, shown once the owner tried to save.
struct FieldIssue: View {
    let message: String?

    init(_ message: String?) { self.message = message }

    var body: some View {
        if let message {
            Text(message).font(AppFont.rowDetail).foregroundStyle(Theme.destructive)
        }
    }
}
