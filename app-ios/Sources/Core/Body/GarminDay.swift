import Foundation
import GRDB

/// A `[epochSec, value]` pair stored inside Garmin intraday JSON columns.
struct GarminSeriesPoint: Hashable, Sendable, Codable {
    var epochSec: Double
    var value: Double

    var date: Date { Date(timeIntervalSince1970: epochSec) }

    init(epochSec: Double, value: Double) {
        self.epochSec = epochSec
        self.value = value
    }

    init(from decoder: any Decoder) throws {
        var container = try decoder.unkeyedContainer()
        epochSec = try container.decode(Double.self)
        value = try container.decode(Double.self)
    }

    func encode(to encoder: any Encoder) throws {
        var container = encoder.unkeyedContainer()
        try container.encode(epochSec)
        try container.encode(value)
    }
}

struct GarminMotionSpan: Hashable, Sendable, Codable {
    var start: Double
    var end: Double

    var startDate: Date { Date(timeIntervalSince1970: start) }
    var endDate: Date { Date(timeIntervalSince1970: end) }
}

/// A row of the synced `garmin_days` table: one calendar day (`YYYY-MM-DD`) of Garmin CIRQA telemetry and calibrated
/// WHOOP-style stress (0.0–3.0) and strain (0–21).
struct GarminDay: SyncedRecord {
    static let table = "garmin_days"

    var id: String
    var restingHeartRate: Int?
    var hrvLastNight: Double?
    var hrvWeeklyAvg: Double?
    var hrvStatus: String?
    var bodyBatteryWake: Int?
    var bodyBatteryHigh: Int?
    var bodyBatteryLow: Int?
    var bodyBatteryCharged: Int?
    var bodyBatteryDrained: Int?
    var stressAvg: Int?
    var stressMax: Int?
    var sleepScore: Int?
    var sleepStartAt: Date?
    var sleepEndAt: Date?
    var sleepSeconds: Int?
    var deepSeconds: Int?
    var lightSeconds: Int?
    var remSeconds: Int?
    var awakeSeconds: Int?
    var respirationAvg: Double?
    var spo2Avg: Double?
    var skinTempNightlyC: Double?
    var skinTempDeviationC: Double?
    var readinessScore: Int?
    var readinessLevel: String?
    var acuteLoad: Double?
    var vo2Max: Double?
    var steps: Int?
    var activeKcal: Double?
    var totalKcal: Double?
    var strain: Double?
    var syncedAt: Date
    var stressSeries: [GarminSeriesPoint]
    var heartRateSeries: [GarminSeriesPoint]
    var rawStressSeries: [GarminSeriesPoint]
    var bodyBatterySeries: [GarminSeriesPoint]
    var motionSpans: [GarminMotionSpan]

    init(
        id: String,
        restingHeartRate: Int? = nil,
        hrvLastNight: Double? = nil,
        hrvWeeklyAvg: Double? = nil,
        hrvStatus: String? = nil,
        bodyBatteryWake: Int? = nil,
        bodyBatteryHigh: Int? = nil,
        bodyBatteryLow: Int? = nil,
        bodyBatteryCharged: Int? = nil,
        bodyBatteryDrained: Int? = nil,
        stressAvg: Int? = nil,
        stressMax: Int? = nil,
        sleepScore: Int? = nil,
        sleepStartAt: Date? = nil,
        sleepEndAt: Date? = nil,
        sleepSeconds: Int? = nil,
        deepSeconds: Int? = nil,
        lightSeconds: Int? = nil,
        remSeconds: Int? = nil,
        awakeSeconds: Int? = nil,
        respirationAvg: Double? = nil,
        spo2Avg: Double? = nil,
        skinTempNightlyC: Double? = nil,
        skinTempDeviationC: Double? = nil,
        readinessScore: Int? = nil,
        readinessLevel: String? = nil,
        acuteLoad: Double? = nil,
        vo2Max: Double? = nil,
        steps: Int? = nil,
        activeKcal: Double? = nil,
        totalKcal: Double? = nil,
        strain: Double? = nil,
        syncedAt: Date = .now,
        stressSeries: [GarminSeriesPoint] = [],
        heartRateSeries: [GarminSeriesPoint] = [],
        rawStressSeries: [GarminSeriesPoint] = [],
        bodyBatterySeries: [GarminSeriesPoint] = [],
        motionSpans: [GarminMotionSpan] = []
    ) {
        self.id = id
        self.restingHeartRate = restingHeartRate
        self.hrvLastNight = hrvLastNight
        self.hrvWeeklyAvg = hrvWeeklyAvg
        self.hrvStatus = hrvStatus
        self.bodyBatteryWake = bodyBatteryWake
        self.bodyBatteryHigh = bodyBatteryHigh
        self.bodyBatteryLow = bodyBatteryLow
        self.bodyBatteryCharged = bodyBatteryCharged
        self.bodyBatteryDrained = bodyBatteryDrained
        self.stressAvg = stressAvg
        self.stressMax = stressMax
        self.sleepScore = sleepScore
        self.sleepStartAt = sleepStartAt
        self.sleepEndAt = sleepEndAt
        self.sleepSeconds = sleepSeconds
        self.deepSeconds = deepSeconds
        self.lightSeconds = lightSeconds
        self.remSeconds = remSeconds
        self.awakeSeconds = awakeSeconds
        self.respirationAvg = respirationAvg
        self.spo2Avg = spo2Avg
        self.skinTempNightlyC = skinTempNightlyC
        self.skinTempDeviationC = skinTempDeviationC
        self.readinessScore = readinessScore
        self.readinessLevel = readinessLevel
        self.acuteLoad = acuteLoad
        self.vo2Max = vo2Max
        self.steps = steps
        self.activeKcal = activeKcal
        self.totalKcal = totalKcal
        self.strain = strain
        self.syncedAt = syncedAt.storedInstant
        self.stressSeries = stressSeries
        self.heartRateSeries = heartRateSeries
        self.rawStressSeries = rawStressSeries
        self.bodyBatterySeries = bodyBatterySeries
        self.motionSpans = motionSpans
    }

    init(row: Row) throws {
        id = row["id"]
        restingHeartRate = row["resting_heart_rate"]
        hrvLastNight = row["hrv_last_night"]
        hrvWeeklyAvg = row["hrv_weekly_avg"]
        hrvStatus = row["hrv_status"]
        bodyBatteryWake = row["body_battery_wake"]
        bodyBatteryHigh = row["body_battery_high"]
        bodyBatteryLow = row["body_battery_low"]
        bodyBatteryCharged = row["body_battery_charged"]
        bodyBatteryDrained = row["body_battery_drained"]
        stressAvg = row["stress_avg"]
        stressMax = row["stress_max"]
        sleepScore = row["sleep_score"]
        sleepStartAt = try row.instant("sleep_start_at", optional: true)
        sleepEndAt = try row.instant("sleep_end_at", optional: true)
        sleepSeconds = row["sleep_seconds"]
        deepSeconds = row["deep_seconds"]
        lightSeconds = row["light_seconds"]
        remSeconds = row["rem_seconds"]
        awakeSeconds = row["awake_seconds"]
        respirationAvg = row["respiration_avg"]
        spo2Avg = row["spo2_avg"]
        skinTempNightlyC = row["skin_temp_nightly_c"]
        skinTempDeviationC = row["skin_temp_deviation_c"]
        readinessScore = row["readiness_score"]
        readinessLevel = row["readiness_level"]
        acuteLoad = row["acute_load"]
        vo2Max = row["vo2_max"]
        steps = row["steps"]
        activeKcal = row["active_kcal"]
        totalKcal = row["total_kcal"]
        strain = row["strain"]
        syncedAt = try row.instant("synced_at")
        stressSeries = try row.json("stress_series")
        heartRateSeries = try row.json("heart_rate_series")
        rawStressSeries = try row.json("raw_stress_series")
        bodyBatterySeries = try row.json("body_battery_series")
        motionSpans = try row.json("motion_spans")
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = id
        container["resting_heart_rate"] = restingHeartRate
        container["hrv_last_night"] = hrvLastNight
        container["hrv_weekly_avg"] = hrvWeeklyAvg
        container["hrv_status"] = hrvStatus
        container["body_battery_wake"] = bodyBatteryWake
        container["body_battery_high"] = bodyBatteryHigh
        container["body_battery_low"] = bodyBatteryLow
        container["body_battery_charged"] = bodyBatteryCharged
        container["body_battery_drained"] = bodyBatteryDrained
        container["stress_avg"] = stressAvg
        container["stress_max"] = stressMax
        container["sleep_score"] = sleepScore
        container["sleep_start_at"] = sleepStartAt.map(Instant.text)
        container["sleep_end_at"] = sleepEndAt.map(Instant.text)
        container["sleep_seconds"] = sleepSeconds
        container["deep_seconds"] = deepSeconds
        container["light_seconds"] = lightSeconds
        container["rem_seconds"] = remSeconds
        container["awake_seconds"] = awakeSeconds
        container["respiration_avg"] = respirationAvg
        container["spo2_avg"] = spo2Avg
        container["skin_temp_nightly_c"] = skinTempNightlyC
        container["skin_temp_deviation_c"] = skinTempDeviationC
        container["readiness_score"] = readinessScore
        container["readiness_level"] = readinessLevel
        container["acute_load"] = acuteLoad
        container["vo2_max"] = vo2Max
        container["steps"] = steps
        container["active_kcal"] = activeKcal
        container["total_kcal"] = totalKcal
        container["strain"] = strain
        container["synced_at"] = Instant.text(syncedAt)
        container["stress_series"] = try RowJSON.text(stressSeries)
        container["heart_rate_series"] = try RowJSON.text(heartRateSeries)
        container["raw_stress_series"] = try RowJSON.text(rawStressSeries)
        container["body_battery_series"] = try RowJSON.text(bodyBatterySeries)
        container["motion_spans"] = try RowJSON.text(motionSpans)
    }
}

/// A row of the synced `garmin_activities` table: one recorded Garmin activity with its 1-second heart rate stream.
struct GarminActivity: SyncedRecord {
    static let table = "garmin_activities"

    var id: String
    var name: String
    var activityType: String
    var startedAt: Date
    var endedAt: Date
    var durationSeconds: Double
    var calories: Double?
    var distanceMeters: Double?
    var averageHeartRate: Double?
    var maxHeartRate: Double?
    var strain: Double?
    var heartRateSeries: [GarminSeriesPoint]

    init(
        id: String,
        name: String,
        activityType: String,
        startedAt: Date,
        endedAt: Date,
        durationSeconds: Double,
        calories: Double? = nil,
        distanceMeters: Double? = nil,
        averageHeartRate: Double? = nil,
        maxHeartRate: Double? = nil,
        strain: Double? = nil,
        heartRateSeries: [GarminSeriesPoint] = []
    ) {
        self.id = id
        self.name = name
        self.activityType = activityType
        self.startedAt = startedAt.storedInstant
        self.endedAt = endedAt.storedInstant
        self.durationSeconds = durationSeconds
        self.calories = calories
        self.distanceMeters = distanceMeters
        self.averageHeartRate = averageHeartRate
        self.maxHeartRate = maxHeartRate
        self.strain = strain
        self.heartRateSeries = heartRateSeries
    }

    init(row: Row) throws {
        id = row["id"]
        name = row["name"]
        activityType = row["activity_type"]
        startedAt = try row.instant("started_at")
        endedAt = try row.instant("ended_at")
        durationSeconds = row["duration_seconds"]
        calories = row["calories"]
        distanceMeters = row["distance_meters"]
        averageHeartRate = row["average_heart_rate"]
        maxHeartRate = row["max_heart_rate"]
        strain = row["strain"]
        heartRateSeries = try row.json("heart_rate_series")
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = id
        container["name"] = name
        container["activity_type"] = activityType
        container["started_at"] = Instant.text(startedAt)
        container["ended_at"] = Instant.text(endedAt)
        container["duration_seconds"] = durationSeconds
        container["calories"] = calories
        container["distance_meters"] = distanceMeters
        container["average_heart_rate"] = averageHeartRate
        container["max_heart_rate"] = maxHeartRate
        container["strain"] = strain
        container["heart_rate_series"] = try RowJSON.text(heartRateSeries)
    }
}

/// Snapshot of one day's Strain & Stress chart and detail view. Consumers should observe `query(for:)`
/// asynchronously (`ValueObservation.values(in:)`) on pushed screens so decoding stays off the main thread.
struct StrainDaySnapshot: Equatable, Sendable {
    struct ActivityBand: Identifiable, Hashable, Sendable {
        enum Kind: Hashable, Sendable {
            case sleep, workout, walk, run, cardio, other
        }

        var id: String
        var title: String
        var kind: Kind
        var start: Date
        var end: Date
        var detail: String
        var strain: Double?

        var symbol: String {
            switch kind {
            case .sleep: "moon.fill"
            case .workout: "dumbbell.fill"
            case .walk: "figure.walk"
            case .run: "figure.run"
            case .cardio: "figure.highintensity.intervaltraining"
            case .other: "flame.fill"
            }
        }
    }

    struct PingMark: Identifiable, Hashable, Sendable {
        var id: UUID
        var at: Date
        var name: String
        var icon: String
        var color: PingColor
        var valueText: String?
        var note: String
    }

    var day: CalendarDay
    var garmin: GarminDay?
    var activities: [ActivityBand] = []
    var pings: [PingMark] = []
    var windowStart: Date
    var windowEnd: Date
    var lowMinutes: Int = 0
    var mediumMinutes: Int = 0
    var highMinutes: Int = 0

    var latestStress: Double? { garmin?.stressSeries.last?.value }

    var stressLevelLabel: String? {
        guard let latestStress else { return nil }
        if latestStress < 1.0 { return "Low" }
        if latestStress < 2.0 { return "Medium" }
        return "High"
    }

    static func empty(for day: CalendarDay, calendar: Calendar = .current) -> StrainDaySnapshot {
        let start = day.date(in: calendar)
        return StrainDaySnapshot(day: day, garmin: nil, windowStart: start, windowEnd: start.addingTimeInterval(86_400))
    }

    static func query(for day: CalendarDay, calendar: Calendar = .current) -> DatabaseQuery<StrainDaySnapshot> {
        DatabaseQuery(.empty(for: day, calendar: calendar)) { db in
            let dayStart = day.date(in: calendar)
            let dayEnd = day.adding(days: 1).date(in: calendar)
            let garmin = try GarminDay.fetchOne(db, key: day.description)

            let startText = Instant.text(dayStart)
            let endText = Instant.text(dayEnd)
            let garminActs = try GarminActivity
                .filter(Column("started_at") >= startText && Column("started_at") < endText)
                .fetchAll(db)
            let healthActs = try HealthActivity
                .filter(Column("started_at") >= startText && Column("started_at") < endText)
                .fetchAll(db)
            let workouts = try WorkoutSession
                .filter(Column("started_at") >= startText && Column("started_at") < endText)
                .fetchAll(db)

            var bands: [ActivityBand] = []

            if let sStart = garmin?.sleepStartAt, let sEnd = garmin?.sleepEndAt, sEnd > sStart {
                let mins = Int(sEnd.timeIntervalSince(sStart) / 60)
                bands.append(ActivityBand(
                    id: "sleep-\(day.description)",
                    title: "Sleep",
                    kind: .sleep,
                    start: max(sStart, dayStart.addingTimeInterval(-3 * 3600)),
                    end: sEnd,
                    detail: "\(mins / 60)h \(mins % 60)m" + (garmin?.sleepScore.map { " · Score \($0)" } ?? ""),
                    strain: nil
                ))
            }

            func overlapsExisting(_ start: Date, _ end: Date) -> Bool {
                bands.contains { band in
                    band.kind != .sleep && min(band.end, end).timeIntervalSince(max(band.start, start)) > 60
                }
            }

            for session in workouts {
                let end = session.endedAt ?? max(session.startedAt.addingTimeInterval(1800), .now)
                let mins = max(1, Int(end.timeIntervalSince(session.startedAt) / 60))
                bands.append(ActivityBand(
                    id: "workout-\(session.key)",
                    title: session.name,
                    kind: .workout,
                    start: session.startedAt,
                    end: end,
                    detail: "\(mins)m",
                    strain: nil
                ))
            }

            for act in garminActs {
                if overlapsExisting(act.startedAt, act.endedAt) { continue }
                let mins = max(1, Int(act.durationSeconds / 60))
                var parts = ["\(mins)m"]
                if let kcal = act.calories { parts.append("\(Int(kcal.rounded())) kcal") }
                if let hr = act.averageHeartRate { parts.append("\(Int(hr.rounded())) bpm") }
                bands.append(ActivityBand(
                    id: "garmin-\(act.id)",
                    title: act.name,
                    kind: Self.classify(act.activityType),
                    start: act.startedAt,
                    end: act.endedAt,
                    detail: parts.joined(separator: " · "),
                    strain: act.strain
                ))
            }

            for act in healthActs {
                if overlapsExisting(act.startedAt, act.endedAt) { continue }
                let mins = max(1, Int(act.endedAt.timeIntervalSince(act.startedAt) / 60))
                var parts = ["\(mins)m"]
                if let kcal = act.activeKcal { parts.append("\(Int(kcal.rounded())) kcal") }
                if let hr = act.averageHeartRate { parts.append("\(Int(hr.rounded())) bpm") }
                bands.append(ActivityBand(
                    id: "health-\(act.key)",
                    title: act.title,
                    kind: Self.classify(act.activityType),
                    start: act.startedAt,
                    end: act.endedAt,
                    detail: parts.joined(separator: " · "),
                    strain: nil
                ))
            }

            for span in garmin?.motionSpans ?? [] {
                if overlapsExisting(span.startDate, span.endDate) { continue }
                let mins = max(1, Int((span.end - span.start) / 60))
                bands.append(ActivityBand(
                    id: "motion-\(Int(span.start))",
                    title: "Walk / Active",
                    kind: .walk,
                    start: span.startDate,
                    end: span.endDate,
                    detail: "\(mins)m detected",
                    strain: nil
                ))
            }

            bands.sort { $0.start < $1.start }

            let logs = try PingLog.on(day, in: db, calendar: calendar)
            let pingsByID = Dictionary(uniqueKeysWithValues: try Ping.fetchAll(db).map { ($0.id, $0) })
            let pingMarks: [PingMark] = logs.compactMap { log in
                guard let ping = pingsByID[log.pingID] else { return nil }
                let valueText: String? = switch ping.kind {
                case .boolean: nil
                case let .range(steps):
                    (log.value >= 1 && log.value <= steps.count && !steps[log.value - 1].isEmpty)
                        ? "\(log.value) (\(steps[log.value - 1]))"
                        : "\(log.value)/\(steps.count)"
                }
                return PingMark(
                    id: log.id,
                    at: log.loggedAt,
                    name: ping.name,
                    icon: ping.icon,
                    color: ping.color ?? .fallback,
                    valueText: valueText,
                    note: log.note
                )
            }.sorted { $0.at < $1.at }

            let points = garmin?.stressSeries ?? []
            var low = 0, med = 0, high = 0
            for i in points.indices {
                let stepMin: Int
                if i + 1 < points.count {
                    stepMin = min(10, max(1, Int((points[i + 1].epochSec - points[i].epochSec) / 60)))
                } else {
                    stepMin = 3
                }
                let v = points[i].value
                if v < 1.0 { low += stepMin }
                else if v < 2.0 { med += stepMin }
                else { high += stepMin }
            }

            let windowStart = min(dayStart, bands.first(where: { $0.kind == .sleep })?.start ?? dayStart)
            let isToday = day == CalendarDay(.now, in: calendar)
            let lastData = points.last?.date ?? dayStart.addingTimeInterval(3600)
            let windowEnd = isToday ? max(Date.now, lastData) : dayEnd

            return StrainDaySnapshot(
                day: day,
                garmin: garmin,
                activities: bands,
                pings: pingMarks,
                windowStart: windowStart,
                windowEnd: max(windowStart.addingTimeInterval(3600), windowEnd),
                lowMinutes: low,
                mediumMinutes: med,
                highMinutes: high
            )
        }
    }

    private static func classify(_ rawType: String) -> ActivityBand.Kind {
        let lower = rawType.lowercased()
        if lower.contains("walk") || lower.contains("hik") { return .walk }
        if lower.contains("run") { return .run }
        if lower.contains("strength") || lower.contains("weight") || lower.contains("training") { return .workout }
        if lower.contains("cycl") || lower.contains("swim") || lower.contains("cardio") || lower.contains("row") { return .cardio }
        return .other
    }
}
