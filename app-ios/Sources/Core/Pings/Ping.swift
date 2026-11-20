import Foundation
import GRDB

/// What logging a ping records: that it happened, or a step on a scale. The raw `kind` column holds the schema's
/// `PING_KINDS`, and a range's step labels are the `steps` column.
enum PingKind: Hashable, Sendable {
    case boolean
    /// One label per step in order, empty for a step without one, so the count is the number of steps.
    case range([String])

    static let stepLimits = 2...10

    var steps: [String] {
        switch self {
        case .boolean: []
        case let .range(steps): steps
        }
    }
}

/// A ping's swatch, stored by id (the schema's `PING_COLORS`). The app holds each one's color.
enum PingColor: String, CaseIterable, Sendable {
    case red, orange, yellow, lime, green, teal, sky, blue, violet, purple, pink, tan

    /// What a ping without a color draws in: the tint pings had before they had colors.
    static let fallback = PingColor.teal

    /// The swatch a new ping starts on: the first no ping draws in yet, or, once all twelve are taken, the one fewest
    /// draw in. A ping without a color draws in `fallback`, so it takes that swatch.
    static func unused(by pings: [Ping]) -> PingColor {
        let counts = Dictionary(pings.map { ($0.color ?? fallback, 1) }, uniquingKeysWith: +)
        return allCases.min { counts[$0, default: 0] < counts[$1, default: 0] } ?? fallback
    }
}

/// A row of the synced `pings` table: something the owner logs in a tap, such as a glass of water or a mood from 1 to 5.
struct Ping: Stamped {
    static let table = "pings"

    var id: UUID
    var name: String
    /// An SF Symbol name.
    var icon: String
    /// Nil for a ping made before pings had colors, and for a swatch this app doesn't know.
    var color: PingColor?
    var kind: PingKind
    /// Orders the pings everywhere they list, lowest first.
    var position: Int
    var createdAt: Date
    var updatedAt: Date

    init(id: UUID = UUID(), name: String, icon: String, color: PingColor? = nil, kind: PingKind, position: Int = 0, at date: Date = .now) {
        self.id = id
        self.name = name
        self.icon = icon
        self.color = color
        self.kind = kind
        self.position = position
        createdAt = date
        updatedAt = date
    }

    init(row: Row) throws {
        id = try row.uuid("id")
        name = row["name"]
        icon = row["icon"]
        color = (row["color"] as String?).flatMap(PingColor.init(rawValue:))
        kind = (row["kind"] as String?) == "range" ? .range(try row.json("steps")) : .boolean
        position = row["position"]
        createdAt = try row.instant("created_at")
        updatedAt = try row.instant("updated_at")
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = key
        container["name"] = name
        container["icon"] = icon
        container["color"] = color?.rawValue
        switch kind {
        case .boolean: container["kind"] = "boolean"
        case .range: container["kind"] = "range"
        }
        container["steps"] = try RowJSON.text(kind.steps)
        container["position"] = position
        container["created_at"] = Instant.text(createdAt)
        container["updated_at"] = Instant.text(updatedAt)
    }
}

/// A row of the synced `ping_logs` table: one time a ping was logged. `value` is a range ping's step, from 1, and 1 for
/// a boolean ping, so a day's count is its rows.
struct PingLog: SyncedRecord {
    static let table = "ping_logs"

    var id: UUID
    var pingID: UUID
    var loggedAt: Date
    var value: Int
    var note: String

    init(id: UUID = UUID(), pingID: UUID, value: Int = 1, note: String = "", at date: Date = .now) {
        self.id = id
        self.pingID = pingID
        self.value = value
        self.note = note
        loggedAt = date
    }

    init(row: Row) throws {
        id = try row.uuid("id")
        pingID = try row.uuid("ping_id")
        loggedAt = try row.instant("logged_at")
        value = row["value"]
        note = row["note"]
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = key
        container["ping_id"] = Ping.key(pingID)
        container["logged_at"] = Instant.text(loggedAt)
        container["value"] = value
        container["note"] = note
    }
}

extension Ping {
    static let all = DatabaseQuery([Ping]()) { try ordered($0) }

    static let count = DatabaseQuery(0) { try Ping.fetchCount($0) }

    static func ordered(_ db: Database) throws -> [Ping] {
        try Ping.fetchAll(db).sorted { ($0.position, $0.createdAt) < ($1.position, $1.createdAt) }
    }
}

extension PingLog {
    /// Instants are UTC text of one width, so comparing the column as text compares the times.
    static func since(_ date: Date, in db: Database) throws -> [PingLog] {
        try PingLog.filter(Column("logged_at") >= Instant.text(date)).fetchAll(db)
    }

    static func on(_ day: CalendarDay, in db: Database, calendar: Calendar = .current) throws -> [PingLog] {
        try during(day, calendar: calendar).fetchAll(db)
    }

    /// How many different pings were logged on `day`, which fills its pill on the Pings tab.
    static func pingsLogged(on day: CalendarDay) -> DatabaseQuery<Int> {
        DatabaseQuery(0) { db in
            try during(day, calendar: .current).select(Column("ping_id")).distinct().fetchCount(db)
        }
    }

    private static func during(_ day: CalendarDay, calendar: Calendar) -> QueryInterfaceRequest<PingLog> {
        PingLog.filter(
            Column("logged_at") >= Instant.text(day.date(in: calendar))
                && Column("logged_at") < Instant.text(day.adding(days: 1).date(in: calendar))
        )
    }

    /// When a ping picked on `day` is logged: now on today, and the clock's time of day on any other day, as the Food
    /// Log logs a food onto the day it shows. The time keeps its seconds, so two logs a moment apart keep their order.
    static func instant(on day: CalendarDay, now: Date = .now, calendar: Calendar = .current) -> Date {
        let today = CalendarDay(now, in: calendar)
        return day == today ? now : day.date(in: calendar) + now.timeIntervalSince(today.date(in: calendar))
    }

    /// Whether the ping was ever logged. A log's value means a step of the ping as it was, so the editor fixes the
    /// kind and the number of steps from the first log on. Nil is a ping not made yet.
    static func exists(for pingID: UUID?) -> DatabaseQuery<Bool> {
        DatabaseQuery(false) { db in
            guard let pingID else { return false }
            return try !PingLog.filter(Column("ping_id") == Ping.key(pingID)).isEmpty(db)
        }
    }

    /// Every log of one ping, newest first.
    static func history(_ pingID: UUID) -> DatabaseQuery<[PingLog]> {
        DatabaseQuery([]) { db in
            try PingLog.filter(Column("ping_id") == Ping.key(pingID)).fetchAll(db).sorted { $0.loggedAt > $1.loggedAt }
        }
    }
}

extension LocalStore {
    /// Inserts a new ping after the last one, or updates an existing one in place.
    func savePing(_ ping: Ping) {
        write { db in
            var saved = ping
            saved.updatedAt = .now
            if try !Ping.exists(db, key: saved.key) {
                saved.position = (try Ping.fetchAll(db).map(\.position).max() ?? -1) + 1
            }
            try Self.put(saved, in: db)
        }
    }

    func deletePing(_ id: UUID) {
        write { db in
            _ = try PingLog.filter(Column("ping_id") == Ping.key(id)).deleteAll(db)
            _ = try Ping.deleteOne(db, key: Ping.key(id))
        }
    }

    /// Stores `order` as the pings' positions, writing only the rows that moved.
    func orderPings(_ order: [UUID]) {
        write { db in
            for (position, id) in order.enumerated() {
                guard let existing = try Ping.fetchOne(db, key: Ping.key(id)), existing.position != position else { continue }
                var moved = existing
                moved.position = position
                try moved.update(db, from: existing)
            }
        }
    }

    func logPings(_ logs: [PingLog]) {
        write { db in
            for log in logs { try log.insert(db) }
        }
    }
}
