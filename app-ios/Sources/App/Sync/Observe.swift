import GRDB
import SwiftUI

/// What a screen observes: a fetch over the local database and the value shown until the first read lands.
struct DatabaseQuery<Value: Sendable & Equatable>: Sendable {
    let placeholder: Value
    let fetch: @Sendable (Database) throws -> Value

    init(_ placeholder: Value, _ fetch: @escaping @Sendable (Database) throws -> Value) {
        self.placeholder = placeholder
        self.fetch = fetch
    }
}

/// `@Observe(WorkoutTemplate.all) var templates`: the query's value, re-read whenever a local write or a sync changes
/// a table it reads. The first value is read synchronously, so the first frame shows the data.
@propertyWrapper
struct Observe<Value: Sendable & Equatable>: DynamicProperty {
    @Environment(LocalStore.self) private var store
    @State private var tracker = Tracker<Value>()
    private let query: DatabaseQuery<Value>

    init(_ query: DatabaseQuery<Value>) {
        self.query = query
    }

    var wrappedValue: Value { MainActor.assumeIsolated { tracker.value } ?? query.placeholder }

    func update() {
        MainActor.assumeIsolated { tracker.start(query, in: store) }
    }
}

@MainActor @Observable
private final class Tracker<Value: Sendable & Equatable> {
    nonisolated init() {}

    var value: Value?
    @ObservationIgnored private var cancellable: AnyDatabaseCancellable?

    func start(_ query: DatabaseQuery<Value>, in store: LocalStore) {
        guard cancellable == nil else { return }
        cancellable = ValueObservation.tracking(query.fetch).removeDuplicates().start(
            in: store.database.pool,
            scheduling: .immediate,
            onError: { LocalStore.log.error("Observation failed: \(String(describing: $0))") },
            onChange: { [weak self] in self?.value = $0 }
        )
    }
}

extension WorkoutTemplate {
    static let all = DatabaseQuery([WorkoutTemplate]()) { db in
        try WorkoutTemplate.fetchAll(db).sorted { $0.createdAt < $1.createdAt }
    }

    static func one(_ id: UUID) -> DatabaseQuery<WorkoutTemplate?> {
        DatabaseQuery(nil) { try WorkoutTemplate.fetchOne($0, key: key(id)) }
    }
}

extension WorkoutSession {
    /// Finished sessions, newest first.
    static let finished = DatabaseQuery([WorkoutSession]()) { db in
        try WorkoutSession.filter(Column("ended_at") != nil).fetchAll(db).sorted { $0.startedAt > $1.startedAt }
    }

    static let inProgress = DatabaseQuery(WorkoutSession?.none) { db in
        try WorkoutSession.filter(Column("ended_at") == nil).fetchAll(db).min { $0.startedAt < $1.startedAt }
    }

    static func one(_ id: UUID) -> DatabaseQuery<WorkoutSession?> {
        DatabaseQuery(nil) { try WorkoutSession.fetchOne($0, key: key(id)) }
    }

    /// Finished sessions that started before `session`, newest first: the history its Previous column and records read.
    static func earlier(than session: WorkoutSession, _ db: Database) throws -> [WorkoutSession] {
        try finished.fetch(db).filter { $0.startedAt < session.startedAt && $0.id != session.id }
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

extension AppSettings {
    static let current = DatabaseQuery(AppSettings()) { try AppSettings.fetchOne($0, key: rowID) ?? AppSettings() }
}
