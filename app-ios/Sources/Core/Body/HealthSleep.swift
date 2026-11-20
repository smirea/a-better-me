import Foundation
import GRDB

/// An Apple Health sleep sample, as the phone reads it.
struct HealthSleepSample: Hashable, Sendable {
    enum Stage: Hashable, Sendable {
        case inBed, awake, asleep, core, deep, rem

        var isAsleep: Bool { self == .asleep || self == .core || self == .deep || self == .rem }
    }

    var id: UUID
    var start: Date
    var end: Date
    var stage: Stage
    var source: HealthSource
}

/// A row of the synced `health_sleeps` table: one sleep, a night or a nap, from the app that tracked it best.
struct HealthSleep: SyncedRecord {
    static let table = "health_sleeps"

    var id: UUID
    var startedAt: Date
    var endedAt: Date
    var asleepSeconds: Double = 0
    var awakeSeconds: Double = 0
    var deepSeconds: Double = 0
    var coreSeconds: Double = 0
    var remSeconds: Double = 0
    var source: String
    var sourceBundle: String
    /// Every app that tracked the sleep, the kept one first.
    var sources: [String]

    /// Asleep samples of one app closer than this are one sleep: an app writes a sample per stage, and a stretch awake
    /// in the night leaves a gap between two of them.
    static let maxGap: TimeInterval = 3600

    /// How near another app's sleep must be for the better-ranked app's to stand for it. A tracker that was worn and saw
    /// no sleep this close to the one it did see is taken at its word.
    static let otherSourceReach: TimeInterval = 3 * 3600

    /// Falling asleep before this hour ends the evening before: a bedtime of 1 AM is that night's, not the next day's.
    static let nightEndsHour = 6

    init(id: UUID, startedAt: Date, endedAt: Date, source: HealthSource) {
        self.id = id
        self.startedAt = startedAt.storedInstant
        self.endedAt = endedAt.storedInstant
        self.source = source.name
        sourceBundle = source.bundle
        sources = [source.name]
    }

    init(row: Row) throws {
        id = try row.uuid("id")
        startedAt = try row.instant("started_at")
        endedAt = try row.instant("ended_at")
        asleepSeconds = row["asleep_seconds"]
        awakeSeconds = row["awake_seconds"]
        deepSeconds = row["deep_seconds"]
        coreSeconds = row["core_seconds"]
        remSeconds = row["rem_seconds"]
        source = row["source"]
        sourceBundle = row["source_bundle"]
        sources = try row.json("sources")
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = key
        container["started_at"] = Instant.text(startedAt)
        container["ended_at"] = Instant.text(endedAt)
        container["asleep_seconds"] = asleepSeconds
        container["awake_seconds"] = awakeSeconds
        container["deep_seconds"] = deepSeconds
        container["core_seconds"] = coreSeconds
        container["rem_seconds"] = remSeconds
        container["source"] = source
        container["source_bundle"] = sourceBundle
        container["sources"] = try RowJSON.text(sources)
    }

    /// One row per sleep. Each app's samples join into its own sleeps; then, best-ranked app first, a sleep is dropped
    /// when a kept sleep of another app lies within `otherSourceReach` of it, and that app joins the kept one's sources.
    static func deduplicated(_ samples: [HealthSleepSample]) -> [HealthSleep] {
        let bySource = Dictionary(grouping: samples, by: \.source)
        let candidates = bySource.keys.sorted(by: HealthSource.ranked).flatMap { sleeps(of: bySource[$0]!, source: $0) }
        var kept: [HealthSleep] = []
        for sleep in candidates {
            if let index = kept.firstIndex(where: {
                $0.sourceBundle != sleep.sourceBundle
                    && $0.startedAt < sleep.endedAt.addingTimeInterval(otherSourceReach)
                    && sleep.startedAt < $0.endedAt.addingTimeInterval(otherSourceReach)
            }) {
                if !kept[index].sources.contains(sleep.source) { kept[index].sources.append(sleep.source) }
                continue
            }
            kept.append(sleep)
        }
        return kept.sorted { ($0.startedAt, $0.key) < ($1.startedAt, $1.key) }
    }

    /// One app's sleeps, from its first asleep sample to its last. Time two of its samples share counts once, and its
    /// stage samples inside a sleep add up to the stage times.
    static func sleeps(of samples: [HealthSleepSample], source: HealthSource) -> [HealthSleep] {
        var spans: [(first: HealthSleepSample, start: Date, end: Date, asleep: TimeInterval)] = []
        for sample in samples.filter(\.stage.isAsleep).sorted(by: { ($0.start, $0.id.uuidString) < ($1.start, $1.id.uuidString) }) {
            guard var span = spans.last, sample.start <= span.end.addingTimeInterval(maxGap) else {
                spans.append((sample, sample.start, sample.end, sample.end.timeIntervalSince(sample.start)))
                continue
            }
            span.asleep += max(0, sample.end.timeIntervalSince(max(sample.start, span.end)))
            span.end = max(span.end, sample.end)
            spans[spans.count - 1] = span
        }
        var sleeps = spans.map { span in
            var sleep = HealthSleep(id: span.first.id, startedAt: span.start, endedAt: span.end, source: source)
            sleep.asleepSeconds = span.asleep.rounded()
            return sleep
        }
        // Spans are apart and in order, so their ends rise too: a span that ends before a sample starts ends before every
        // later sample, and one pass over each list adds every stage sample to the sleeps it falls in.
        var first = 0
        for sample in samples.sorted(by: { $0.start < $1.start }) where sample.stage != .inBed && sample.stage != .asleep {
            while first < spans.count, spans[first].end <= sample.start { first += 1 }
            var index = first
            while index < spans.count, spans[index].start < sample.end {
                let inside = min(sample.end, spans[index].end).timeIntervalSince(max(sample.start, spans[index].start))
                switch sample.stage {
                case .awake: sleeps[index].awakeSeconds += inside
                case .deep: sleeps[index].deepSeconds += inside
                case .core: sleeps[index].coreSeconds += inside
                case .rem: sleeps[index].remSeconds += inside
                case .inBed, .asleep: break
                }
                index += 1
            }
        }
        for index in sleeps.indices {
            sleeps[index].awakeSeconds.round()
            sleeps[index].deepSeconds.round()
            sleeps[index].coreSeconds.round()
            sleeps[index].remSeconds.round()
        }
        return sleeps
    }

    /// The day whose evening this sleep began in, which is the day before when it began after midnight.
    func bedtimeDay(calendar: Calendar = .current) -> CalendarDay {
        let startDay = CalendarDay(startedAt, in: calendar)
        return calendar.component(.hour, from: startedAt) < Self.nightEndsHour ? startDay.adding(days: -1) : startDay
    }

    /// The moments of this sleep that fall on `day`: falling asleep on the evening's day, waking up on the morning's.
    func markers(on day: CalendarDay, calendar: Calendar = .current) -> [TimelineMarker] {
        var markers: [TimelineMarker] = []
        if bedtimeDay(calendar: calendar) == day {
            markers.append(TimelineMarker(id: "asleep/\(key)", kind: .asleep, at: startedAt, title: "Fell Asleep"))
        }
        if CalendarDay(endedAt, in: calendar) == day {
            markers.append(TimelineMarker(
                id: "wake/\(key)", kind: .wake, at: endedAt, title: "Woke Up", detail: "\(asleepSeconds.hoursAndMinutes) asleep"
            ))
        }
        return markers
    }
}
