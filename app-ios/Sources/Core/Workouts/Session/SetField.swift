import Foundation

/// One input column of the set table, chosen from the exercise's `metrics`.
enum SetField: Hashable {
    case weight(perSide: Bool)
    case reps(perSide: Bool)
    case duration(perSide: Bool)
    case distance(long: Bool)

    /// The exercise's columns, weight first then reps, duration, or distance, whatever order the catalog lists its metrics in:
    /// MF lists `repsPerSide` before `weightPerSide` on most dumbbell exercises. An exercise the catalog no longer knows logs weight and reps.
    static func fields(for exercise: Exercise?) -> [SetField] {
        guard let exercise else { return [.weight(perSide: false), .reps(perSide: false)] }
        return fields(for: exercise.metrics)
    }

    static func fields(for metrics: [ExerciseMetric]) -> [SetField] {
        var fields: [SetField] = []
        for metric in metrics {
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
        return fields.prefix(2).sorted { $0.column < $1.column }
    }

    private var column: Int {
        switch self {
        case .weight: 0
        case .reps: 1
        case .duration: 2
        case .distance: 3
        }
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
        case .weight: entry.weightKg.map { NumberText.plain(unit.fromKg($0)) } ?? ""
        case .reps: entry.reps.map(String.init) ?? ""
        case .duration: entry.durationSeconds.map(String.init) ?? ""
        case let .distance(long): entry.distanceMeters.map { NumberText.plain(long ? $0 / 1000 : $0) } ?? ""
        }
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
