import Foundation

struct HealthWeight: Hashable {
    var id: UUID
    var date: Date
    var kg: Double
}

struct WeighIn: Hashable {
    enum Source: Hashable {
        case app(UUID)
        case health
    }

    var date: Date
    var kg: Double
    var source: Source
}

enum WeighIns {
    static let sameMomentTolerance: TimeInterval = 60

    /// A HealthKit sample next to an app weigh-in is the same weigh-in written to Health by another app; the app row wins.
    static func merge(logged: [BodyWeight], health: [HealthWeight]) -> [WeighIn] {
        let app = logged.map { WeighIn(date: $0.measuredAt, kg: $0.weightKg, source: .app($0.id)) }
        let appDates = logged.map(\.measuredAt).sorted()
        var next = 0
        var fromHealth: [WeighIn] = []
        for sample in health.sorted(by: { $0.date < $1.date }) {
            while next < appDates.count, appDates[next] <= sample.date.addingTimeInterval(-sameMomentTolerance) { next += 1 }
            if next < appDates.count, appDates[next] < sample.date.addingTimeInterval(sameMomentTolerance) { continue }
            fromHealth.append(WeighIn(date: sample.date, kg: sample.kg, source: .health))
        }
        return (app + fromHealth).sorted { $0.date < $1.date }
    }
}

/// MF's V1 trend: it only looks back, so a new weigh-in never rewrites past days.
enum WeightTrend {
    /// 0.1 is the Hacker's Diet value MF's trend is modeled on; see docs/decisions/workouts.md.
    static let dailySmoothing = 0.1

    /// After a gap of `d` days a weigh-in closes `1 - 0.9^d` of the gap, as if the missed days had weighed the same.
    static func daily(_ weighIns: [DatedValue], through end: Date, calendar: Calendar) -> [DatedValue] {
        let days = DailyCombine.mean.combine(weighIns, calendar: calendar)
        guard let first = days.first else { return [] }
        let lastDay = calendar.startOfDay(for: end)
        var result: [DatedValue] = []
        var trend = first.value
        var trendDay = first.date
        var pending = days.dropFirst()[...]
        var day = first.date
        while day <= lastDay {
            if let weighIn = pending.first, calendar.isDate(weighIn.date, inSameDayAs: day) {
                // Day numbers, not elapsed time, because a daylight-saving day is 23 or 25 hours long.
                let gap = Double(calendar.ordinality(of: .day, in: .era, for: day)! - calendar.ordinality(of: .day, in: .era, for: trendDay)!)
                trend += (1 - pow(1 - dailySmoothing, gap)) * (weighIn.value - trend)
                trendDay = day
                pending.removeFirst()
            }
            result.append(DatedValue(date: day, value: trend))
            // A day after a midnight daylight-saving change starts at 01:00, so each step starts from that day's own start.
            day = calendar.startOfDay(for: calendar.date(byAdding: .day, value: 1, to: day)!)
        }
        return result
    }
}
