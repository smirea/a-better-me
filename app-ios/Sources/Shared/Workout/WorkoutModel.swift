import Foundation

typealias ExerciseID = String
typealias EquipmentID = String

/// A template and a session share this tree. A block with several exercises is a superset.
struct WorkoutBlock: Codable, Hashable, Identifiable {
    var id = UUID()
    var exercises: [BlockExercise]

    var isSuperset: Bool { exercises.count > 1 }
}

struct BlockExercise: Codable, Hashable, Identifiable {
    var id = UUID()
    var exerciseID: ExerciseID
    var sets: [WorkoutSet]
    /// Rest after each set of this exercise. `nil` falls back to `ExerciseSettings`, then the settings default for its `RestCategory`.
    var restSeconds: Int?
    /// The session note in a session, the template note in a template. The pinned note lives in `ExerciseSettings`.
    var note: String?
    /// Per-cycle targets in a program's template: index 0 is cycle 1, and a cycle past the end uses `sets`. `nil`
    /// outside programs. Optional, like every field added to the block tree, because synthesized `Decodable` requires
    /// every non-optional key and every stored tree predates it.
    var cycleTargets: [CycleTargets]?
    /// The resistance option the Equipment chip picked, as its equipment ids. `nil` uses the first one the gym has.
    var equipment: [EquipmentID]?
    /// The support option the Equipment sheet picked, the same way.
    var support: [EquipmentID]?
}

struct CycleTargets: Codable, Hashable {
    var sets: [WorkoutSet]
    var skip = false
}

extension [WorkoutBlock] {
    func targets(forCycle cycle: Int) -> [WorkoutBlock] {
        compactMap { block in
            var block = block
            block.exercises = block.exercises.compactMap { exercise in
                guard let targets = exercise.cycleTargets, targets.indices.contains(cycle - 1) else { return exercise }
                if targets[cycle - 1].skip { return nil }
                var exercise = exercise
                exercise.sets = targets[cycle - 1].sets
                return exercise
            }
            return block.exercises.isEmpty ? nil : block
        }
    }
}

extension [WorkoutSet] {
    /// The number in a set's circle. Warm-ups show "W", so working sets count from 1 after them: W, 1, 2, D.
    func number(at index: Int) -> Int { prefix(index + 1).count { $0.type != .warmUp } }
}

struct WorkoutSet: Codable, Hashable, Identifiable {
    var id = UUID()
    var type: SetType = .standard {
        didSet { if !type.hasSubSets { subSets = [] } }
    }
    var target: SetTarget?
    /// Overrides the exercise's rest after this set ("Set Rest Timers" in the targets sheet).
    var restSeconds: Int?
    /// What was actually done. Always `nil` in templates.
    var log: SetLog?
    /// The drops of a drop set or the mini-sets of a myo set. Always empty for other types.
    var subSets: [SubSet] = []

    var isCompleted: Bool { log != nil }
}

/// One indented "+" row under a drop or myo set. A drop lowers the weight; a myo row keeps it.
struct SubSet: Codable, Hashable, Identifiable {
    var id = UUID()
    var target: SetTarget?
    var log: SetLog?
}

struct SetTarget: Codable, Hashable {
    var repsMin: Int?
    var repsMax: Int?
    /// Reps in reserve. 6 means "6+".
    var rir: Int?
    var weightKg: Double?
    var durationSeconds: Int?
}

struct SetLog: Codable, Hashable {
    var weightKg: Double?
    var reps: Int?
    var partialReps: Int?
    var rir: Int?
    var durationSeconds: Int?
    var distanceMeters: Double?
    var completedAt: Date
}

struct ProgramPosition: Codable, Hashable, Sendable {
    var programID: UUID
    var dayID: UUID
    var cycle: Int
}
