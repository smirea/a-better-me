import Foundation
import GRDB

/// What another part of the app recorded at a moment of a day: a meal, a workout, a weigh-in, an activity or sleep
/// from Apple Health. The Pings timeline draws each as a line with its title on it.
struct TimelineMarker: Identifiable, Hashable, Sendable {
    enum Kind: Hashable, Sendable {
        case asleep, wake, meal, workout, weighIn
        /// A `health_activities` row, by its activity type.
        case activity(String)
    }

    var id: String
    var kind: Kind
    var at: Date
    var title: String
    var detail = ""
}

/// A log with the ping it is a log of, which its timeline row draws and edits.
struct PingEntry: Identifiable, Hashable, Sendable {
    var log: PingLog
    var ping: Ping

    var id: UUID { log.id }
}

/// Logs the timeline draws as one row at the first one's time: the same ping at the same value logged again with
/// nothing between, or boolean pings logged within `window` of the first. A log with a note stays on its own row, where
/// the note shows.
struct PingGroup: Hashable, Sendable {
    /// A ping in the group and how many times it was logged in it.
    struct Item: Hashable, Sendable {
        var ping: Ping
        var count: Int
        /// A range's step; every log of a ping in a group holds the same one.
        var value: Int
    }

    static let window: TimeInterval = 600

    /// Oldest first, at least two.
    var entries: [PingEntry]
    /// Each ping once, in the order it was first logged.
    var items: [Item]

    init(_ entries: [PingEntry]) {
        self.entries = entries
        var items: [Item] = []
        for entry in entries {
            if let index = items.firstIndex(where: { $0.ping.id == entry.ping.id }) {
                items[index].count += 1
            } else {
                items.append(Item(ping: entry.ping, count: 1, value: entry.log.value))
            }
        }
        self.items = items
    }

    /// Whether `entry` joins `run`, the rows right before it.
    static func joins(_ entry: PingEntry, _ run: [PingEntry]) -> Bool {
        guard let first = run.first, entry.log.note.isEmpty, run.allSatisfy({ $0.log.note.isEmpty }) else { return false }
        if run.allSatisfy({ $0.ping.id == entry.ping.id && $0.log.value == entry.log.value }) { return true }
        return entry.ping.kind == .boolean && run.allSatisfy { $0.ping.kind == .boolean }
            && entry.log.loggedAt.timeIntervalSince(first.log.loggedAt) <= window
    }
}

enum PingTimelineRow: Identifiable, Hashable, Sendable {
    case entry(PingEntry)
    case group(PingGroup)
    case marker(TimelineMarker)

    /// A group takes its first log's id, so a row that a second log joins stays the same row.
    var id: String {
        switch self {
        case let .entry(entry): entry.log.key
        case let .group(group): group.entries[0].log.key
        case let .marker(marker): marker.id
        }
    }

    var at: Date {
        switch self {
        case let .entry(entry): entry.log.loggedAt
        case let .group(group): group.entries[0].log.loggedAt
        case let .marker(marker): marker.at
        }
    }

    var entries: [PingEntry] {
        switch self {
        case let .entry(entry): [entry]
        case let .group(group): group.entries
        case .marker: []
        }
    }
}

/// One day of the Pings tab: its logs, and the markers the database holds for it.
struct PingTimeline: Equatable, Sendable {
    var entries: [PingEntry] = []
    var markers: [TimelineMarker] = []

    /// The day oldest first, so waking up heads the timeline and the latest log ends it, beside the drawer.
    func rows() -> [PingTimelineRow] {
        let sorted = (entries.map(PingTimelineRow.entry) + markers.map(PingTimelineRow.marker))
            .sorted { ($0.at, $0.id) < ($1.at, $1.id) }
        var rows: [PingTimelineRow] = []
        var run: [PingEntry] = []
        func close() {
            if run.count == 1 { rows.append(.entry(run[0])) } else if run.count > 1 { rows.append(.group(PingGroup(run))) }
            run = []
        }
        for row in sorted {
            guard case let .entry(entry) = row else {
                close()
                rows.append(row)
                continue
            }
            if !PingGroup.joins(entry, run) { close() }
            run.append(entry)
        }
        close()
        return rows
    }

    /// Where a row dropped at `index` of `rows`, the day's rows without it, moves to: a minute after the row above it, as
    /// the owner asked (2026-11-24), so a ping dragged under Breakfast at 9:00 reads 9:01. When the row below comes sooner,
    /// it lands halfway between the two, and dropped at the top it lands a minute before the first row. A group above counts
    /// from its last log. It never leaves its day. Nil when there is no other row to drop beside.
    static func dropTime(at index: Int, in rows: [PingTimelineRow], on day: CalendarDay, calendar: Calendar = .current) -> Date? {
        let previous = rows.indices.contains(index - 1) ? rows[index - 1].entries.map(\.log.loggedAt).max() ?? rows[index - 1].at : nil
        let next = rows.indices.contains(index) ? rows[index].at : nil
        let time: Date
        if let previous {
            let after = previous.addingTimeInterval(60)
            time = next.map { after < $0 ? after : previous.addingTimeInterval($0.timeIntervalSince(previous) / 2) } ?? after
        } else if let next {
            time = next.addingTimeInterval(-60)
        } else {
            return nil
        }
        let start = day.date(in: calendar)
        let end = day.adding(days: 1).date(in: calendar).addingTimeInterval(-1)
        return min(max(time, start), end)
    }

    /// The logs of `row` moved to where it was dropped among `rows`, the day's rows without it (`dropTime`). A group's
    /// logs all land there, a second apart in their order: kept apart as they were, a group dropped just above a marker
    /// split around it.
    static func drop(_ row: PingTimelineRow, at index: Int, in rows: [PingTimelineRow], on day: CalendarDay, calendar: Calendar = .current) -> [PingLog] {
        guard let time = dropTime(at: index, in: rows, on: day, calendar: calendar) else { return [] }
        return row.entries.enumerated().map { offset, entry in
            var log = entry.log
            log.loggedAt = time.addingTimeInterval(TimeInterval(offset))
            return log
        }
    }

    static func on(_ day: CalendarDay, calendar: Calendar = .current) -> DatabaseQuery<PingTimeline> {
        DatabaseQuery(PingTimeline()) { db in
            let pings = Dictionary(try Ping.fetchAll(db).map { ($0.id, $0) }, uniquingKeysWith: { $1 })
            let entries = try PingLog.on(day, in: db, calendar: calendar).compactMap { log in
                pings[log.pingID].map { PingEntry(log: log, ping: $0) }
            }
            let settings = try AppSettings.current.fetch(db)
            let markers = try meals(on: day, sections: settings.nutrition.mealSections, in: db, calendar: calendar)
                + workouts(on: day, in: db, calendar: calendar)
                + weighIns(on: day, unit: settings.weightUnit, in: db, calendar: calendar)
                + activities(on: day, in: db, calendar: calendar)
                + sleeps(on: day, in: db, calendar: calendar)
            return PingTimeline(entries: entries, markers: markers)
        }
    }

    /// A marker per meal section that holds food, at its first food's time.
    private static func meals(on day: CalendarDay, sections: [MealSection], in db: Database, calendar: Calendar) throws -> [TimelineMarker] {
        let entries = try FoodEntry.filter(Column("day") == day.description).fetchAll(db)
        return FoodLog.sections(entries, sections: sections, hideEmpty: true).compactMap { group in
            guard case let .section(section) = group.slot, let first = group.rows.first else { return nil }
            let foods = group.rows.count == 1 ? "1 food" : "\(group.rows.count) foods"
            return TimelineMarker(
                id: "meal/\(section.id)", kind: .meal, at: day.date(atMinute: first.entry.minute, in: calendar), title: section.name,
                detail: "\(foods), \(NutritionFormat.amount(group.totals[.energy] ?? 0, .kcal))"
            )
        }
    }

    /// Read as columns: a session's blocks are its whole workout, and a marker needs none of them.
    private static func workouts(on day: CalendarDay, in db: Database, calendar: Calendar) throws -> [TimelineMarker] {
        let rows = try Row.fetchAll(
            db, sql: "SELECT id, name, started_at, ended_at, paused_seconds FROM workout_sessions WHERE started_at >= ? AND started_at < ?",
            arguments: [Instant.text(day.date(in: calendar)), Instant.text(day.adding(days: 1).date(in: calendar))]
        )
        return try rows.map { row in
            let start = try row.instant("started_at")
            let end = try row.instant("ended_at", optional: true)
            let paused: Int = row["paused_seconds"] ?? 0
            return TimelineMarker(
                id: "workout/\(row["id"] as String)", kind: .workout, at: start, title: row["name"],
                detail: end.map { ($0.timeIntervalSince(start) - TimeInterval(paused)).hoursAndMinutes } ?? "In progress"
            )
        }
    }

    private static func activities(on day: CalendarDay, in db: Database, calendar: Calendar) throws -> [TimelineMarker] {
        try HealthActivity.filter(
            Column("started_at") >= Instant.text(day.date(in: calendar))
                && Column("started_at") < Instant.text(day.adding(days: 1).date(in: calendar))
        )
        .fetchAll(db)
        .map { activity in
            let length = activity.endedAt.timeIntervalSince(activity.startedAt).hoursAndMinutes
            let energy = activity.activeKcal.map { ", \(NutritionFormat.amount($0, .kcal))" } ?? ""
            return TimelineMarker(
                id: "activity/\(activity.key)", kind: .activity(activity.activityType), at: activity.startedAt, title: activity.title,
                detail: length + energy
            )
        }
    }

    /// A sleep that ends on the day, or begins on its evening, which runs into the next morning.
    private static func sleeps(on day: CalendarDay, in db: Database, calendar: Calendar) throws -> [TimelineMarker] {
        let nightEnd = day.adding(days: 1).date(in: calendar).addingTimeInterval(TimeInterval(HealthSleep.nightEndsHour) * 3600)
        return try HealthSleep.filter(
            Column("ended_at") >= Instant.text(day.date(in: calendar)) && Column("started_at") < Instant.text(nightEnd)
        )
        .fetchAll(db)
        .flatMap { $0.markers(on: day, calendar: calendar) }
    }

    private static func weighIns(on day: CalendarDay, unit: WeightUnit, in db: Database, calendar: Calendar) throws -> [TimelineMarker] {
        try BodyWeight.filter(
            Column("measured_at") >= Instant.text(day.date(in: calendar))
                && Column("measured_at") < Instant.text(day.adding(days: 1).date(in: calendar))
        )
        .fetchAll(db)
        .map { TimelineMarker(id: "weigh-in/\($0.key)", kind: .weighIn, at: $0.measuredAt, title: "Weigh-In", detail: unit.label(kg: $0.weightKg)) }
    }
}

extension TimeInterval {
    /// "7h 32m", and "45m" under an hour.
    var hoursAndMinutes: String {
        Duration.seconds(max(0, self)).formatted(.units(allowed: [.hours, .minutes], width: .narrow))
    }
}
