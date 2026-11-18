import Foundation

/// A warm-up row: its percent of the ladder's base weight, its reps, and the loadable weight it lands on.
struct WarmUpSet: Hashable {
    var percent: Int
    var reps: Int
    var weight: Double
}

/// Both warm-ups climb a ladder of percents of a base weight in the display unit of `workingWeight`: each step snaps
/// to the nearest loadable weight and is kept only below the working weight and once per weight, the lighter step
/// keeping a weight two steps snap to.
func warmUpLadder(_ steps: [(percent: Int, reps: Int)], base: Double, below workingWeight: Double, loadable: LoadableWeights) -> [WarmUpSet] {
    var seen = Set<Double>()
    return steps.compactMap { step in
        let weight = loadable.nearest(base * Double(step.percent) / 100)
        guard weight < workingWeight - 0.005, seen.insert(weight).inserted else { return nil }
        return WarmUpSet(percent: step.percent, reps: step.reps, weight: weight)
    }
}

/// The Scheme warm-up: each step is a percent of the first working weight, from `WarmUpSettings.schemes` or an exercise's override.
enum WarmUpScheme {
    static func sets(workingWeight: Double, loadable: LoadableWeights, steps: [WarmUpStep]) -> [WarmUpSet] {
        warmUpLadder(steps.map { ($0.percent, $0.reps) }, base: workingWeight, below: workingWeight, loadable: loadable)
    }
}
