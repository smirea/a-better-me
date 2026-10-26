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
        let fromHealth = health
            .filter { sample in !logged.contains { abs($0.measuredAt.timeIntervalSince(sample.date)) < sameMomentTolerance } }
            .map { WeighIn(date: $0.date, kg: $0.kg, source: .health) }
        return (app + fromHealth).sorted { $0.date < $1.date }
    }
}

/// The Dashboard's trend is the Nutrition engine's, so the app has one trend algorithm; see docs/decisions/nutrition.md.
enum WeightTrend {
    static func daily(_ weighIns: [DatedValue], through end: Date, calendar: Calendar) -> [DatedValue] {
        NutritionEngine.TrendWeight.daily(weighIns: weighIns, through: end, calendar: calendar)
    }
}
