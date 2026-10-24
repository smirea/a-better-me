import Foundation

/// The Scheme warm-up: each step is a percent of the first working weight, from `WarmUpSettings.schemes` or an exercise's override.
enum WarmUpScheme {
    struct Step: Hashable {
        var percent: Int
        var reps: Int
        var weight: Double
    }

    /// `workingWeight` and `increment` share one display unit, so warm-ups land on loadable weights in that unit.
    static func sets(workingWeight: Double, increment: Double, steps: [WarmUpStep]) -> [Step] {
        steps.map { step in
            let raw = workingWeight * Double(step.percent) / 100
            return Step(percent: step.percent, reps: step.reps, weight: max(increment, (raw / increment).rounded() * increment))
        }
    }

    static func increment(for unit: WeightUnit) -> Double { unit == .kg ? 2.5 : 5 }
}
