import Foundation
import GRDB

extension WorkoutTemplate {
    static let all = DatabaseQuery([WorkoutTemplate]()) { db in
        try WorkoutTemplate.fetchAll(db).sorted { $0.createdAt < $1.createdAt }
    }

    static let library = DatabaseQuery([WorkoutTemplate]()) { db in
        try all.fetch(db).filter { $0.programID == nil && !$0.isArchived }
    }

    static let archived = DatabaseQuery([WorkoutTemplate]()) { db in
        try all.fetch(db).filter(\.isArchived)
    }

    static func one(_ id: UUID) -> DatabaseQuery<WorkoutTemplate?> {
        DatabaseQuery(nil) { try WorkoutTemplate.fetchOne($0, key: key(id)) }
    }
}

extension WorkoutSession {
    static let finished = DatabaseQuery([WorkoutSession]()) { db in
        try WorkoutSession.filter(Column("ended_at") != nil).fetchAll(db).sorted { $0.startedAt > $1.startedAt }
    }

    static let inProgress = DatabaseQuery(WorkoutSession?.none) { db in
        try WorkoutSession.filter(Column("ended_at") == nil).fetchAll(db).min { $0.startedAt < $1.startedAt }
    }

    /// For views that only show whether a session is in progress, so logging a set doesn't re-render them.
    static let inProgressID = DatabaseQuery(UUID?.none) { try inProgress.fetch($0)?.id }

    static func one(_ id: UUID) -> DatabaseQuery<WorkoutSession?> {
        DatabaseQuery(nil) { try WorkoutSession.fetchOne($0, key: key(id)) }
    }
}

extension CustomExercise {
    static let all = DatabaseQuery([CustomExercise]()) { try CustomExercise.fetchAll($0) }

    static func one(_ id: ExerciseID) -> DatabaseQuery<CustomExercise?> {
        DatabaseQuery(nil) { try CustomExercise.fetchOne($0, key: id) }
    }
}

extension ExerciseSettings {
    static let all = DatabaseQuery([ExerciseSettings]()) { try ExerciseSettings.fetchAll($0) }

    static func one(_ id: ExerciseID) -> DatabaseQuery<ExerciseSettings?> {
        DatabaseQuery(nil) { try ExerciseSettings.fetchOne($0, key: id) }
    }
}

extension Program {
    static let all = DatabaseQuery([Program]()) { db in
        try Program.fetchAll(db).sorted { $0.createdAt < $1.createdAt }
    }

    static let library = DatabaseQuery([Program]()) { db in
        try all.fetch(db).filter { !$0.isArchived }
    }

    static let archived = DatabaseQuery([Program]()) { db in
        try Program.fetchAll(db).filter(\.isArchived).sorted { $0.createdAt < $1.createdAt }
    }

    /// The active, unarchived program. If two are active (two devices activated offline), the one updated last.
    static let active = DatabaseQuery(Program?.none) { db in
        try library.fetch(db).filter(\.isActive).max { $0.updatedAt < $1.updatedAt }
    }

    static func one(_ id: UUID) -> DatabaseQuery<Program?> {
        DatabaseQuery(nil) { try Program.fetchOne($0, key: key(id)) }
    }
}

extension GymProfile {
    static let all = DatabaseQuery([GymProfile]()) { db in
        try GymProfile.fetchAll(db).sorted { $0.createdAt < $1.createdAt }
    }

    static let defaultGym = DatabaseQuery(GymProfile?.none) { db in try preferred(in: all.fetch(db)) }

    /// The default gym: the flagged one updated last, since two devices may flag different gyms offline, else the
    /// oldest gym.
    static func preferred(in gyms: [GymProfile]) -> GymProfile? {
        gyms.filter(\.isDefault).max { $0.updatedAt < $1.updatedAt } ?? gyms.min { $0.createdAt < $1.createdAt }
    }

    /// Where a session or template trains: its own gym, else the default for one without a gym or whose gym was removed.
    static func resolve(_ id: UUID?, in gyms: [GymProfile]) -> GymProfile? {
        gyms.first { $0.id == id } ?? preferred(in: gyms)
    }
}

extension GymProfile {
    var equipmentSummary: String { equipment.count == 1 ? "1 piece of equipment" : "\(equipment.count) pieces of equipment" }

    static func one(_ id: UUID) -> DatabaseQuery<GymProfile?> {
        DatabaseQuery(nil) { try GymProfile.fetchOne($0, key: key(id)) }
    }
}
