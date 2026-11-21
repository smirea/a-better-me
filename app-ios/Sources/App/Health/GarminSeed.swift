#if DEBUG
import Foundation
import GRDB

/// Seeds 7 realistic days of Garmin CIRQA telemetry in Debug simulator builds when `garmin_days` is empty.
enum GarminSeed {
    static func insert(in db: Database, now: Date = .now, calendar: Calendar = .current) throws {
        let today = CalendarDay(now, in: calendar)
        for offset in 0..<7 {
            let day = today.adding(days: -offset)
            let dayStart = day.date(in: calendar)
            let sleepStart = dayStart.addingTimeInterval(20 * 60)
            let sleepEnd = dayStart.addingTimeInterval(7 * 3600 + 18 * 60)
            let isToday = offset == 0
            let endTime = isToday ? max(sleepEnd.addingTimeInterval(3600), min(now, dayStart.addingTimeInterval(23 * 3600))) : dayStart.addingTimeInterval(23 * 3600 + 30 * 60)

            let walk1Start = dayStart.addingTimeInterval(9 * 3600 + 30 * 60)
            let walk1End = walk1Start.addingTimeInterval(22 * 60)
            let walk2Start = dayStart.addingTimeInterval(13 * 3600 + 15 * 60)
            let walk2End = walk2Start.addingTimeInterval(28 * 60)

            var stressSeries: [GarminSeriesPoint] = []
            var hrSeries: [GarminSeriesPoint] = []
            var bbSeries: [GarminSeriesPoint] = []

            var t = dayStart
            var idx = 0
            while t <= endTime {
                let sec = t.timeIntervalSince1970
                let inSleep = t >= sleepStart && t <= sleepEnd
                let inWalk1 = t >= walk1Start && t <= walk1End
                let inWalk2 = t >= walk2Start && t <= walk2End
                let wave = sin(Double(idx) * 0.35 + Double(offset)) * 0.25 + cos(Double(idx) * 0.13) * 0.18

                let stress: Double
                let bpm: Double
                if inSleep {
                    stress = max(0.25, min(0.95, 0.48 + wave * 0.35))
                    bpm = 58 + wave * 6
                } else if inWalk1 || inWalk2 {
                    stress = max(1.85, min(2.65, 2.25 + wave * 0.3))
                    bpm = 116 + wave * 12
                } else {
                    let hour = calendar.component(.hour, from: t)
                    let afternoonBump = hour >= 15 ? 0.32 : 0.0
                    stress = max(0.55, min(2.55, 1.28 + afternoonBump + wave * 0.75))
                    bpm = 76 + afternoonBump * 18 + wave * 10
                }

                let progress = t.timeIntervalSince(dayStart) / 86_400
                let bb = inSleep ? Int(35 + progress * 140) : max(12, Int(82 - (progress - 0.3) * 75))
                stressSeries.append(GarminSeriesPoint(epochSec: sec, value: (stress * 100).rounded() / 100))
                hrSeries.append(GarminSeriesPoint(epochSec: sec, value: bpm.rounded()))
                bbSeries.append(GarminSeriesPoint(epochSec: sec, value: Double(min(100, max(5, bb)))))

                t = t.addingTimeInterval(3 * 60)
                idx += 1
            }

            let motionSpans = [
                GarminMotionSpan(start: walk1Start.timeIntervalSince1970, end: walk1End.timeIntervalSince1970),
                GarminMotionSpan(start: walk2Start.timeIntervalSince1970, end: walk2End.timeIntervalSince1970),
            ].filter { $0.startDate <= endTime }

            let garminDay = GarminDay(
                id: day.description,
                restingHeartRate: 58 + (offset % 4),
                hrvLastNight: Double(44 + (offset % 9)),
                hrvWeeklyAvg: 48,
                hrvStatus: "balanced",
                bodyBatteryWake: 78 - (offset % 12),
                bodyBatteryHigh: 84,
                bodyBatteryLow: 18,
                bodyBatteryCharged: 52,
                bodyBatteryDrained: 58,
                stressAvg: 34 + (offset % 8),
                stressMax: 84,
                sleepScore: 81 - (offset % 9),
                sleepStartAt: sleepStart,
                sleepEndAt: sleepEnd,
                sleepSeconds: Int(sleepEnd.timeIntervalSince(sleepStart)),
                deepSeconds: 5_400,
                lightSeconds: 13_200,
                remSeconds: 6_300,
                awakeSeconds: 900,
                respirationAvg: 14.8,
                spo2Avg: 97,
                skinTempNightlyC: 35.9,
                skinTempDeviationC: -0.04,
                readinessScore: 76 - (offset % 14),
                readinessLevel: "high",
                steps: 8_420 + offset * 310,
                activeKcal: 460 + Double(offset * 25),
                totalKcal: 2_480 + Double(offset * 30),
                strain: ((8.4 + Double(offset % 5) * 1.3) * 10).rounded() / 10,
                syncedAt: now,
                stressSeries: stressSeries,
                heartRateSeries: hrSeries,
                bodyBatterySeries: bbSeries,
                motionSpans: motionSpans
            )
            try garminDay.save(db)

            if walk1End <= endTime {
                let act = GarminActivity(
                    id: "seed-\(day.description)-walk",
                    name: "Morning Walk",
                    activityType: "walking",
                    startedAt: walk1Start,
                    endedAt: walk1End,
                    durationSeconds: walk1End.timeIntervalSince(walk1Start),
                    calories: 142,
                    distanceMeters: 1_920,
                    averageHeartRate: 114,
                    maxHeartRate: 128,
                    strain: 4.2,
                    heartRateSeries: []
                )
                try act.save(db)
            }
        }
    }
}
#endif
