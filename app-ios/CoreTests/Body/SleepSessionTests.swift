import Foundation
import Testing
@testable import Core

struct SleepSessionTests {
    @Test func samplesLessThanAnHourApartAreOneSleepAndTimeTwoSourcesShareCountsOnce() {
        let watch = [interval("2026-11-18", 23, hours: 2), interval("2026-11-19", 1.5, hours: 5)]
        let phone = [interval("2026-11-18", 23.5, hours: 1), interval("2026-11-19", 14, hours: 0.5)]
        let sessions = SleepSession.sessions(watch + phone)
        #expect(sessions.map(\.start) == [day("2026-11-18", 23), day("2026-11-19", 14)])
        #expect(sessions.map(\.end) == [day("2026-11-19", 6).addingTimeInterval(1800), day("2026-11-19", 14).addingTimeInterval(1800)])
        #expect(sessions.map(\.asleep) == [7 * 3600, 1800])
    }

    @Test func aNightFallsAsleepOnTheEveningsDayAndWakesUpOnTheMornings() {
        let night = SleepSession.sessions([interval("2026-11-18", 23, hours: 8)])[0]
        #expect(night.markers(on: CalendarDay("2026-11-18")!, calendar: utc).map(\.kind) == [.asleep])
        #expect(night.markers(on: CalendarDay("2026-11-19")!, calendar: utc).map(\.kind) == [.wake])
        #expect(night.markers(on: CalendarDay("2026-11-20")!, calendar: utc).isEmpty)
    }

    @Test func aBedtimeAfterMidnightFallsAsleepOnTheEveningBefore() {
        let night = SleepSession.sessions([interval("2026-11-20", 1, hours: 7)])[0]
        #expect(night.markers(on: CalendarDay("2026-11-19")!, calendar: utc).map(\.kind) == [.asleep])
        #expect(night.markers(on: CalendarDay("2026-11-20")!, calendar: utc).map(\.kind) == [.wake])
    }

    private func interval(_ date: String, _ hour: Double, hours: Double) -> DateInterval {
        DateInterval(start: day(date, 0).addingTimeInterval(hour * 3600), duration: hours * 3600)
    }
}
