import Foundation

/// One exercise's numbers in one session, from its logged sets.
struct ExerciseStats: Equatable {
    var volumeKg: Double = 0
    var bestReps: Int?
    var bestOneRepMaxKg: Double?
    var loggedSets = 0

    func value(_ kind: ExerciseRecord.Kind) -> Double? {
        switch kind {
        case .volume: volumeKg > 0 ? volumeKg : nil
        case .reps: bestReps.map(Double.init)
        case .oneRepMax: bestOneRepMaxKg
        }
    }
}

struct ExerciseRecord: Hashable, Identifiable {
    enum Kind: CaseIterable {
        case volume, reps, oneRepMax

        var title: String {
            switch self {
            case .volume: "Volume Record"
            case .reps: "Reps Record"
            case .oneRepMax: "1-RM Record"
            }
        }

        var icon: String {
            switch self {
            case .volume: "trophy.fill"
            case .reps: "seal.fill"
            case .oneRepMax: "medal.fill"
            }
        }
    }

    var exerciseID: ExerciseID
    var kind: Kind
    var value: Double
    /// The best before this session, or `nil` the first time ("New!").
    var previousBest: Double?

    var id: String { "\(exerciseID)-\(kind)" }
    var gain: Double? { previousBest.map { value / $0 - 1 } }
}

/// The Workout Complete records: an exercise's volume, best reps, and best estimated 1-RM against every earlier session.
enum SessionRecords {
    static func stats(of items: [BlockExercise], exercise: Exercise) -> ExerciseStats {
        var stats = ExerciseStats()
        for set in items.flatMap(\.sets) where set.isCompleted {
            stats.volumeKg += WorkoutMetrics.volumeKg(of: set, exercise: exercise)
            stats.loggedSets += 1
            guard set.type != .warmUp, let log = set.log, let reps = log.reps else { continue }
            stats.bestReps = max(stats.bestReps ?? 0, reps)
            if let weight = log.weightKg, weight > 0 {
                let estimate = WorkoutMetrics.estimatedOneRepMaxKg(weightKg: weight, reps: reps, rir: log.rir)
                stats.bestOneRepMaxKg = max(stats.bestOneRepMaxKg ?? 0, estimate)
            }
        }
        return stats
    }

    /// Stats per exercise. An exercise listed twice in one session counts as one.
    static func stats(in blocks: [WorkoutBlock], catalog: (ExerciseID) -> Exercise?) -> [ExerciseID: ExerciseStats] {
        let items = Dictionary(grouping: blocks.flatMap(\.exercises), by: \.exerciseID)
        return items.reduce(into: [:]) { result, entry in
            guard let exercise = catalog(entry.key) else { return }
            let stats = stats(of: entry.value, exercise: exercise)
            if stats.loggedSets > 0 { result[entry.key] = stats }
        }
    }

    /// Each exercise's best value of each kind over `earlier` sessions' blocks.
    static func bests(in earlier: [[WorkoutBlock]], catalog: (ExerciseID) -> Exercise?) -> [ExerciseID: [ExerciseRecord.Kind: Double]] {
        var bests: [ExerciseID: [ExerciseRecord.Kind: Double]] = [:]
        for blocks in earlier {
            for (id, stats) in stats(in: blocks, catalog: catalog) {
                for kind in ExerciseRecord.Kind.allCases {
                    guard let value = stats.value(kind) else { continue }
                    bests[id, default: [:]][kind] = max(bests[id]?[kind] ?? value, value)
                }
            }
        }
        return bests
    }

    /// Records in `blocks` beaten against the `bests` of earlier sessions, in the session's exercise order.
    static func records(in blocks: [WorkoutBlock], bests: [ExerciseID: [ExerciseRecord.Kind: Double]], catalog: (ExerciseID) -> Exercise?) -> [ExerciseRecord] {
        let current = stats(in: blocks, catalog: catalog)
        var seen = Set<ExerciseID>()
        let order = blocks.flatMap(\.exercises).map(\.exerciseID).filter { seen.insert($0).inserted }
        return order.flatMap { id -> [ExerciseRecord] in
            guard let stats = current[id] else { return [] }
            return ExerciseRecord.Kind.allCases.compactMap { kind in
                guard let value = stats.value(kind) else { return nil }
                let best = bests[id]?[kind]
                if let best, value <= best { return nil }
                return ExerciseRecord(exerciseID: id, kind: kind, value: value, previousBest: best)
            }
        }
    }
}

/// "View Changes": what Update Workout Plan would change in the template, matched by the workout exercise's ID,
/// which a session keeps from the template it started from.
struct WorkoutChanges {
    /// The sections of the Workout Changes sheet, each with its own Undo.
    enum Kind: Hashable, CaseIterable {
        case added, modified, removed, regrouped
    }

    var added: [BlockExercise] = []
    var modified: [(before: BlockExercise, after: BlockExercise)] = []
    var removed: [BlockExercise] = []
    /// Supersets and circuits whose membership the session changed.
    var regrouped: [WorkoutBlock] = []

    var isEmpty: Bool { added.isEmpty && modified.isEmpty && removed.isEmpty && regrouped.isEmpty }

    init(before: [WorkoutBlock], after: [WorkoutBlock]) {
        let old = before.flatMap(\.exercises)
        let new = after.flatMap(\.exercises)
        let oldByID = Dictionary(uniqueKeysWithValues: old.map { ($0.id, $0) })
        let newIDs = Set(new.map(\.id))
        for item in new {
            if let previous = oldByID[item.id] {
                if previous != item { modified.append((previous, item)) }
            } else {
                added.append(item)
            }
        }
        removed = old.filter { !newIDs.contains($0.id) }
        let oldGroups = Set(before.map { $0.exercises.map(\.id) })
        regrouped = after.filter { $0.isSuperset && !oldGroups.contains($0.exercises.map(\.id)) }
    }
}
