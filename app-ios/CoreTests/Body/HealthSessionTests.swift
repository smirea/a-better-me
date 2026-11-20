import Foundation
import Testing
@testable import Core

struct HealthSessionTests {
    private let garmin = HealthSource(bundle: "com.garmin.connect.mobile", name: "Connect")
    private let whoop = HealthSource(bundle: "com.whoop.iphone", name: "WHOOP")
    private let watch = HealthSource(bundle: "com.apple.health.81C5", name: "Apple Watch")
    private let thisApp = HealthSource(bundle: "com.stefan.a-better-me.watchkitapp", name: "A Better Me")

    @Test func oneAppsSamplesLessThanAnHourApartAreOneSleepWithTimeTheyShareCountedOnceAndItsStagesSummed() {
        let samples = [
            sample(garmin, "2026-11-18", 23, hours: 2, .core), sample(garmin, "2026-11-19", 1, hours: 0.25, .awake),
            sample(garmin, "2026-11-19", 1.5, hours: 5, .deep), sample(garmin, "2026-11-18", 23.5, hours: 1, .asleep),
            sample(garmin, "2026-11-19", 14, hours: 0.5, .rem), sample(garmin, "2026-11-18", 22, hours: 9, .inBed),
        ]
        let sleeps = HealthSleep.deduplicated(samples)
        #expect(sleeps.map(\.startedAt) == [day("2026-11-18", 23), day("2026-11-19", 14)])
        #expect(sleeps.map(\.endedAt) == [at("2026-11-19", 6.5), at("2026-11-19", 14.5)])
        #expect(sleeps.map(\.asleepSeconds) == [7 * 3600, 1800])
        #expect(sleeps[0].awakeSeconds == 900)
        #expect([sleeps[0].coreSeconds, sleeps[0].deepSeconds, sleeps[0].remSeconds] == [7200, 18000, 0])
    }

    @Test func theBestRankedAppsSleepStandsForEveryOtherAppsSleepWithinThreeHoursOfIt() {
        let samples = [
            sample(garmin, "2026-11-20", 0.4, hours: 6.8, .core),
            sample(whoop, "2026-11-19", 21.4, hours: 1.2, .core), sample(whoop, "2026-11-19", 23.7, hours: 7.4, .deep),
            sample(whoop, "2026-11-20", 15, hours: 0.5, .asleep),
        ]
        let sleeps = HealthSleep.deduplicated(samples)
        #expect(sleeps.map(\.startedAt) == [at("2026-11-20", 0.4), at("2026-11-20", 15)])
        #expect(sleeps.map(\.sources) == [["Connect", "WHOOP"], ["WHOOP"]])
    }

    @Test func aNightFallsAsleepOnTheEveningsDayAndWakesUpOnTheMornings() {
        let night = HealthSleep.deduplicated([sample(garmin, "2026-11-18", 23, hours: 8, .core)])[0]
        #expect(night.markers(on: CalendarDay("2026-11-18")!, calendar: utc).map(\.kind) == [.asleep])
        #expect(night.markers(on: CalendarDay("2026-11-19")!, calendar: utc).map(\.kind) == [.wake])
        #expect(night.markers(on: CalendarDay("2026-11-20")!, calendar: utc).isEmpty)
    }

    @Test func aBedtimeAfterMidnightFallsAsleepOnTheEveningBefore() {
        let night = HealthSleep.deduplicated([sample(garmin, "2026-11-20", 1, hours: 7, .core)])[0]
        #expect(night.markers(on: CalendarDay("2026-11-19")!, calendar: utc).map(\.kind) == [.asleep])
        #expect(night.markers(on: CalendarDay("2026-11-20")!, calendar: utc).map(\.kind) == [.wake])
    }

    @Test func anotherAppsCopyOfASessionMergesIntoTheBestRankedOneWhichTakesWhatItLacks() {
        let garminRun = workout(garmin, "other", 19.45, minutes: 29, kcal: 300)
        let whoopRun = HealthWorkout(
            id: UUID(), activityType: "running", start: garminRun.start, end: garminRun.end, averageHeartRate: 150, source: whoop
        )
        let whoopWalk = workout(whoop, "walking", 16.9, minutes: 19)
        let watchWalk = workout(watch, "walking", 16.95, minutes: 15)
        let ownLift = workout(thisApp, "traditional_strength_training", 12, minutes: 60)
        let activities = HealthActivity.deduplicated([whoopRun, whoopWalk, garminRun, watchWalk, ownLift])
        #expect(activities.map(\.id) == [watchWalk.id, garminRun.id])
        #expect(activities.map(\.sources) == [["Apple Watch", "WHOOP"], ["Connect", "WHOOP"]])
        #expect(activities[1].activityType == "running")
        #expect(activities[1].activeKcal == 300)
        #expect(activities[1].averageHeartRate == 150)
    }

    private func at(_ date: String, _ hour: Double) -> Date { day(date, 0).addingTimeInterval(hour * 3600) }

    private func sample(_ source: HealthSource, _ date: String, _ hour: Double, hours: Double, _ stage: HealthSleepSample.Stage) -> HealthSleepSample {
        HealthSleepSample(id: UUID(), start: at(date, hour), end: at(date, hour + hours), stage: stage, source: source)
    }

    private func workout(_ source: HealthSource, _ type: String, _ hour: Double, minutes: Double, kcal: Double? = nil) -> HealthWorkout {
        HealthWorkout(
            id: UUID(), activityType: type, start: at("2026-11-19", hour), end: at("2026-11-19", hour + minutes / 60), activeKcal: kcal,
            source: source
        )
    }
}
