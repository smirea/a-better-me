import Foundation

/// What one step widget refresh showed, kept in the app group. A locked refresh can't read Health, so it starts from
/// the last refresh's days, and the next refresh compares its count with `today` to tell whether the owner is moving.
struct StepsReading: Codable, Equatable, Sendable {
    let date: Date
    /// Each day's largest count the widget has seen over the last month, from Health or the phone's pedometer.
    let days: [DatedValue]
    /// Today's count as the widget showed it.
    let today: Double

    static var url: URL? { AppGroup.url("Widgets/steps-live.json") }

    static func load() -> StepsReading? {
        guard let url, let data = try? Data(contentsOf: url) else { return nil }
        return decode(data)
    }

    /// Builds before this type kept only Health's last read, as a bare list of days.
    static func decode(_ data: Data) -> StepsReading? {
        if let reading = try? JSONDecoder().decode(StepsReading.self, from: data) { return reading }
        return (try? JSONDecoder().decode([DatedValue].self, from: data)).map { StepsReading(date: .distantPast, days: $0, today: 0) }
    }

    /// The last refresh's days raised by Health's fresh read and the phone's count for today, so a locked refresh never
    /// shows less than the widget already showed, also for yesterday once midnight passes.
    static func days(previous: [DatedValue], health: [DatedValue], phoneToday: Double?, today: Date, calendar: Calendar) -> [DatedValue] {
        let start = calendar.date(byAdding: .day, value: -30, to: today)!
        var largest: [Date: Double] = [:]
        for point in previous + health where point.date >= start { largest[point.date] = max(largest[point.date] ?? 0, point.value) }
        let days = largest.map { DatedValue(date: $0.key, value: $0.value) }.sorted { $0.date < $1.date }
        return PhonePedometer.merge(phoneToday, into: days, today: today)
    }

    func save() throws {
        guard let url = Self.url else { throw CocoaError(.fileNoSuchFile) }
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try JSONEncoder().encode(self).write(to: url, options: .atomic)
    }
}

/// How soon the step widgets ask to refresh. WidgetKit gives a widget the owner looks at often about 40 to 70
/// refreshes a day, so they are spent while the owner moves and saved while the count stands still.
enum StepsCadence {
    static let moving: TimeInterval = 5 * 60
    static let still: TimeInterval = 30 * 60
    /// The span the phone's pedometer is asked about.
    static let recentWindow: TimeInterval = 10 * 60
    /// Walking runs about 100 steps a minute. 20 still counts a stroll with stops, or a gym floor between sets, and
    /// leaves out a few steps across a room.
    static let movingStepsPerMinute = 20.0

    /// `recentPhoneSteps` is the pedometer's count over `recentWindow`, nil when it can't be read.
    static func interval(recentPhoneSteps: Double?, previous: StepsReading?, current: StepsReading) -> TimeInterval {
        if let recentPhoneSteps, recentPhoneSteps / (recentWindow / 60) >= movingStepsPerMinute { return moving }
        if let previous, current.date > previous.date {
            let minutes = current.date.timeIntervalSince(previous.date) / 60
            if (current.today - previous.today) / minutes >= movingStepsPerMinute { return moving }
        }
        return still
    }
}
