import Foundation

/// Derived numbers that several screens show (builder Target Muscles, the summary, exercise history, Levels).
/// Pure functions over the model, so every screen agrees and they can be tested apart from views.
enum WorkoutMetrics {
    /// Sets per muscle. A primary muscle counts 1 per working set and a secondary 0.5, as in MF. Warm-ups don't count,
    /// and a drop or myo set counts once however many sub-rows it has. Pass `loggedOnly` for sessions.
    static func muscleSets(in blocks: [WorkoutBlock], catalog: (ExerciseID) -> Exercise?, loggedOnly: Bool) -> [Muscle: Double] {
        var sets: [Muscle: Double] = [:]
        for item in blocks.flatMap(\.exercises) {
            guard let exercise = catalog(item.exerciseID) else { continue }
            let count = Double(item.sets.count { $0.type != .warmUp && (!loggedOnly || $0.isCompleted) })
            guard count > 0 else { continue }
            for muscle in exercise.primaryMuscles { sets[muscle, default: 0] += count }
            for muscle in exercise.secondaryMuscles { sets[muscle, default: 0] += count * 0.5 }
        }
        return sets
    }

    /// Weight x reps over a set and its sub-rows, doubled for per-side metrics. Warm-ups count, as in MF's summary.
    static func volumeKg(of set: WorkoutSet, exercise: Exercise) -> Double {
        let logs = [set.log] + set.subSets.map(\.log)
        let total = logs.compactMap { $0 }.reduce(0) { $0 + ($1.weightKg ?? 0) * Double($1.reps ?? 0) }
        return exercise.countsBothSides ? total * 2 : total
    }

    /// Epley on reps to failure (reps + RIR). MF never states its formula and its estimates match no standard one
    /// exactly (see the research spec's open questions), so this is a stand-in with the same inputs.
    static func estimatedOneRepMaxKg(weightKg: Double, reps: Int, rir: Int?) -> Double {
        let toFailure = Double(reps + (rir ?? 0))
        return toFailure <= 1 ? weightKg : weightKg * (1 + toFailure / 30)
    }
}
