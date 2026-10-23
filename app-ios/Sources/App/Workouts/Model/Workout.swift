import Foundation
import SwiftData

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

enum SetType: String, Codable, CaseIterable {
    case standard, warmUp, drop, myo, failure

    var hasSubSets: Bool { self == .drop || self == .myo }
    /// Shown in the set circle instead of the set number.
    var badge: String? {
        switch self {
        case .standard: nil
        case .warmUp: "W"
        case .drop: "D"
        case .myo: "M"
        case .failure: "F"
        }
    }
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

@Model
final class WorkoutTemplate {
    @Attribute(.unique) var id: UUID
    var name: String
    var notes: String
    var createdAt: Date
    var updatedAt: Date
    /// JSON-encoded `[WorkoutBlock]`. SwiftData relationships are unordered and its Codable composites are fragile,
    /// so the ordered tree is stored as one value and edited through `blocks`.
    private var blocksData: Data

    init(name: String, notes: String = "", blocks: [WorkoutBlock] = []) {
        id = UUID()
        self.name = name
        self.notes = notes
        createdAt = .now
        updatedAt = .now
        blocksData = BlockCoding.encode(blocks)
    }

    var blocks: [WorkoutBlock] {
        get { BlockCoding.decode(blocksData) }
        set {
            blocksData = BlockCoding.encode(newValue)
            updatedAt = .now
        }
    }
}

@Model
final class WorkoutSession {
    @Attribute(.unique) var id: UUID
    var name: String
    var templateID: UUID?
    var startedAt: Date
    /// `nil` while the workout is in progress. At most one session is in progress.
    var endedAt: Date?
    var notes: String
    private var blocksData: Data

    init(name: String, templateID: UUID? = nil, blocks: [WorkoutBlock] = [], startedAt: Date = .now) {
        id = UUID()
        self.name = name
        self.templateID = templateID
        self.startedAt = startedAt
        notes = ""
        blocksData = BlockCoding.encode(blocks)
    }

    convenience init(startingFrom template: WorkoutTemplate) {
        self.init(name: template.name, templateID: template.id, blocks: template.blocks)
    }

    var blocks: [WorkoutBlock] {
        get { BlockCoding.decode(blocksData) }
        set { blocksData = BlockCoding.encode(newValue) }
    }

    var isInProgress: Bool { endedAt == nil }
}

@Model
final class CustomExercise {
    @Attribute(.unique) var id: ExerciseID
    private var exerciseData: Data

    init(_ exercise: Exercise) {
        precondition(exercise.isCustom, "Custom exercise IDs start with custom-")
        id = exercise.id
        exerciseData = try! JSONEncoder().encode(exercise)
    }

    var exercise: Exercise {
        get { try! JSONDecoder().decode(Exercise.self, from: exerciseData) }
        set { exerciseData = try! JSONEncoder().encode(newValue) }
    }
}

/// The owner's per-exercise settings from Exercise Settings: the pinned note shown every workout and the rest override.
@Model
final class ExerciseSettings {
    @Attribute(.unique) var id: ExerciseID
    var pinnedNote: String
    var restSeconds: Int?

    init(id: ExerciseID, pinnedNote: String = "", restSeconds: Int? = nil) {
        self.id = id
        self.pinnedNote = pinnedNote
        self.restSeconds = restSeconds
    }
}

enum BlockCoding {
    static func encode(_ blocks: [WorkoutBlock]) -> Data { try! JSONEncoder().encode(blocks) }
    static func decode(_ data: Data) -> [WorkoutBlock] { try! JSONDecoder().decode([WorkoutBlock].self, from: data) }
}

enum WorkoutSchema {
    static let models: [any PersistentModel.Type] = [WorkoutTemplate.self, WorkoutSession.self, CustomExercise.self, ExerciseSettings.self]
}
