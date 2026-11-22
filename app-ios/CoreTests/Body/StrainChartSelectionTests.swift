import Foundation
import Testing
@testable import Core

@Suite("StrainChartSelection")
struct StrainChartSelectionTests {
    private let base = Date(timeIntervalSince1970: 1_700_000_000)

    private func snapshot(
        activities: [StrainDaySnapshot.ActivityBand] = [],
        pings: [StrainDaySnapshot.PingMark] = [],
        stress: [GarminSeriesPoint] = [],
        hr: [GarminSeriesPoint] = []
    ) -> StrainDaySnapshot {
        let day = CalendarDay(base)
        return StrainDaySnapshot(
            day: day,
            garmin: GarminDay(id: day.description, stressSeries: stress, heartRateSeries: hr),
            activities: activities,
            pings: pings,
            windowStart: base,
            windowEnd: base.addingTimeInterval(24 * 3600)
        )
    }

    @Test("Tapping the chart returns all pings within the pixel hit radius and excludes farther ones")
    func nearbyPingsWithinHitRadius() {
        // 24h mapped across 240 pt => 10 pt/hour.
        let p1 = StrainDaySnapshot.PingMark(id: UUID(), at: base.addingTimeInterval(11 * 3600), name: "Brain Fog", icon: "brain", color: .orange, valueText: nil, note: "")
        let p2 = StrainDaySnapshot.PingMark(id: UUID(), at: base.addingTimeInterval(11 * 3600 + 18 * 60), name: "Drive", icon: "car.fill", color: .purple, valueText: "3", note: "")
        let far = StrainDaySnapshot.PingMark(id: UUID(), at: base.addingTimeInterval(14 * 3600), name: "Water", icon: "drop.fill", color: .blue, valueText: nil, note: "")

        let snap = snapshot(pings: [p1, p2, far])
        // Tap at 11:00 AM => x = 110 pt. p1 is at 110 pt (0 pt away), p2 is at 113 pt (3 pt away), far is at 140 pt (30 pt away).
        let sel = snap.selection(atX: 110, plotWidth: 240, pingHitRadius: 10)
        #expect(sel.pings.map(\.name) == ["Brain Fog", "Drive"])
    }

    @Test("Tapping inside or just beside an activity or sleep band includes that event")
    func overlappingAndNearbyEvents() {
        // 24h across 240 pt => 10 pt/hour.
        let sleep = StrainDaySnapshot.ActivityBand(
            id: "sleep", title: "Sleep", kind: .sleep,
            start: base.addingTimeInterval(0), end: base.addingTimeInterval(7 * 3600),
            detail: "7h 0m", strain: nil
        )
        let walk = StrainDaySnapshot.ActivityBand(
            id: "walk", title: "Morning Walk", kind: .walk,
            start: base.addingTimeInterval(9 * 3600 + 30 * 60), end: base.addingTimeInterval(9 * 3600 + 45 * 60),
            detail: "15m", strain: 2.1
        )
        let snap = snapshot(activities: [sleep, walk])

        let duringSleep = snap.selection(atX: 30, plotWidth: 240)
        #expect(duringSleep.activities.map(\.id) == ["sleep"])

        // Walk is at x = 95...97.5 pt; tapping at 99 pt (1.5 pt away) still hits it.
        let nearWalk = snap.selection(atX: 99, plotWidth: 240, activityHitRadius: 6)
        #expect(nearWalk.activities.map(\.id) == ["walk"])

        // Tapping at 15:00 (150 pt) hits neither.
        let empty = snap.selection(atX: 150, plotWidth: 240)
        #expect(empty.activities.isEmpty)
    }

    @Test("Tapping returns nearest stress and heart rate only when within 15 minutes")
    func nearestStressAndHeartRate() {
        let s1 = GarminSeriesPoint(epochSec: base.addingTimeInterval(10 * 3600).timeIntervalSince1970, value: 1.45)
        let hr1 = GarminSeriesPoint(epochSec: base.addingTimeInterval(10 * 3600 + 120).timeIntervalSince1970, value: 88)
        let snap = snapshot(stress: [s1], hr: [hr1])

        let hit = snap.selection(atX: 100, plotWidth: 240)
        #expect(hit.stress?.value == 1.45)
        #expect(hit.heartRate?.value == 88)

        let miss = snap.selection(atX: 140, plotWidth: 240)
        #expect(miss.stress == nil)
        #expect(miss.heartRate == nil)
    }
}
