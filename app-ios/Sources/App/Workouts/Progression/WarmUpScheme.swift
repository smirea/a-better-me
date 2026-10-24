import Foundation

/// The Scheme warm-up: each step is a percent of the first working weight, from `WarmUpSettings.schemes` or an exercise's override.
enum WarmUpScheme {
    struct Step: Hashable {
        var percent: Int
        var reps: Int
        var weight: Double
    }

    /// `workingWeight` and `loadable` share one display unit. Each step snaps to the nearest loadable weight; a step
    /// that lands at or above the working weight, or on an earlier step's weight, is dropped.
    static func sets(workingWeight: Double, loadable: LoadableWeights, steps: [WarmUpStep]) -> [Step] {
        var seen = Set<Double>()
        return steps.compactMap { step in
            let weight = loadable.nearest(workingWeight * Double(step.percent) / 100)
            guard weight < workingWeight - 0.005, seen.insert(weight).inserted else { return nil }
            return Step(percent: step.percent, reps: step.reps, weight: weight)
        }
    }

    static func increment(for unit: WeightUnit) -> Double { unit == .kg ? 2.5 : 5 }
}
