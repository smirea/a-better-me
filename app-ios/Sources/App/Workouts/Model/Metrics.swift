import Foundation

/// Derived numbers that several screens show (builder Target Muscles, the summary, exercise history, Levels).
/// Pure functions over the model, so every screen agrees and they can be tested apart from views.
enum WorkoutMetrics {
    /// Sets per muscle. A primary muscle counts 1 per working set and a secondary 0.5, as in MF. Warm-ups don't count,
    /// and a drop or myo set counts once however many sub-rows it has. Pass `loggedOnly` for sessions.
    static func muscleSets(in blocks: [WorkoutBlock], catalog: (ExerciseID) -> Exercise?, loggedOnly: Bool) -> [Muscle: Double] {
        var sets: [Muscle: Double] = [:]
        for block in blocks {
            for item in block.exercises {
                forEachMuscleSet(of: item, catalog: catalog, loggedOnly: loggedOnly) { sets[$0, default: 0] += $1 }
            }
        }
        return sets
    }

    /// `muscleSets` for one exercise, handing each muscle and its count to `add` instead of building a dictionary.
    static func forEachMuscleSet(of item: BlockExercise, catalog: (ExerciseID) -> Exercise?, loggedOnly: Bool, _ add: (Muscle, Double) -> Void) {
        guard let exercise = catalog(item.exerciseID) else { return }
        let count = Double(item.sets.count { $0.type != .warmUp && (!loggedOnly || $0.isCompleted) })
        guard count > 0 else { return }
        for muscle in exercise.primaryMuscles { add(muscle, count) }
        for muscle in exercise.secondaryMuscles { add(muscle, count * 0.5) }
    }

    /// Weight x reps over a set and its sub-rows, doubled for per-side metrics. Warm-ups count, as in MF's summary.
    /// Assistance weight is help, not load, so assisted exercises have no volume rather than one that grows as they get easier.
    static func volumeKg(of set: WorkoutSet, exercise: Exercise) -> Double {
        guard !exercise.metrics.contains(.assistanceWeight) else { return 0 }
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

    /// Inverse Epley: the weight liftable for `reps` given a 1-RM, so 3-RM and 10-RM agree with `estimatedOneRepMaxKg`.
    static func estimatedRepMaxKg(oneRepMaxKg: Double, reps: Int) -> Double {
        reps <= 1 ? oneRepMaxKg : oneRepMaxKg / (1 + Double(reps) / 30)
    }
}
