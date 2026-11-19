import Foundation
import GRDB

/// An Apple Health body mass sample.
struct HealthWeight: Hashable, Sendable {
    var id: UUID
    var date: Date
    var kg: Double
}

/// One read of Apple Health: every body mass sample, and each activity kind's daily totals from `from` on.
struct HealthRead: Sendable {
    var weights: [HealthWeight]
    var days: [BodyMetricKind: [DatedValue]]
    var from: Date
}

/// Copies Apple Health into the synced tables, so the phone's screens, the server, and the agent API all read one
/// place; see docs/decisions/workouts.md. A copy is a `healthKit` row, keyed by what it copies (the sample's UUID, the
/// day and kind), so copying again writes only what Health changed.
enum HealthMirror {
    static let sameMomentTolerance: TimeInterval = 60
    static let sameWeightKg = 0.05

    struct WeighInChanges: Equatable {
        var puts: [BodyWeight] = []
        var deletes: [UUID] = []
    }

    struct DayChanges: Equatable {
        var puts: [BodyMetric] = []
        var deletes: [String] = []
    }

    /// What makes the `healthKit` weigh-ins match Health. A sample that is the same reading as a manual weigh-in (within
    /// a minute of it, or on its day within 0.05 kg, as an import without a time of day stores it) is not copied, and
    /// its earlier copy goes. HealthKit hides read denial as an empty answer, so an empty read deletes nothing.
    static func weighIns(health: [HealthWeight], rows: [BodyWeight], calendar: Calendar) -> WeighInChanges {
        let manual = rows.filter { $0.source == .manual }
        let manualDates = manual.map(\.measuredAt).sorted()
        let manualByDay = Dictionary(grouping: manual, by: { CalendarDay($0.measuredAt, in: calendar) }).mapValues { $0.map(\.weightKg) }
        let copies = Dictionary(rows.filter { $0.source == .healthKit }.map { ($0.id, $0) }, uniquingKeysWith: { $1 })

        var changes = WeighInChanges()
        var kept: Set<UUID> = []
        var next = 0
        for sample in health.sorted(by: { $0.date < $1.date }) {
            while next < manualDates.count, manualDates[next] <= sample.date.addingTimeInterval(-sameMomentTolerance) { next += 1 }
            if next < manualDates.count, manualDates[next] < sample.date.addingTimeInterval(sameMomentTolerance) { continue }
            if manualByDay[CalendarDay(sample.date, in: calendar)]?.contains(where: { abs($0 - sample.kg) < sameWeightKg }) == true { continue }
            kept.insert(sample.id)
            guard var copy = copies[sample.id] else {
                changes.puts.append(BodyWeight(id: sample.id, weightKg: sample.kg, measuredAt: sample.date, source: .healthKit))
                continue
            }
            // A stored instant is rounded to the millisecond, so an untouched copy differs from its sample by less.
            guard abs(copy.measuredAt.timeIntervalSince(sample.date)) >= 0.001 || copy.weightKg != sample.kg else { continue }
            copy.measuredAt = sample.date
            copy.weightKg = sample.kg
            changes.puts.append(copy)
        }
        if !health.isEmpty { changes.deletes = copies.keys.filter { !kept.contains($0) }.sorted { $0.uuidString < $1.uuidString } }
        return changes
    }

    /// What makes a kind's rows match Health's daily totals from `from` on. Health's total takes its day, over a manual
    /// value too; a manual value stays on a day Health has none; a copy whose day Health no longer counts goes. An empty
    /// read deletes nothing, as with the weigh-ins.
    static func days(
        _ kind: BodyMetricKind, health: [DatedValue], rows: [BodyMetric], from: CalendarDay, calendar: Calendar, now: Date
    ) -> DayChanges {
        let stored = Dictionary(rows.filter { $0.kind == kind }.map { ($0.day, $0) }, uniquingKeysWith: { $1 })
        var changes = DayChanges()
        var counted: Set<CalendarDay> = []
        for total in health {
            let day = CalendarDay(total.date, in: calendar)
            let value = total.value.rounded()
            counted.insert(day)
            if let row = stored[day], row.source == .healthKit, row.value == value { continue }
            changes.puts.append(BodyMetric(kind, on: day, value: value, source: .healthKit, at: now))
        }
        if !health.isEmpty {
            changes.deletes = stored.values.filter { $0.source == .healthKit && $0.day >= from && !counted.contains($0.day) }.map(\.id).sorted()
        }
        return changes
    }

    /// Runs inside one write, so the rows it compares against are the rows it changes.
    static func apply(_ read: HealthRead, to db: Database, calendar: Calendar, now: Date = .now) throws {
        let weighIns = weighIns(health: read.weights, rows: try BodyWeight.fetchAll(db), calendar: calendar)
        for row in weighIns.puts { try LocalStore.put(row, in: db) }
        for id in weighIns.deletes { _ = try BodyWeight.deleteOne(db, key: BodyWeight.key(id)) }

        let from = CalendarDay(read.from, in: calendar)
        for (kind, totals) in read.days {
            let rows = try BodyMetric.filter(Column("kind") == kind.rawValue && Column("day") >= from.description).fetchAll(db)
            let days = days(kind, health: totals, rows: rows, from: from, calendar: calendar, now: now)
            for row in days.puts { try LocalStore.put(row, in: db) }
            for id in days.deletes { _ = try BodyMetric.deleteOne(db, key: id) }
        }
    }
}

struct WeighIn: Hashable, Sendable {
    enum Source: Hashable, Sendable {
        case app(UUID)
        case health
    }

    var date: Date
    var kg: Double
    var source: Source
}

extension [WeighIn] {
    var points: [DatedValue] { map { DatedValue(date: $0.date, value: $0.kg) } }
}

/// The weigh-ins and the daily activity totals the Dashboard, Strategy, and the widgets read: the database's rows,
/// manual and copied from Apple Health alike, oldest first. One query, so a launch reads them once for its first frame.
struct BodyReadings: Equatable, Sendable {
    var weighIns: [WeighIn] = []
    var steps: [DatedValue] = []
    var flights: [DatedValue] = []
    /// Walking and running distance per day, in meters.
    var distance: [DatedValue] = []

    static func fetch(_ db: Database, calendar: Calendar) throws -> BodyReadings {
        var readings = BodyReadings()
        readings.weighIns = try BodyWeight.fetchAll(db)
            .map { WeighIn(date: $0.measuredAt, kg: $0.weightKg, source: $0.source == .manual ? .app($0.id) : .health) }
            .sorted { $0.date < $1.date }
        // Not `BodyMetric.fetchAll`: these are years of days, and each row's `updated_at` would be parsed for nothing.
        let kinds = BodyMetricKind.activity.map(\.rawValue)
        let rows = try Row.fetchCursor(db, sql: """
            SELECT kind, day, value FROM body_metrics WHERE kind IN (\(kinds.map { _ in "?" }.joined(separator: ","))) ORDER BY day
            """, arguments: StatementArguments(kinds))
        while let row = try rows.next() {
            let point = DatedValue(date: try startOfDay(row["day"], in: calendar), value: row["value"])
            switch row["kind"] as String {
            case BodyMetricKind.steps.rawValue: readings.steps.append(point)
            case BodyMetricKind.flightsClimbed.rawValue: readings.flights.append(point)
            default: readings.distance.append(point)
            }
        }
        return readings
    }

    /// Not `CalendarDay(text)`: checking each day is a real date was most of this read over a decade of days, and the
    /// sync validators already refuse a row whose day is not one.
    private static func startOfDay(_ text: String, in calendar: Calendar) throws -> Date {
        let digits = text.utf8.map { Int($0) - 48 }
        guard digits.count == 10, let date = calendar.date(from: DateComponents(
            year: digits[0] * 1000 + digits[1] * 100 + digits[2] * 10 + digits[3], month: digits[5] * 10 + digits[6], day: digits[8] * 10 + digits[9]
        )) else { throw RowDecodingError(description: "day is not a day: \(text)") }
        return date
    }
}
