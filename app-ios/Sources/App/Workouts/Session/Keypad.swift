import SwiftUI

/// One input column of the set table, chosen from the exercise's `metrics`.
enum SetField: Hashable {
    case weight(perSide: Bool)
    case reps(perSide: Bool)
    case duration(perSide: Bool)
    case distance(long: Bool)

    /// The exercise's columns in its metric order. An exercise the catalog no longer knows logs weight and reps.
    static func fields(for exercise: Exercise?) -> [SetField] {
        guard let exercise else { return [.weight(perSide: false), .reps(perSide: false)] }
        var fields: [SetField] = []
        for metric in exercise.metrics {
            let field: SetField = switch metric {
            case .weight, .assistanceWeight: .weight(perSide: false)
            case .weightPerSide, .weightPerSidePersistent: .weight(perSide: true)
            case .reps: .reps(perSide: false)
            case .repsPerSide: .reps(perSide: true)
            case .duration: .duration(perSide: false)
            case .durationPerSide: .duration(perSide: true)
            case .distanceShort, .distanceShortPerSide: .distance(long: false)
            case .distanceLong: .distance(long: true)
            }
            if !fields.contains(field) { fields.append(field) }
        }
        return Array(fields.prefix(2))
    }

    func header(unit: WeightUnit) -> String {
        switch self {
        case let .weight(perSide): perSide ? "\(unit.rawValue.capitalized)/Side" : unit.rawValue.capitalized
        case let .reps(perSide): perSide ? "Reps/Side" : "Reps"
        case let .duration(perSide): perSide ? "Sec/Side" : "Sec"
        case let .distance(long): long ? "Km" : "M"
        }
    }

    var isReps: Bool { if case .reps = self { true } else { false } }
    var isWeight: Bool { if case .weight = self { true } else { false } }
    var allowsDecimal: Bool {
        switch self {
        case .weight, .distance(long: true): true
        default: false
        }
    }

    /// What the cell shows: the field's text, with "8 + 2" for reps done with partials.
    func display(_ entry: SetEntry, unit: WeightUnit) -> String {
        if isReps, let partial = entry.partialReps, partial > 0 { return "\(text(entry, unit: unit)) + \(partial)" }
        return text(entry, unit: unit)
    }

    /// The keypad types "." and `apply` parses with `Double(_:)`, so field text never uses locale separators or grouping.
    func text(_ entry: SetEntry, unit: WeightUnit) -> String {
        switch self {
        case .weight: entry.weightKg.map { Self.plain(unit.fromKg($0)) } ?? ""
        case .reps: entry.reps.map(String.init) ?? ""
        case .duration: entry.durationSeconds.map(String.init) ?? ""
        case let .distance(long): entry.distanceMeters.map { Self.plain(long ? $0 / 1000 : $0) } ?? ""
        }
    }

    static func plain(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0...2)).grouping(.never).locale(Locale(identifier: "en_US_POSIX")))
    }

    /// Writes typed `text` into `entry`. An empty field clears the value.
    func apply(_ text: String, to entry: inout SetEntry, unit: WeightUnit) {
        let number = Double(text)
        switch self {
        case .weight: entry.weightKg = number.map(unit.toKg)
        case .reps: entry.reps = number.map { Int($0) }
        case .duration: entry.durationSeconds = number.map { Int($0) }
        case let .distance(long): entry.distanceMeters = number.map { long ? $0 * 1000 : $0 }
        }
    }
}

/// The field the keypad is typing into. The first key replaces the shown value, as if it were selected.
struct KeypadFocus: Equatable {
    var row: RowPath
    var field: SetField
    var text: String
    var replacesOnType = true
    /// The reps keypad's P: the digits go to `SetEntry.partialReps`.
    var partial = false

    init(row: RowPath, field: SetField, entry: SetEntry, unit: WeightUnit, partial: Bool = false) {
        self.row = row
        self.field = field
        self.partial = partial
        text = partial ? entry.partialReps.map(String.init) ?? "" : field.text(entry, unit: unit)
    }

    func apply(to entry: inout SetEntry, unit: WeightUnit) {
        if partial {
            entry.partialReps = Double(text).map { Int($0) }
        } else {
            field.apply(text, to: &entry, unit: unit)
        }
    }

    mutating func type(_ key: Character) {
        if replacesOnType { text = "" }
        replacesOnType = false
        if key == "." {
            guard field.allowsDecimal, !text.contains(".") else { return }
            text = text.isEmpty ? "0." : text + "."
        } else if text.count < 6 {
            text = text == "0" ? String(key) : text + String(key)
        }
    }

    mutating func backspace() {
        text = replacesOnType ? "" : String(text.dropLast())
        replacesOnType = false
    }

    mutating func step(by delta: Double) {
        let value = max(0, (Double(text) ?? 0) + delta)
        text = SetField.plain(value)
        replacesOnType = true
    }
}

enum KeypadKey {
    case character(Character), backspace, dismiss, decrement, increment, next, done
    case rir(Int?)
    case partial(Bool)
}

/// The custom keypad from the reference: digits on the left, then dismiss and the field's own keys on the right.
/// Weight gets − / + and →; reps get the RIR chips and ✓. The plate calculator is cut from milestone 1.
struct Keypad: View {
    let field: SetField
    let rir: Int?
    let partial: Bool
    let onKey: (KeypadKey) -> Void

    private static let keyHeight: CGFloat = 50

    var body: some View {
        VStack(spacing: 0) {
            if field.isReps {
                rirChips
                Divider().overlay(Theme.separator)
            }
            HStack(alignment: .top, spacing: 8) {
                Grid(horizontalSpacing: 0, verticalSpacing: 4) {
                    GridRow { digit("1"); digit("2"); digit("3") }
                    GridRow { digit("4"); digit("5"); digit("6") }
                    GridRow { digit("7"); digit("8"); digit("9") }
                    GridRow {
                        if field.allowsDecimal { digit(".") } else { Color.clear.frame(height: Self.keyHeight) }
                        digit("0")
                        key(.backspace, accessibility: "Delete") { Image(systemName: "delete.left") }
                    }
                }
                VStack(spacing: 4) {
                    sideKey(.dismiss, accessibility: "Hide keypad") { Image(systemName: "keyboard.chevron.compact.down") }
                    if field.isWeight {
                        HStack(spacing: 4) {
                            sideKey(.decrement, accessibility: "Decrease weight") { Image(systemName: "minus") }
                            sideKey(.increment, accessibility: "Increase weight") { Image(systemName: "plus") }
                        }
                    }
                    if field.isReps { partialToggle }
                    confirmKey
                }
                .frame(width: 120)
            }
            .padding(8)
        }
        .font(AppFont.title(22))
        .foregroundStyle(Theme.textPrimary)
        .background(Theme.header)
    }

    private var rirChips: some View {
        HStack {
            ForEach([0, 1, 2, 3, 4, 5, 6], id: \.self) { chip($0) }
            chip(nil)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    private func chip(_ value: Int?) -> some View {
        Button { onKey(.rir(value)) } label: {
            RIRBadge(rir: value)
                .padding(3)
                .overlay { if value == rir { Circle().strokeBorder(Theme.textPrimary, lineWidth: 2) } }
        }
        .frame(maxWidth: .infinity)
        .accessibilityLabel(value.map { "RIR \($0 >= 6 ? "6+" : "\($0)")" } ?? "RIR unknown")
    }

    /// F | P: full reps or partial reps.
    private var partialToggle: some View {
        HStack(spacing: 0) {
            partialHalf(false, "F")
            partialHalf(true, "P")
        }
        .frame(height: Self.keyHeight)
        .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Partial reps")
    }

    private func partialHalf(_ value: Bool, _ title: String) -> some View {
        Button { onKey(.partial(value)) } label: {
            Text(title)
                .font(AppFont.headline(17))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .foregroundStyle(partial == value ? .black : Theme.textPrimary)
                .background(partial == value ? Theme.textPrimary : .clear, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
        }
        .accessibilityLabel(value ? "Partial reps" : "Full reps")
        .accessibilityAddTraits(partial == value ? .isSelected : [])
    }

    private var confirmKey: some View {
        let isNext = !field.isReps
        return Button { onKey(isNext ? .next : .done) } label: {
            Image(systemName: isNext ? "arrow.right" : "checkmark")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .foregroundStyle(.black)
                .background(Theme.textPrimary, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
        }
        .frame(height: Self.keyHeight * 2 + 4)
        .accessibilityLabel(isNext ? "Next field" : "Log set")
    }

    private func digit(_ character: Character) -> some View {
        key(.character(character), accessibility: String(character)) { Text(String(character)) }
    }

    private func key(_ key: KeypadKey, accessibility: String, @ViewBuilder label: () -> some View) -> some View {
        Button { onKey(key) } label: {
            label().frame(maxWidth: .infinity).frame(height: Self.keyHeight).contentShape(Rectangle())
        }
        .accessibilityLabel(accessibility)
    }

    private func sideKey(_ key: KeypadKey, accessibility: String, @ViewBuilder label: () -> some View) -> some View {
        Button { onKey(key) } label: {
            label()
                .frame(maxWidth: .infinity).frame(height: Self.keyHeight)
                .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
        }
        .accessibilityLabel(accessibility)
    }
}
