import Foundation

/// The step history the app last saw, Health's days with the imported ones filling gaps, and the goal from settings.
/// The step widgets read Health themselves for the recent days, and fall back on this when Health is locked.
struct StepsSnapshot: Codable, Equatable, Sendable {
    let goal: Int
    /// Steps per day, keyed `YYYY-MM-DD` on the owner's calendar.
    let days: [String: Double]

    static var url: URL? { AppGroup.url("Widgets/steps.json") }

    static func load() -> StepsSnapshot? {
        guard let url, let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(StepsSnapshot.self, from: data)
    }

    func save() throws {
        guard let url = Self.url else { throw CocoaError(.fileNoSuchFile) }
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try JSONEncoder().encode(self).write(to: url, options: .atomic)
    }

    /// Takes the larger count for each day: every source undercounts a day still in progress, so the larger is the
    /// fresher, and Health's live read never drops a day the snapshot got from an import.
    func summary(live: [DatedValue], now: Date, calendar: Calendar = .current) -> StepGoal.Summary {
        var merged = days
        for point in live {
            let key = CalendarDay(point.date, in: calendar).description
            merged[key] = max(merged[key] ?? 0, point.value)
        }
        let steps = merged.compactMap { key, value in CalendarDay(key).map { DatedValue(date: $0.date(in: calendar), value: value) } }
        return StepGoal.summary(steps, goal: goal, today: now, calendar: calendar)
    }
}

extension StepsSnapshot {
    init(goal: Int, steps: [DatedValue], calendar: Calendar = .current) {
        var days: [String: Double] = [:]
        for point in steps { days[CalendarDay(point.date, in: calendar).description, default: 0] += point.value }
        self.init(goal: goal, days: days)
    }
}
