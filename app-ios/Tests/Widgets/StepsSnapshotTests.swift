import Foundation
import Testing
@testable import App

struct StepsSnapshotTests {
    private func point(_ text: String, _ value: Double) -> DatedValue { DatedValue(date: day(text, 0), value: value) }

    @Test func keysDaysOnTheCalendarAndAddsSamplesOfOneDay() {
        let snapshot = StepsSnapshot(goal: 8_000, steps: [point("2026-10-27", 4000), point("2026-10-28", 3000), point("2026-10-28", 500)], calendar: utc)
        #expect(snapshot.days == ["2026-10-27": 4000, "2026-10-28": 3500])
    }

    @Test func aLiveReadRaisesTodayAndKeepsImportedDays() {
        let snapshot = StepsSnapshot(goal: 10_000, days: ["2026-10-26": 12000, "2026-10-27": 10400, "2026-10-28": 3200])
        let summary = snapshot.summary(live: [point("2026-10-27", 9000), point("2026-10-28", 10100)], now: day("2026-10-28", 18), calendar: utc)
        #expect(summary.today == 10100)
        #expect(summary.streak == 3)
        #expect(summary.week.suffix(3).map(\.steps) == [12000, 10400, 10100])
    }

    @Test func midnightStartsANewDayAtZeroWithoutBreakingTheStreak() {
        let snapshot = StepsSnapshot(goal: 10_000, days: ["2026-10-27": 10400, "2026-10-28": 11000])
        let summary = snapshot.summary(live: [], now: day("2026-10-29", 0), calendar: utc)
        #expect(summary.today == 0)
        #expect(summary.streak == 2)
        #expect(summary.week.last?.tier == .far)
    }

    @Test func theStepsScreenOpensFromItsLink() {
        #expect(QuickAction(url: URL(string: "abetterme://action/steps")!) == .steps)
    }
}
