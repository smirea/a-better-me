import Foundation
import Testing
@testable import App

let utc: Calendar = {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "UTC")!
    calendar.firstWeekday = 2
    return calendar
}()

func day(_ text: String, _ hour: Int = 8) -> Date {
    let parts = text.split(separator: "-").map { Int($0)! }
    return utc.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: hour))!
}

struct WeightTrendTests {
    @Test func smoothsDailyAndCarriesTheTrendOverGaps() {
        let weighIns = [
            DatedValue(date: day("2026-10-01"), value: 100),
            DatedValue(date: day("2026-10-02"), value: 99),
            DatedValue(date: day("2026-10-04"), value: 98),
        ]
        let trend = WeightTrend.daily(weighIns, through: day("2026-10-05"), calendar: utc)
        #expect(trend.map(\.date) == ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"].map { day($0, 0) })
        let values = trend.map { ($0.value * 1000).rounded() / 1000 }
        #expect(values == [100, 99.9, 99.9, 99.539, 99.539])
    }

    @Test func averagesWeighInsOnTheSameDayBeforeSmoothing() {
        let weighIns = [
            DatedValue(date: day("2026-10-01", 7), value: 80),
            DatedValue(date: day("2026-10-02", 7), value: 81),
            DatedValue(date: day("2026-10-02", 21), value: 83),
        ]
        let trend = WeightTrend.daily(weighIns, through: day("2026-10-02"), calendar: utc)
        #expect(trend.map { ($0.value * 1000).rounded() / 1000 } == [80, 80.2])
    }

    @Test func ignoresLaterWeighInsSoThePastNeverChanges() {
        let early = [DatedValue(date: day("2026-10-01"), value: 90), DatedValue(date: day("2026-10-02"), value: 92)]
        let later = early + [DatedValue(date: day("2026-10-03"), value: 70)]
        let before = WeightTrend.daily(early, through: day("2026-10-02"), calendar: utc)
        let after = WeightTrend.daily(later, through: day("2026-10-03"), calendar: utc)
        #expect(Array(after.prefix(2)) == before)
        #expect(((after[2].value) * 100).rounded() / 100 == 88.18)
    }

    @Test func mergeKeepsTheAppRowWhenHealthHasTheSameMoment() {
        let logged = BodyWeight(weightKg: 81.2, measuredAt: day("2026-10-02"))
        let health = [
            HealthWeight(id: UUID(), date: day("2026-10-02").addingTimeInterval(30), kg: 81.25),
            HealthWeight(id: UUID(), date: day("2026-10-01"), kg: 81.9),
            HealthWeight(id: UUID(), date: day("2026-10-02").addingTimeInterval(3600), kg: 80.8),
        ]
        let merged = WeighIns.merge(logged: [logged], health: health)
        #expect(merged.map(\.kg) == [81.9, 81.2, 80.8])
        #expect(merged.map(\.source) == [.health, .app(logged.id), .health])
    }

    @Test func mergeMatchesEachHealthSampleAgainstTheNearestAppRowInAnyOrder() {
        let newestFirst = [
            BodyWeight(weightKg: 80, measuredAt: day("2026-10-05")),
            BodyWeight(weightKg: 81, measuredAt: day("2026-10-03")),
            BodyWeight(weightKg: 82, measuredAt: day("2026-10-01")),
        ]
        let health = [
            HealthWeight(id: UUID(), date: day("2026-10-05").addingTimeInterval(-59), kg: 80.1),
            HealthWeight(id: UUID(), date: day("2026-10-04"), kg: 80.6),
            HealthWeight(id: UUID(), date: day("2026-10-01").addingTimeInterval(60), kg: 82.1),
            HealthWeight(id: UUID(), date: day("2026-10-03").addingTimeInterval(10), kg: 81.1),
        ]
        let merged = WeighIns.merge(logged: newestFirst, health: health)
        #expect(merged.map(\.kg) == [82, 82.1, 81, 80.6, 80])
    }
}

struct WeightTrendDaylightSavingTests {
    @Test func keepsTakingWeighInsAfterAMidnightDaylightSavingChange() {
        var cairo = Calendar(identifier: .gregorian)
        cairo.timeZone = TimeZone(identifier: "Africa/Cairo")!
        let weighIns = (20...26).map { date in
            DatedValue(date: cairo.date(from: DateComponents(year: 2026, month: 4, day: date, hour: 8))!, value: Double(100 - (date - 20) * 10))
        }
        let end = cairo.date(from: DateComponents(year: 2026, month: 4, day: 26, hour: 12))!
        let trend = WeightTrend.daily(weighIns, through: end, calendar: cairo)
        #expect(trend.count == 7)
        #expect(trend.map { ($0.value * 100).rounded() / 100 } == [100, 99, 97.1, 94.39, 90.95, 86.86, 82.17])
    }
}
