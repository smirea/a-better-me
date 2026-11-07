import Foundation
import Testing
@testable import App

struct StepsCadenceTests {
    private let noon = day("2026-11-06", 12)

    private func reading(minutesAgo: Double = 0, today: Double) -> StepsReading {
        StepsReading(date: noon.addingTimeInterval(-minutesAgo * 60), days: [], today: today)
    }

    @Test func aWalkThePedometerFeltRefreshesInFiveMinutes() {
        let interval = StepsCadence.interval(recentPhoneSteps: 650, previous: reading(minutesAgo: 30, today: 4000), current: reading(today: 4000))
        #expect(interval == 300)
    }

    @Test func aFewStepsAcrossARoomWaitHalfAnHour() {
        let interval = StepsCadence.interval(recentPhoneSteps: 40, previous: reading(minutesAgo: 30, today: 4000), current: reading(today: 4040))
        #expect(interval == 1800)
    }

    @Test func withoutThePedometerACountThatClimbedSinceTheLastRefreshMeansMoving() {
        let interval = StepsCadence.interval(recentPhoneSteps: nil, previous: reading(minutesAgo: 30, today: 4000), current: reading(today: 4900))
        #expect(interval == 300)
    }

    @Test func withoutThePedometerASlowClimbStaysOnTheHalfHour() {
        let interval = StepsCadence.interval(recentPhoneSteps: nil, previous: reading(minutesAgo: 30, today: 4000), current: reading(today: 4300))
        #expect(interval == 1800)
    }

    @Test func midnightsResetIsNotMovement() {
        let interval = StepsCadence.interval(recentPhoneSteps: nil, previous: reading(minutesAgo: 20, today: 12000), current: reading(today: 0))
        #expect(interval == 1800)
    }

    @Test func aFirstRefreshWithNothingToCompareWaitsHalfAnHour() {
        #expect(StepsCadence.interval(recentPhoneSteps: nil, previous: nil, current: reading(today: 5000)) == 1800)
    }

    @Test func thePhoneRaisesTodayOnlyWhenItCountedMore() {
        let yesterday = DatedValue(date: day("2026-11-05", 0), value: 9000)
        let today = day("2026-11-06", 0)
        let health = [yesterday, DatedValue(date: today, value: 3000)]
        #expect(PhonePedometer.merge(3400, into: health, today: today) == [yesterday, DatedValue(date: today, value: 3400)])
        #expect(PhonePedometer.merge(2500, into: health, today: today) == health)
        #expect(PhonePedometer.merge(nil, into: health, today: today) == health)
        #expect(PhonePedometer.merge(800, into: [yesterday], today: today) == [yesterday, DatedValue(date: today, value: 800)])
    }

    @Test func aLockedRefreshAfterMidnightKeepsYesterdaysPedometerCount() {
        let yesterday = day("2026-11-05", 0)
        let today = day("2026-11-06", 0)
        let shown = [DatedValue(date: yesterday, value: 11000)]
        let days = StepsReading.days(previous: shown, health: [], phoneToday: 120, today: today, calendar: utc)
        #expect(days == [DatedValue(date: yesterday, value: 11000), DatedValue(date: today, value: 120)])
    }

    @Test func aFreshHealthReadRaisesDaysAndOldDaysFallOff() {
        let today = day("2026-11-06", 0)
        let previous = [DatedValue(date: day("2026-09-01", 0), value: 9000), DatedValue(date: day("2026-11-05", 0), value: 8000)]
        let health = [DatedValue(date: day("2026-11-05", 0), value: 9500), DatedValue(date: today, value: 2000)]
        let days = StepsReading.days(previous: previous, health: health, phoneToday: 1500, today: today, calendar: utc)
        #expect(days == [DatedValue(date: day("2026-11-05", 0), value: 9500), DatedValue(date: today, value: 2000)])
    }
}
