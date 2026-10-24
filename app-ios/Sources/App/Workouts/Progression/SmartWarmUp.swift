import Foundation

/// The Smart warm-up: a fixed ladder of 1-RM percentages below the first working set, where the 1-RM is estimated from
/// that set's suggested weight and target.
enum SmartWarmUp {
    struct Step: Hashable {
        var percent: Int
        var weight: Double
        var reps: Int
    }

    static let ladder = [(percent: 40, reps: 8), (percent: 63, reps: 5), (percent: 80, reps: 3), (percent: 90, reps: 1)]

    /// Steps in the display unit of `workingWeight`, each snapped to the nearest loadable weight, kept only while they
    /// stay below the working weight, and once per weight: the lighter percentage keeps a weight two steps snap to. A
    /// muscle already warmed up earlier in the session (`isFresh == false`) skips the lightest step.
    static func steps(workingWeight: Double, reps: Int, rir: Int?, loadable: LoadableWeights, isFresh: Bool) -> [Step] {
        let oneRepMax = WorkoutMetrics.estimatedOneRepMaxKg(weightKg: workingWeight, reps: reps, rir: rir)
        let steps = ladder.dropFirst(isFresh ? 0 : 1).map { step in
            Step(percent: step.percent, weight: loadable.nearest(oneRepMax * Double(step.percent) / 100), reps: step.reps)
        }
        var seen = Set<Double>()
        return steps.prefix { $0.weight < workingWeight - 0.005 }.filter { seen.insert($0.weight).inserted }
    }
}
