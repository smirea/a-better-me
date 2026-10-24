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

    /// Steps in the display unit of `workingWeight`, each rounded to `increment`, or to 5 kg / 10 lb with Simplify
    /// Warm-Up Plates, and kept only while they stay below the working weight. A muscle already warmed up earlier in
    /// the session (`isFresh == false`) skips the lightest step.
    static func steps(workingWeight: Double, reps: Int, rir: Int?, increment: Double, unit: WeightUnit, isFresh: Bool, simplifyPlates: Bool) -> [Step] {
        let oneRepMax = WorkoutMetrics.estimatedOneRepMaxKg(weightKg: workingWeight, reps: reps, rir: rir)
        let grain = simplifyPlates ? (unit == .kg ? 5.0 : 10.0) : increment
        let steps = ladder.map { step in
            let weight = (oneRepMax * Double(step.percent) / 100 / grain).rounded() * grain
            return Step(percent: step.percent, weight: weight, reps: step.reps)
        }
        return Array(steps.dropFirst(isFresh ? 0 : 1).prefix { $0.weight < workingWeight })
    }
}
