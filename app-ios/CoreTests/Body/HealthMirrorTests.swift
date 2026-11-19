import Foundation
import GRDB
import Testing
@testable import Core

private func sample(_ text: String, plus seconds: TimeInterval = 0, kg: Double, id: UUID = UUID()) -> HealthWeight {
    HealthWeight(id: id, date: day(text).addingTimeInterval(seconds), kg: kg)
}

private func total(_ text: String, _ value: Double) -> DatedValue { DatedValue(date: utc.startOfDay(for: day(text)), value: value) }

struct HealthMirrorTests {
    @Test func aHealthSampleThatIsTheSameReadingAsAManualWeighInIsNotCopiedAndItsEarlierCopyGoes() {
        let logged = BodyWeight(weightKg: 81.2, measuredAt: day("2026-10-02"))
        let imported = BodyWeight(weightKg: 82, measuredAt: day("2026-10-04", 17))
        let sameMoment = sample("2026-10-02", plus: 30, kg: 81.6)
        let sameDayAndWeight = sample("2026-10-04", kg: 82.04)
        let others = [sample("2026-10-01", kg: 81.9), sample("2026-10-02", plus: 3600, kg: 80.8), sample("2026-10-04", plus: 60, kg: 82.5)]
        let copied = BodyWeight(id: sameMoment.id, weightKg: 81.6, measuredAt: sameMoment.date, source: .healthKit)

        let changes = HealthMirror.weighIns(health: others + [sameMoment, sameDayAndWeight], rows: [logged, imported, copied], calendar: utc)
        #expect(changes.puts.map(\.id) == others.map(\.id))
        #expect(changes.puts.allSatisfy { $0.source == .healthKit })
        #expect(changes.deletes == [copied.id])
    }

    @Test func aCopiedWeighInFollowsItsSampleAndGoesWhenHealthDropsItWhileManualRowsStay() {
        let logged = BodyWeight(weightKg: 80, measuredAt: day("2026-10-05"))
        var edited = BodyWeight(weightKg: 79, measuredAt: day("2026-10-01"), source: .healthKit)
        edited.bodyFatPercent = 18
        let dropped = BodyWeight(weightKg: 81, measuredAt: day("2026-10-02"), source: .healthKit)
        let health = [sample("2026-10-01", kg: 82, id: edited.id), sample("2026-10-03", kg: 81.5)]

        let changes = HealthMirror.weighIns(health: health, rows: [logged, edited, dropped], calendar: utc)
        #expect(changes.puts.map(\.weightKg) == [82, 81.5])
        #expect(changes.puts.first?.bodyFatPercent == 18)
        #expect(changes.deletes == [dropped.id])
        #expect(HealthMirror.weighIns(health: [], rows: [logged, edited, dropped], calendar: utc) == HealthMirror.WeighInChanges())
    }

    @Test func healthTotalsTakeTheirDaysAndAManualValueStaysOnADayHealthLacks() {
        let rows = [
            BodyMetric(.steps, on: calendarDay("2026-09-30"), value: 7000),
            BodyMetric(.steps, on: calendarDay("2026-10-02"), value: 12000),
            BodyMetric(.steps, on: calendarDay("2026-10-03"), value: 5000, source: .healthKit),
        ]
        let health = [total("2026-10-01", 9000.4), total("2026-10-02", 4000), total("2026-10-03", 5000)]
        let changes = HealthMirror.days(.steps, health: health, rows: rows, from: calendarDay("2026-09-01"), calendar: utc, now: day("2026-10-03"))
        #expect(changes.puts.map(\.id) == ["2026-10-01/steps", "2026-10-02/steps"])
        #expect(changes.puts.map(\.value) == [9000, 4000])
        #expect(changes.puts.allSatisfy { $0.source == .healthKit })
        #expect(changes.deletes.isEmpty)
    }

    @Test func aCopiedDayHealthNoLongerCountsGoesUnlessItIsOlderThanTheReadOrHealthAnsweredNothing() {
        let rows = [
            BodyMetric(.steps, on: calendarDay("2026-08-31"), value: 3000, source: .healthKit),
            BodyMetric(.steps, on: calendarDay("2026-10-01"), value: 9000, source: .healthKit),
            BodyMetric(.steps, on: calendarDay("2026-10-02"), value: 4000, source: .healthKit),
        ]
        let from = calendarDay("2026-09-01")
        let changes = HealthMirror.days(.steps, health: [total("2026-10-02", 4000)], rows: rows, from: from, calendar: utc, now: day("2026-10-03"))
        #expect(changes == HealthMirror.DayChanges(deletes: ["2026-10-01/steps"]))
        #expect(HealthMirror.days(.steps, health: [], rows: rows, from: from, calendar: utc, now: day("2026-10-03")) == HealthMirror.DayChanges())
    }

    @Test func thePhonePedometerRaisesTodayButDeletesNothingWhenHealthAnsweredNothing() {
        let rows = [
            BodyMetric(.steps, on: calendarDay("2026-10-01"), value: 9000, source: .healthKit),
            BodyMetric(.steps, on: calendarDay("2026-10-03"), value: 2000, source: .healthKit),
        ]
        let from = calendarDay("2026-09-01")
        let denied = HealthMirror.days(.steps, health: [], phoneToday: total("2026-10-03", 2500), rows: rows, from: from, calendar: utc, now: day("2026-10-03"))
        #expect(denied.puts.map(\.value) == [2500])
        #expect(denied.deletes.isEmpty)
        let lower = HealthMirror.days(
            .steps, health: [total("2026-10-01", 9000), total("2026-10-03", 2000)], phoneToday: total("2026-10-03", 1500), rows: rows, from: from,
            calendar: utc, now: day("2026-10-03")
        )
        #expect(lower == HealthMirror.DayChanges())
    }

    @MainActor
    @Test func copyingAnUnchangedHealthReadAgainWritesNothing() async throws {
        let store = try LocalStore(unsyncedAt: FileManager.default.temporaryDirectory.appending(path: "mirror-\(UUID().uuidString)/a.sqlite"))
        let read = HealthRead(
            weights: [sample("2026-10-01", plus: 0.123456, kg: 81.93), sample("2026-10-02", plus: 0.9996, kg: 81.2)],
            days: [
                .steps: HealthRead.Days(totals: [total("2026-10-01", 9000)], from: day("2026-09-01")),
                .walkingDistance: HealthRead.Days(totals: [total("2026-10-01", 6540.7)], from: day("2026-09-01")),
            ]
        )
        func outbox() async throws -> Int {
            try await store.write { db in
                try HealthMirror.apply(read, to: db, calendar: utc)
                return try Int.fetchOne(db, sql: "SELECT count(*) FROM _outbox") ?? 0
            }.value
        }
        let first = try await outbox()
        #expect(first > 0)
        #expect(try await outbox() == first)
        let readings = try store.readBlocking { try BodyReadings.fetch($0, calendar: utc) }
        #expect(readings.weighIns.map(\.kg) == [81.93, 81.2])
        #expect(readings.weighIns.allSatisfy { $0.source == .health })
        #expect(readings.steps == [total("2026-10-01", 9000)])
        #expect(readings.distance == [total("2026-10-01", 6541)])
    }
}
