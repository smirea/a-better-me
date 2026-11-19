import Foundation
import GRDB

/// A ping's Dashboard card: the days behind its chart and the number under it.
struct PingCard: Identifiable, Hashable, Sendable {
    enum Chart: Hashable, Sendable {
        /// A boolean ping's last 30 days, oldest first: each day's count as a fraction of the busiest day's.
        case days([Double])
        /// A range ping's last 7 days, oldest first: each day's average step, 0 for a day without a log.
        case week([Double], steps: Int)
    }

    var ping: Ping
    var chart: Chart
    /// Today's count for a boolean ping, and the average of the week's logs for a range ping, as its history shows.
    var value: Double?

    var id: UUID { ping.id }

    static let habitDays = 30
    static let weekDays = 7

    /// Every ping's card, in order. The logs are read from the first charted day on.
    static func all(now: Date, calendar: Calendar) -> DatabaseQuery<[PingCard]> {
        DatabaseQuery([]) { db in
            let start = calendar.date(byAdding: .day, value: 1 - habitDays, to: calendar.startOfDay(for: now))!
            return cards(try Ping.ordered(db), logs: try PingLog.since(start, in: db), now: now, calendar: calendar)
        }
    }

    static func cards(_ pings: [Ping], logs: [PingLog], now: Date, calendar: Calendar) -> [PingCard] {
        let byPing = Dictionary(grouping: logs, by: \.pingID)
        return pings.map { ping in
            let logs = byPing[ping.id] ?? []
            switch ping.kind {
            case .boolean:
                let counts = PingStats.byDay(logs, days: habitDays, now: now, calendar: calendar).map(\.count)
                return PingCard(ping: ping, chart: .days(PingStats.intensities(counts)), value: Double(counts.last ?? 0))
            case let .range(steps):
                let week = PingStats.byDay(logs, days: weekDays, now: now, calendar: calendar)
                return PingCard(
                    ping: ping, chart: .week(week.map { PingStats.average($0) ?? 0 }, steps: steps.count),
                    value: PingStats.average(week.flatMap(\.self))
                )
            }
        }
    }
}

enum PingStats {
    /// The logs of each of the last `days` days, oldest first, today last.
    static func byDay(_ logs: [PingLog], days: Int, now: Date, calendar: Calendar) -> [[PingLog]] {
        let today = calendar.startOfDay(for: now)
        var buckets = [[PingLog]](repeating: [], count: days)
        for log in logs {
            let ago = calendar.dateComponents([.day], from: calendar.startOfDay(for: log.loggedAt), to: today).day ?? -1
            if (0..<days).contains(ago) { buckets[days - 1 - ago].append(log) }
        }
        return buckets
    }

    /// Each count as a fraction of the largest, so the busiest day draws at full strength and an empty day at none.
    static func intensities(_ counts: [Int]) -> [Double] {
        let top = counts.max() ?? 0
        return counts.map { top > 0 ? Double($0) / Double(top) : 0 }
    }

    static func average(_ logs: [PingLog]) -> Double? {
        logs.isEmpty ? nil : Double(logs.reduce(0) { $0 + $1.value }) / Double(logs.count)
    }
}

/// A ping's own screen: the ping, its last 30 days of logs, and those days as the chart draws them.
struct PingHistory: Equatable, Sendable {
    struct Day: Equatable, Sendable {
        var date: Date
        var count: Int
        /// The day's average step; nil for a day without a log.
        var average: Double?
    }

    var ping: Ping?
    /// Newest first.
    var logs: [PingLog] = []
    /// Oldest first, today last.
    var days: [Day] = []
    /// The average step over every log of the last 7 and 30 days, worked out with the fetch so the screen only shows
    /// them.
    var weekAverage: Double?
    var monthAverage: Double?

    static func recent(_ id: UUID, now: Date, calendar: Calendar) -> DatabaseQuery<PingHistory> {
        DatabaseQuery(PingHistory()) { db in
            let today = calendar.startOfDay(for: now)
            let start = calendar.date(byAdding: .day, value: 1 - PingCard.habitDays, to: today)!
            // A log on a later day, which the Pings tab can write, is not part of the last 30 days yet.
            let end = calendar.date(byAdding: .day, value: 1, to: today)!
            let logs = try PingLog.filter(
                Column("ping_id") == Ping.key(id) && Column("logged_at") >= Instant.text(start) && Column("logged_at") < Instant.text(end)
            ).fetchAll(db)
            let days = PingStats.byDay(logs, days: PingCard.habitDays, now: now, calendar: calendar).enumerated().map { index, logs in
                Day(date: calendar.date(byAdding: .day, value: index, to: start)!, count: logs.count, average: PingStats.average(logs))
            }
            let weekStart = calendar.date(byAdding: .day, value: 1 - PingCard.weekDays, to: today)!
            return PingHistory(
                ping: try Ping.fetchOne(db, key: Ping.key(id)), logs: logs.sorted { $0.loggedAt > $1.loggedAt }, days: days,
                weekAverage: PingStats.average(logs.filter { $0.loggedAt >= weekStart }), monthAverage: PingStats.average(logs)
            )
        }
    }

    /// The logs of the last `days` days.
    func count(days: Int) -> Int {
        self.days.suffix(days).reduce(0) { $0 + $1.count }
    }
}
