import Foundation
import GRDB
import Observation
import Synchronization

/// The finished workout history, newest first, for every screen. One observation reads it, and a session is decoded
/// again only when its row changed, so a write to the session in progress (or the sync echoing a write back) costs a
/// fetch of raw rows and no decoding. Screens derive values through `memo`, which recomputes once per change instead
/// of once per render.
@MainActor @Observable
final class SessionHistory {
    private(set) var sessions: [WorkoutSession] = []
    /// Bumps whenever `sessions` changes.
    private(set) var revision = 0

    @ObservationIgnored private var cancellable: AnyDatabaseCancellable?
    @ObservationIgnored private var memos: [AnyHashable: Any] = [:]
    @ObservationIgnored private var memoRevision = 0

    /// Reads synchronously once, so the first frame of every screen shows the history.
    init(store: LocalStore) {
        let decoder = Decoder()
        cancellable = ValueObservation.trackingConstantRegion { try decoder.fetch($0) }
            .removeDuplicates()
            .start(
                in: store.database.pool,
                scheduling: .immediate,
                onError: { LocalStore.log.error("History observation failed: \(String(describing: $0))") },
                onChange: { [weak self] in self?.receive($0) }
            )
    }

    private func receive(_ snapshot: Snapshot) {
        sessions = snapshot.sessions
        revision += 1
    }

    /// `compute` over the history, cached until the history changes. `key` names the computation and every other
    /// input it reads, such as a period or a unit; a value that depends on the date includes the day in its key.
    func memo<Key: Hashable, Value>(_ key: Key, _ compute: ([WorkoutSession]) -> Value) -> Value {
        if memoRevision != revision {
            memos = [:]
            memoRevision = revision
        }
        if let hit = memos[AnyHashable(key)] as? Value { return hit }
        let value = compute(sessions)
        memos[AnyHashable(key)] = value
        return value
    }

    /// Finished sessions that started before `session`, newest first: the history its Previous column and records read.
    func earlier(than session: WorkoutSession) -> [WorkoutSession] {
        sessions.filter { $0.startedAt < session.startedAt && $0.id != session.id }
    }

    private struct Snapshot: Equatable, Sendable {
        var rows: [[DatabaseValue]]
        var sessions: [WorkoutSession]

        static func == (lhs: Self, rhs: Self) -> Bool { lhs.rows == rhs.rows }
    }

    /// Keeps each decoded session with the row it came from. Fetches of one observation never overlap, and the lock
    /// only satisfies `Sendable`.
    private final class Decoder: Sendable {
        private let cache = Mutex<[String: (row: [DatabaseValue], session: WorkoutSession)]>([:])

        func fetch(_ db: Database) throws -> Snapshot {
            let rows = try Row.fetchAll(db, sql: "SELECT * FROM \(WorkoutSession.table) WHERE ended_at IS NOT NULL")
            return try cache.withLock { cache in
                var next: [String: (row: [DatabaseValue], session: WorkoutSession)] = [:]
                for row in rows {
                    let id: String = row["id"]
                    let values = Array(row.databaseValues)
                    if let hit = cache[id], hit.row == values {
                        next[id] = hit
                    } else {
                        next[id] = (values, try WorkoutSession(row: row))
                    }
                }
                cache = next
                let sorted = next.values.sorted { $0.session.startedAt > $1.session.startedAt }
                return Snapshot(rows: sorted.map(\.row), sessions: sorted.map(\.session))
            }
        }
    }
}
