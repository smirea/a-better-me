import Foundation
import GRDB

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
}

struct CycleTargets: Codable, Hashable {
    var sets: [WorkoutSet]
    var skip = false
}

extension BlockExercise {
    /// Rest after one of this exercise's sets, through the four levels in docs/decisions/workouts.md.
    func restSeconds(after set: WorkoutSet, exercise: Exercise?, settings: ExerciseSettings?, defaults: AppSettings) -> Int {
        set.restSeconds ?? defaultRestSeconds(exercise: exercise, settings: settings, defaults: defaults)
    }

    /// What a set rests when it has no rest of its own: the value "Set Rest Timers" starts from.
    func defaultRestSeconds(exercise: Exercise?, settings: ExerciseSettings?, defaults: AppSettings) -> Int {
        restSeconds ?? settings?.restSeconds ?? defaults.restSeconds(exercise?.restCategory ?? .upperIsolation)
    }
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

/// A row of the synced `workout_templates` table (docs/decisions/sync.md). Edits go through `LocalStore`.
struct WorkoutTemplate: SyncedRecord {
    static let table = "workout_templates"

    var id: UUID
    var name: String
    var notes: String
    var createdAt: Date
    var updatedAt: Date
    var blocks: [WorkoutBlock]
    var programID: UUID?
    var gymID: UUID?
    var isArchived = false

    init(name: String, notes: String = "", blocks: [WorkoutBlock] = []) {
        id = UUID()
        self.name = name
        self.notes = notes
        createdAt = .now
        updatedAt = .now
        self.blocks = blocks
    }

    init(row: Row) throws {
        id = try row.uuid("id")
        name = row["name"]
        notes = row["notes"] ?? ""
        createdAt = try row.instant("created_at")
        updatedAt = try row.instant("updated_at")
        blocks = try row.json("blocks")
        programID = (row["program_id"] as String?).flatMap(UUID.init(uuidString:))
        gymID = (row["gym_id"] as String?).flatMap(UUID.init(uuidString:))
        isArchived = row.flag("archived")
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = key
        container["name"] = name
        container["notes"] = notes
        container["created_at"] = Instant.text(createdAt)
        container["updated_at"] = Instant.text(updatedAt)
        container["blocks"] = try RowJSON.text(blocks)
        container["program_id"] = programID.map(Self.key)
        container["gym_id"] = gymID.map(Self.key)
        container["archived"] = isArchived ? 1 : 0
    }
}

/// A row of the synced `workout_sessions` table. `endedAt` is `nil` while the workout is in progress, and at most one is.
struct WorkoutSession: SyncedRecord {
    static let table = "workout_sessions"

    var id: UUID
    var name: String
    var templateID: UUID?
    var startedAt: Date
    var endedAt: Date?
    var notes: String
    var blocks: [WorkoutBlock]
    var program: ProgramPosition?
    var gymID: UUID?
    var pausedSeconds = 0

    init(name: String, templateID: UUID? = nil, blocks: [WorkoutBlock] = [], startedAt: Date = .now) {
        id = UUID()
        self.name = name
        self.templateID = templateID
        self.startedAt = startedAt
        notes = ""
        self.blocks = blocks
    }

    init(startingFrom template: WorkoutTemplate) {
        self.init(name: template.name, templateID: template.id, blocks: template.blocks)
    }

    init(startingFrom template: WorkoutTemplate, at position: ProgramPosition, gymID: UUID?) {
        self.init(name: template.name, templateID: template.id, blocks: template.blocks.targets(forCycle: position.cycle))
        program = position
        self.gymID = gymID
    }

    init(row: Row) throws {
        id = try row.uuid("id")
        name = row["name"]
        templateID = (row["template_id"] as String?).flatMap(UUID.init(uuidString:))
        startedAt = try row.instant("started_at")
        endedAt = try row.instant("ended_at", optional: true)
        notes = row["notes"] ?? ""
        blocks = try row.json("blocks")
        if let programID = (row["program_id"] as String?).flatMap(UUID.init(uuidString:)),
           let dayID = (row["program_day_id"] as String?).flatMap(UUID.init(uuidString:)),
           let cycle: Int = row["cycle"] {
            program = ProgramPosition(programID: programID, dayID: dayID, cycle: cycle)
        }
        gymID = (row["gym_id"] as String?).flatMap(UUID.init(uuidString:))
        pausedSeconds = row["paused_seconds"] ?? 0
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = key
        container["name"] = name
        container["template_id"] = templateID.map(Self.key)
        container["started_at"] = Instant.text(startedAt)
        container["ended_at"] = endedAt.map(Instant.text)
        container["notes"] = notes
        container["blocks"] = try RowJSON.text(blocks)
        container["program_id"] = program.map { Self.key($0.programID) }
        container["program_day_id"] = program.map { Self.key($0.dayID) }
        container["cycle"] = program?.cycle
        container["gym_id"] = gymID.map(Self.key)
        container["paused_seconds"] = pausedSeconds
    }

    var isInProgress: Bool { endedAt == nil }
}

/// A row of the synced `custom_exercises` table: the whole `Exercise` as JSON, keyed by its `custom-` id.
struct CustomExercise: SyncedRecord {
    static let table = "custom_exercises"

    var id: ExerciseID
    var exercise: Exercise
    /// Hidden from the picker and the library's All tab, but still resolved for history.
    var isArchived = false

    init(_ exercise: Exercise) {
        precondition(exercise.isCustom, "Custom exercise IDs start with custom-")
        id = exercise.id
        self.exercise = exercise
    }

    init(row: Row) throws {
        id = row["id"]
        exercise = try row.json("exercise")
        isArchived = row.flag("is_archived")
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = id
        container["exercise"] = try RowJSON.text(exercise)
        container["is_archived"] = isArchived ? 1 : 0
    }
}

/// The owner's per-exercise settings from Exercise Settings: the pinned note shown every workout, the rest override,
/// Do Not Recommend, and the Exercise Overrides. Keyed by the exercise id, so two devices editing one exercise offline
/// converge on one row.
struct ExerciseSettings: SyncedRecord {
    static let table = "exercise_settings"

    var id: ExerciseID
    var pinnedNote: String
    var restSeconds: Int?
    var doNotRecommend = false
    var overrides = ExerciseOverrides()

    init(id: ExerciseID, pinnedNote: String = "", restSeconds: Int? = nil) {
        self.id = id
        self.pinnedNote = pinnedNote
        self.restSeconds = restSeconds
    }

    init(row: Row) throws {
        id = row["id"]
        pinnedNote = row["pinned_note"] ?? ""
        restSeconds = row["rest_seconds"]
        doNotRecommend = row.flag("do_not_recommend")
        overrides = row.json("overrides", over: ExerciseOverrides())
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = id
        container["pinned_note"] = pinnedNote
        container["rest_seconds"] = restSeconds
        container["do_not_recommend"] = doNotRecommend ? 1 : 0
        container["overrides"] = try RowJSON.text(overrides)
    }
}

extension ExerciseSettings {
    static func of(_ exerciseID: ExerciseID, in settings: [ExerciseSettings]) -> ExerciseSettings? {
        settings.first { $0.id == exerciseID }
    }
}
