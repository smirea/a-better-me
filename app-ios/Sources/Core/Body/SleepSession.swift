import Foundation

/// One sleep, a night or a nap, joined from Apple Health's sleep samples.
struct SleepSession: Hashable, Sendable {
    var start: Date
    var end: Date
    /// The time asleep, which leaves out what the night spent awake.
    var asleep: TimeInterval

    /// Samples closer than this are one sleep: Health writes a sample per sleep stage, and a stretch awake in the
    /// night leaves a gap between two of them.
    static let maxGap: TimeInterval = 3600

    /// `asleep` is every sample of a stage asleep. A watch and a phone both write the same night, so time two samples
    /// share counts once.
    static func sessions(_ asleep: [DateInterval]) -> [SleepSession] {
        var sessions: [SleepSession] = []
        for sample in asleep.sorted(by: { $0.start < $1.start }) {
            guard var session = sessions.last, sample.start <= session.end.addingTimeInterval(maxGap) else {
                sessions.append(SleepSession(start: sample.start, end: sample.end, asleep: sample.duration))
                continue
            }
            session.asleep += max(0, sample.end.timeIntervalSince(max(sample.start, session.end)))
            session.end = max(session.end, sample.end)
            sessions[sessions.count - 1] = session
        }
        return sessions
    }

    /// The moments of this sleep that fall on `day`: falling asleep on the evening's day, waking up on the morning's.
    func markers(on day: CalendarDay, calendar: Calendar = .current) -> [TimelineMarker] {
        var markers: [TimelineMarker] = []
        if CalendarDay(start, in: calendar) == day {
            markers.append(TimelineMarker(id: "asleep/\(start.timeIntervalSince1970)", kind: .asleep, at: start, title: "Fell Asleep"))
        }
        if CalendarDay(end, in: calendar) == day {
            markers.append(TimelineMarker(
                id: "wake/\(end.timeIntervalSince1970)", kind: .wake, at: end, title: "Woke Up", detail: "\(asleep.hoursAndMinutes) asleep"
            ))
        }
        return markers
    }
}
