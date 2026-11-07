import Foundation

/// The Smart warm-up: a fixed ladder of 1-RM percentages below the first working set, where the 1-RM is estimated from
/// that set's suggested weight and target.
enum SmartWarmUp {
    static let ladder = [(percent: 40, reps: 8), (percent: 63, reps: 5), (percent: 80, reps: 3), (percent: 90, reps: 1)]

    /// A muscle already warmed up earlier in the session (`isFresh == false`) skips the lightest step.
    static func steps(workingWeight: Double, reps: Int, rir: Int?, loadable: LoadableWeights, isFresh: Bool) -> [WarmUpSet] {
        let oneRepMax = WorkoutMetrics.estimatedOneRepMaxKg(weightKg: workingWeight, reps: reps, rir: rir)
        return warmUpLadder(Array(ladder.dropFirst(isFresh ? 0 : 1)), base: oneRepMax, below: workingWeight, loadable: loadable)
    }
}
