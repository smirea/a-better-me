import SwiftUI

/// Edits one item's load. `onSave(nil)` means Reset to Default. Independent of gym profiles, so Exercise Overrides'
/// Equipment Weights can present it too.
struct EquipmentLoadEditor: View {
    let equipment: Equipment
    let unit: WeightUnit
    let onSave: (EquipmentLoad?) -> Void
    @State private var draft: EquipmentLoad
    @Environment(\.dismiss) private var dismiss

    init(equipment: Equipment, load: EquipmentLoad, unit: WeightUnit, onSave: @escaping (EquipmentLoad?) -> Void) {
        self.equipment = equipment
        self.unit = unit
        self.onSave = onSave
        _draft = State(initialValue: load)
    }

    var body: some View {
        NavigationStack {
            Form {
                switch draft {
                case .weights(let options):
                    WeightOptionsEditor(options: options, unit: unit) { draft = .weights(options: $0) }
                case .ranges(let options, let micro):
                    WeightRangesEditor(ranges: options, unit: unit) { draft = .ranges(options: $0, micro: micro) }
                    MicroAdjustmentEditor(micro: micro, unit: unit) { draft = .ranges(options: options, micro: $0) }
                case .base(let kg):
                    ThemedSection("Base Weight") {
                        WeightField(title: "Base weight", kg: kg, unit: unit) { draft = .base(kg: $0) }
                    }
                case .bands(let options):
                    BandOptionsEditor(bands: options) { draft = .bands(options: $0) }
                }
                ThemedSection {
                    Button("Reset to Default", systemImage: "arrow.counterclockwise", role: .destructive) {
                        onSave(nil)
                        dismiss()
                    }
                }
            }
            .themedList()
            .font(AppFont.rowTitle)
            .detailTitle(equipment.name)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", systemImage: "xmark") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save", systemImage: "checkmark") {
                        onSave(draft)
                        dismiss()
                    }
                }
            }
        }
    }
}

private struct WeightOptionsEditor: View {
    let options: [WeightOption]
    let unit: WeightUnit
    let onChange: ([WeightOption]) -> Void
    @State private var newWeight = ""

    var body: some View {
        ThemedSection("Weights") {
            HStack {
                TextField("Add a weight (\(unit.rawValue))", text: $newWeight)
                    .keyboardType(.decimalPad)
                Button("Add", systemImage: "plus") {
                    guard let weight = WeightField.parse(newWeight) else { return }
                    onChange((options + [WeightOption(kg: unit.toKg(weight), unit: unit)]).sorted { $0.kg < $1.kg })
                    newWeight = ""
                }
                .labelStyle(.iconOnly)
                .disabled(WeightField.parse(newWeight) == nil)
            }
            ForEach(Array(options.enumerated()), id: \.offset) { index, option in
                HStack {
                    Text(unit.label(kg: option.kg))
                    Spacer()
                    QuantityMenu(count: option.count) { count in
                        var changed = options
                        changed[index].count = count
                        onChange(changed)
                    }
                }
            }
            .onDelete { offsets in
                var changed = options
                changed.remove(atOffsets: offsets)
                onChange(changed)
            }
        }
    }
}

private struct WeightRangesEditor: View {
    let ranges: [WeightRange]
    let unit: WeightUnit
    let onChange: ([WeightRange]) -> Void

    var body: some View {
        ForEach(Array(ranges.enumerated()), id: \.offset) { index, range in
            ThemedSection("Range \(index + 1) · \(EquipmentLoad.ranges(options: [range]).summary(in: unit))") {
                WeightField(title: "Minimum", kg: range.minKg, unit: unit, onChange: update(index) { $0.minKg = $1 })
                WeightField(title: "Maximum", kg: range.maxKg, unit: unit, onChange: update(index) { $0.maxKg = $1 })
                WeightField(title: "Increment", kg: range.incrementKg, unit: unit, onChange: update(index) { $0.incrementKg = $1 })
                if ranges.count > 1 {
                    Button("Remove Range", systemImage: "minus.circle", role: .destructive) {
                        var changed = ranges
                        changed.remove(at: index)
                        onChange(changed)
                    }
                }
            }
        }
        // Fields keep their typed text, so removing a range rebuilds them rather than shifting stale text up.
        .id(ranges.count)
        ThemedSection {
            Button("Add Range", systemImage: "plus") {
                let last = ranges.last ?? WeightRange(minKg: 0, maxKg: unit.toKg(500), incrementKg: unit.toKg(10))
                onChange(ranges + [last])
            }
        }
    }

    private func update(_ index: Int, _ change: @escaping (inout WeightRange, Double) -> Void) -> (Double) -> Void {
        { kg in
            var changed = ranges
            change(&changed[index], kg)
            onChange(changed)
        }
    }
}

/// MF's Add Micro-Adjustments on the Edit Machine sheet: the kind and the small weights it adds to a pin position.
private struct MicroAdjustmentEditor: View {
    let micro: MicroAdjustment?
    let unit: WeightUnit
    let onChange: (MicroAdjustment?) -> Void
    @State private var newWeight = ""

    var body: some View {
        ThemedSection("Micro-Adjustments", footer: micro.map { Self.summary($0.kind) }) {
            Picker("Add Micro-Adjustments", selection: Binding(get: { micro?.kind }, set: { kind in
                onChange(kind.map { MicroAdjustment(kind: $0, weightsKg: micro?.weightsKg ?? []) })
            })) {
                Text("None").tag(MicroAdjustment.Kind?.none)
                ForEach(MicroAdjustment.Kind.allCases, id: \.self) { Text(Self.title($0)).tag(Optional($0)) }
            }
            .accessibilityLabel("Add Micro-Adjustments")
            if let micro {
                HStack {
                    TextField("Add a weight (\(unit.rawValue))", text: $newWeight)
                        .keyboardType(.decimalPad)
                        .accessibilityLabel("Add a micro-adjustment weight")
                    Button("Add", systemImage: "plus") {
                        guard let weight = WeightField.parse(newWeight) else { return }
                        onChange(MicroAdjustment(kind: micro.kind, weightsKg: (micro.weightsKg + [unit.toKg(weight)]).sorted()))
                        newWeight = ""
                    }
                    .labelStyle(.iconOnly)
                    .disabled(WeightField.parse(newWeight) == nil)
                    .accessibilityLabel("Add micro-adjustment weight")
                }
                ForEach(Array(micro.weightsKg.enumerated()), id: \.offset) { _, kg in
                    Text(unit.label(kg: kg))
                }
                .onDelete { offsets in
                    var weights = micro.weightsKg
                    weights.remove(atOffsets: offsets)
                    onChange(MicroAdjustment(kind: micro.kind, weightsKg: weights))
                }
            }
        }
    }

    static func title(_ kind: MicroAdjustment.Kind) -> String {
        switch kind {
        case .dial: "Dial"
        case .pin: "Pin"
        case .plates: "Plates"
        }
    }

    /// MF's descriptions of the three types.
    static func summary(_ kind: MicroAdjustment.Kind) -> String {
        switch kind {
        case .dial: "Fine-tunes the weight using a small adjustment dial on top of the selected load. Allows one adjustment at a time."
        case .pin: "Lets you select a single incremental weight by inserting a pin into the micro-adjustment stack."
        case .plates: "Loads additional plates directly onto the machine. Allows more than one adjustment at a time."
        }
    }
}

private struct BandOptionsEditor: View {
    let bands: [BandOption]
    let onChange: ([BandOption]) -> Void
    @State private var newColor = ""

    var body: some View {
        ThemedSection("Bands") {
            HStack {
                TextField("Add a color", text: $newColor)
                Button("Add", systemImage: "plus") {
                    let color = newColor.trimmingCharacters(in: .whitespaces)
                    guard !color.isEmpty else { return }
                    onChange(bands + [BandOption(color: color)])
                    newColor = ""
                }
                .labelStyle(.iconOnly)
                .disabled(newColor.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            ForEach(Array(bands.enumerated()), id: \.offset) { index, band in
                HStack {
                    Text(band.color)
                    Spacer()
                    QuantityMenu(count: band.count) { count in
                        var changed = bands
                        changed[index].count = count
                        onChange(changed)
                    }
                }
            }
            .onDelete { offsets in
                var changed = bands
                changed.remove(atOffsets: offsets)
                onChange(changed)
            }
        }
    }
}

/// MF's "Set Qty": unlimited, or how many of the item the gym has.
private struct QuantityMenu: View {
    let count: Int?
    let onChange: (Int?) -> Void

    var body: some View {
        Menu {
            Button("Unlimited") { onChange(nil) }
            ForEach(1...20, id: \.self) { number in
                Button("\(number)") { onChange(number) }
            }
        } label: {
            Text(count.map { "Qty \($0)" } ?? "Set Qty")
                .font(AppFont.medium(13))
                .underline()
                .foregroundStyle(Theme.textSecondary)
        }
    }
}

/// A weight typed in the owner's unit and stored in kilograms. A text field rather than a formatted value one,
/// because a value field commits only on return, which the decimal pad lacks.
private struct WeightField: View {
    let title: String
    let unit: WeightUnit
    let onChange: (Double) -> Void
    @State private var text: String

    init(title: String, kg: Double, unit: WeightUnit, onChange: @escaping (Double) -> Void) {
        self.title = title
        self.unit = unit
        self.onChange = onChange
        _text = State(initialValue: unit.format(kg: kg))
    }

    static func parse(_ text: String) -> Double? {
        NumberText.parse(text).flatMap { $0 >= 0 ? $0 : nil }
    }

    var body: some View {
        LabeledContent(title) {
            HStack(spacing: 4) {
                TextField(title, text: $text)
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .onChange(of: text) { _, value in
                        if let weight = Self.parse(value) { onChange(unit.toKg(weight)) }
                    }
                Text(unit.rawValue).foregroundStyle(Theme.textSecondary)
            }
        }
    }
}
