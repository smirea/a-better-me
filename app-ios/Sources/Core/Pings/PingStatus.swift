import Foundation
import GRDB

/// A ping with what was logged for it on one day, which is all its row shows.
struct PingStatus: Identifiable, Hashable, Sendable {
    var ping: Ping
    var count = 0
    /// The day's latest log.
    var last: PingLog?

    var id: UUID { ping.id }

    /// Every ping in order with `day`'s logs.
    static func on(_ day: CalendarDay) -> DatabaseQuery<[PingStatus]> {
        DatabaseQuery([]) { db in
            statuses(try Ping.ordered(db), logs: try PingLog.on(day, in: db))
        }
    }

    static func statuses(_ pings: [Ping], logs: [PingLog]) -> [PingStatus] {
        let byPing = Dictionary(grouping: logs, by: \.pingID)
        return pings.map { ping in
            let logs = byPing[ping.id] ?? []
            return PingStatus(ping: ping, count: logs.count, last: logs.max { $0.loggedAt < $1.loggedAt })
        }
    }

    /// The fewest words that say what a boolean ping's day holds: nothing when it was not logged, the time of a single
    /// log, and the count from two on. A range ping says nothing, since its row marks the latest step instead.
    var summary: String? {
        guard ping.kind == .boolean, let last else { return nil }
        return count == 1 ? last.loggedAt.formatted(date: .omitted, time: .shortened) : "\(count) times"
    }

    /// The step a range ping was last set to that day.
    var step: Int? {
        ping.kind == .boolean ? nil : last?.value
    }
}

/// What the owner picked in a list of pings and has not logged yet: a value per ping, and the notes typed so far.
struct PingSelection: Equatable {
    private(set) var values: [UUID: Int] = [:]
    var notes: [UUID: String] = [:]

    var isEmpty: Bool { values.isEmpty }
    var count: Int { values.count }

    func value(_ ping: UUID) -> Int? { values[ping] }

    /// Picks `value` for the ping, or takes the pick back when it is the one already picked.
    mutating func toggle(_ ping: UUID, value: Int = 1) {
        values[ping] = values[ping] == value ? nil : value
    }

    /// Picks the ping when it is not picked yet, as typing a note on a boolean ping does.
    mutating func pick(_ ping: UUID, value: Int = 1) {
        if values[ping] == nil { values[ping] = value }
    }

    /// What is left once the picks are logged: the notes typed on pings that were not picked, which no log carried.
    var afterLogging: PingSelection {
        var rest = PingSelection()
        rest.notes = notes.filter { values[$0.key] == nil && !$0.value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        return rest
    }

    /// One log per picked ping with its note. A note on a ping that was not picked is not logged.
    func logs(at date: Date = .now) -> [PingLog] {
        values.map { ping, value in
            PingLog(pingID: ping, value: value, note: (notes[ping] ?? "").trimmingCharacters(in: .whitespacesAndNewlines), at: date)
        }
    }
}
