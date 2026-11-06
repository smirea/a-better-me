import Foundation

/// What one step widget refresh read, kept in the app group. A locked refresh can't read Health, so it reuses the
/// last read that succeeded, and the next refresh compares its count with `today` to tell whether the owner is moving.
struct StepsReading: Codable, Equatable, Sendable {
    let date: Date
    /// Health's daily counts from the last read that succeeded.
    let health: [DatedValue]
    /// Today's count as the widget showed it.
    let today: Double

    static var url: URL? { AppGroup.url("Widgets/steps-live.json") }

    static func load() -> StepsReading? {
        guard let url, let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(StepsReading.self, from: data)
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
