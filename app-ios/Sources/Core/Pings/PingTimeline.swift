import Foundation
import GRDB

/// What another part of the app recorded at a moment of a day: a meal, a workout, a weigh-in, falling asleep, or
/// waking up. The Pings timeline draws each as a line with its title on it.
struct TimelineMarker: Identifiable, Hashable, Sendable {
    enum Kind: Hashable, Sendable {
        case asleep, wake, meal, workout, weighIn
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

enum PingTimelineRow: Identifiable, Hashable, Sendable {
    case entry(PingEntry)
    case marker(TimelineMarker)

    var id: String {
        switch self {
        case let .entry(entry): entry.log.key
        case let .marker(marker): marker.id
        }
    }

    var at: Date {
        switch self {
        case let .entry(entry): entry.log.loggedAt
        case let .marker(marker): marker.at
        }
    }
}

/// One day of the Pings tab: its logs, and the markers the database holds for it. Sleep comes from Apple Health, so the
/// tab adds its markers when it asks for the rows.
struct PingTimeline: Equatable, Sendable {
    var entries: [PingEntry] = []
    var markers: [TimelineMarker] = []

    /// The day newest first, so the latest log heads the timeline and waking up ends it.
    func rows(sleep: [TimelineMarker] = []) -> [PingTimelineRow] {
        (entries.map(PingTimelineRow.entry) + (markers + sleep).map(PingTimelineRow.marker)).sorted { ($0.at, $0.id) > ($1.at, $1.id) }
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
