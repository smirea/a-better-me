import Foundation

/// One row's Smart Progression result, in the display unit the caller asked for. `weight`, `repsMin`, `repsMax` and
/// `rir` are the Auto column (the suggested weight against the planned target); `adjustedReps` is the range Expand Rep
/// Range substituted for the target, and `prefill` is what the inputs start with.
struct SetSuggestion: Hashable {
    struct Values: Hashable {
        var weight: Double?
        var reps: Int?
        var rir: Int?
    }

    var weight: Double?
    var repsMin: Int?
    var repsMax: Int?
    var rir: Int?
    var adjustedReps: ClosedRange<Int>?
    var prefill = Values()

    var isEmpty: Bool { weight == nil && repsMin == nil && repsMax == nil }

    /// "40 lb x 8 / 0 RIR", "30 lb x 8-12 / 2 RIR", "20 lb / 0 RIR".
    func autoText(unit: WeightUnit) -> String? {
        var parts: [String] = []
        if let weight { parts.append("\(SetSuggestion.format(weight)) \(unit.rawValue)") }
        if let reps = SetSuggestion.repsText(min: repsMin, max: repsMax) { parts.append("x \(reps)") }
        guard !parts.isEmpty else { return nil }
        if let rir { parts.append("/ \(rir) RIR") }
        return parts.joined(separator: " ")
    }

    static func repsText(min: Int?, max: Int?) -> String? {
        switch (min, max) {
        case let (lo?, hi?) where lo != hi: "\(lo)-\(hi)"
        case let (lo?, _): "\(lo)"
        case let (nil, hi?): "\(hi)"
        case (nil, nil): nil
        }
    }

    static func format(_ weight: Double) -> String {
        weight.formatted(.number.precision(.fractionLength(0...2)))
    }
}

/// An Event Log entry in the Smart Progression sheet: the values the working rows were filled with, and when.
struct ProgressionEvent: Hashable {
    struct Row: Hashable {
        /// The set circle and number: "D Set 1", "2 Set 2".
        var label: String
        var weight: Double?
        var reps: Int?
        var rir: Int?

        /// "40 lb x 9 (0)".
        func text(unit: WeightUnit) -> String {
            var parts: [String] = []
            if let weight { parts.append("\(SetSuggestion.format(weight)) \(unit.rawValue)") }
            if let reps { parts.append(parts.isEmpty ? "\(reps)" : "x \(reps)") }
            if let rir { parts.append("(\(rir))") }
            return parts.joined(separator: " ")
        }
    }

    var at: Date
    var rows: [Row]
}

enum SmartProgression {
    /// The reps a set could have reached at that weight: the reps done plus the reps in reserve.
    static func repsToFailure(_ log: SetLog) -> Double? {
        log.reps.map { Double($0 + (log.rir ?? 0)) }
    }

    /// MF's prefills (30 x 12 @2 -> 40 x 9 @0, 35 x 10 @1 -> 30 x 12 @2) are reproduced by a linear trade of one rep per
    /// fifteenth of the weight; Epley and Brzycki both land a plateful lighter on the first case.
    static let repsPerWeightFraction = 15.0

    static func predictedRepsToFailure(at weight: Double, previousWeight: Double, previousRepsToFailure: Double) -> Double {
        previousRepsToFailure - repsPerWeightFraction * (weight - previousWeight) / previousWeight
    }

    /// Initial fill: a suggestion for every row of `sets`, keyed by set or sub-row id. `previous` is the exercise's last
    /// performance, matched row by row like the Previous column. Weights in the result are in `unit`.
    static func suggest(sets: [WorkoutSet], previous: [WorkoutSet], settings: ProgressionSettings, increment: Double, rirTracking: Bool, unit: WeightUnit) -> [UUID: SetSuggestion] {
        compute(sets: sets, settings: settings, increment: increment, rirTracking: rirTracking, unit: unit) { index in
            sets.previousSet(at: index, in: previous)?.log
        }
    }

    /// Apply in session: the unlogged rows of an exercise, recomputed from its most recently logged set. Returns only
    /// the rows whose suggestion differs from `current`, so the caller can merge them and log the change.
    static func applyInSession(sets: [WorkoutSet], current: [UUID: SetSuggestion], settings: ProgressionSettings, increment: Double, rirTracking: Bool, unit: WeightUnit) -> [UUID: SetSuggestion] {
        guard let latest = sets.compactMap(\.log).max(by: { $0.completedAt < $1.completedAt }) else { return [:] }
        let fresh = compute(sets: sets, settings: settings, increment: increment, rirTracking: rirTracking, unit: unit) { _ in latest }
        let openRows = Set(sets.filter { !$0.isCompleted }.flatMap { [$0.id] + $0.subSets.filter { $0.log == nil }.map(\.id) })
        return fresh.filter { openRows.contains($0.key) && current[$0.key] != $0.value }
    }

    /// The Event Log rows for the main rows of `sets` that have a suggestion, in set order.
    static func event(at date: Date, sets: [WorkoutSet], suggestions: [UUID: SetSuggestion]) -> ProgressionEvent {
        let rows = sets.indices.compactMap { index -> ProgressionEvent.Row? in
            let set = sets[index]
            guard let suggestion = suggestions[set.id], !suggestion.isEmpty else { return nil }
            let number = sets.number(at: index)
            return ProgressionEvent.Row(
                label: "\(set.type.badge ?? String(number)) Set \(number)",
                weight: suggestion.prefill.weight, reps: suggestion.prefill.reps, rir: suggestion.prefill.rir
            )
        }
        return ProgressionEvent(at: date, rows: rows)
    }

    private struct Performance {
        var weight: Double
        var repsToFailure: Double
    }

    private static func compute(sets: [WorkoutSet], settings: ProgressionSettings, increment: Double, rirTracking: Bool, unit: WeightUnit, previousLog: (Int) -> SetLog?) -> [UUID: SetSuggestion] {
        var result: [UUID: SetSuggestion] = [:]
        var prior: SetSuggestion?
        for (index, set) in sets.enumerated() {
            let previous = previousLog(index)
            var suggestion: SetSuggestion
            if let log = set.log {
                suggestion = SetSuggestion(weight: log.weightKg.map(unit.fromKg), repsMin: log.reps, repsMax: log.reps, rir: log.rir)
            } else {
                suggestion = suggest(set: set, previous: previous, prior: prior, settings: settings, increment: increment, rirTracking: rirTracking, unit: unit)
            }
            result[set.id] = suggestion
            for sub in set.subSets {
                var row = SetSuggestion(rir: suggestion.prefill.rir)
                row.weight = suggestion.weight.map { set.type == .drop ? (($0 / 2) / increment).rounded() * increment : $0 }
                row.prefill = SetSuggestion.Values(weight: row.weight, reps: nil, rir: row.rir)
                result[sub.id] = row
            }
            prior = suggestion
        }
        return result
    }

    private static func suggest(set: WorkoutSet, previous: SetLog?, prior: SetSuggestion?, settings: ProgressionSettings, increment: Double, rirTracking: Bool, unit: WeightUnit) -> SetSuggestion {
        let target = set.target
        let targetRir = target?.rir
        let repsMin = target?.repsMin ?? target?.repsMax
        let repsMax = target?.repsMax ?? target?.repsMin
        var suggestion = SetSuggestion(repsMin: repsMin, repsMax: repsMax, rir: targetRir)
        let rir = rirTracking ? (targetRir ?? previous?.rir) : (previous?.rir ?? targetRir)

        if let repsMin, let repsMax, let previous, let previousWeight = previous.weightKg.map(unit.fromKg), let rtf0 = repsToFailure(previous) {
            let performance = Performance(weight: previousWeight, repsToFailure: rtf0)
            let range = Double(repsMin + (targetRir ?? 0))...Double(repsMax + (targetRir ?? 0))
            var weight = heaviestWeight(reaching: (range.lowerBound + range.upperBound) / 2, from: performance, increment: increment)
            if settings.weightMatch, let matched = prior?.weight,
               range.contains(predictedRepsToFailure(at: matched, previousWeight: performance.weight, previousRepsToFailure: performance.repsToFailure)) {
                weight = matched
            }
            let predictedReps = Int((predictedRepsToFailure(at: weight, previousWeight: performance.weight, previousRepsToFailure: performance.repsToFailure) - Double(targetRir ?? 0)).rounded())
            if settings.expandRepRange {
                if predictedReps > repsMax { suggestion.adjustedReps = repsMin...predictedReps }
                if predictedReps < repsMin { suggestion.adjustedReps = predictedReps...repsMax }
            }
            suggestion.weight = weight
            suggestion.prefill = SetSuggestion.Values(weight: weight, reps: suggestion.adjustedReps?.upperBound ?? repsMax, rir: rir)
        } else if let weight = target?.weightKg.map(unit.fromKg) {
            suggestion.weight = weight
            suggestion.prefill = SetSuggestion.Values(weight: weight, reps: repsMax, rir: rir)
        } else if let previous, previous.weightKg != nil || previous.reps != nil {
            suggestion.weight = previous.weightKg.map(unit.fromKg)
            if repsMax == nil {
                suggestion.repsMin = previous.reps
                suggestion.repsMax = previous.reps
            }
            suggestion.prefill = SetSuggestion.Values(weight: suggestion.weight, reps: repsMax ?? previous.reps, rir: rir)
        } else if let weight = prior?.weight {
            suggestion.weight = weight
            suggestion.prefill = SetSuggestion.Values(weight: weight, reps: repsMax, rir: rir)
        } else {
            suggestion.prefill = SetSuggestion.Values(weight: nil, reps: repsMax, rir: rir)
        }
        return suggestion
    }

    /// The heaviest multiple of `increment` whose predicted reps to failure still reach `aim`; at least one increment.
    private static func heaviestWeight(reaching aim: Double, from performance: Performance, increment: Double) -> Double {
        let ceiling = performance.weight * (1 + (performance.repsToFailure - aim) / repsPerWeightFraction)
        return max(increment, (ceiling / increment + 1e-9).rounded(.down) * increment)
    }
}

extension [WorkoutSet] {
    /// The set of a previous performance that matches the set at `index`. Warm-ups match warm-ups and working sets
    /// match working sets by order, so adding warm-ups doesn't shift every row's Previous.
    func previousSet(at index: Int, in previous: [WorkoutSet]) -> WorkoutSet? {
        let isWarmUp = self[index].type == .warmUp
        let ordinal = self[..<index].count { ($0.type == .warmUp) == isWarmUp }
        return previous.filter { ($0.type == .warmUp) == isWarmUp }[safe: ordinal]
    }
}
