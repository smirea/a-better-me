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
    /// The trend moved to the Nutrition engine, which fills a gap by interpolating the scale weight and seeds the
    /// start from the first week's line (MacroFactor's rules, calibrated on the owner's export), so the values changed.
    @Test func smoothsDailyAndInterpolatesTheScaleOverGaps() {
        let weighIns = [
            DatedValue(date: day("2026-10-01"), value: 100),
            DatedValue(date: day("2026-10-02"), value: 99),
            DatedValue(date: day("2026-10-04"), value: 98),
        ]
        let trend = WeightTrend.daily(weighIns, through: day("2026-10-05"), calendar: utc)
        #expect(trend.map(\.date) == ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"].map { day($0, 0) })
        let values = trend.map { ($0.value * 1000).rounded() / 1000 }
        #expect(values == [99.73, 99.657, 99.541, 99.387, 99.248])
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

    /// Beyond the first week, which seeds the start, a later weigh-in never rewrites the days before it.
    @Test func ignoresLaterWeighInsSoThePastNeverChanges() {
        let early = (1...8).map { DatedValue(date: day("2026-10-0\($0)"), value: $0 % 2 == 1 ? 90 : 92) }
        let later = early + [DatedValue(date: day("2026-10-09"), value: 70)]
        let before = WeightTrend.daily(early, through: day("2026-10-08"), calendar: utc)
        let after = WeightTrend.daily(later, through: day("2026-10-09"), calendar: utc)
        #expect(Array(after.prefix(8)) == before)
        #expect(((after[8].value) * 100).rounded() / 100 == 88.87)
    }

    /// A weigh-in after a gap fills the gap days, which the engine's own suite covers; the days before the gap stay.
    @Test func aWeighInAfterAGapLeavesTheDaysBeforeTheGapAlone() {
        let early = (1...8).map { DatedValue(date: day("2026-10-0\($0)"), value: $0 % 2 == 1 ? 90 : 92) }
        let later = early + [DatedValue(date: day("2026-10-11"), value: 86)]
        let before = WeightTrend.daily(early, through: day("2026-10-11"), calendar: utc)
        let after = WeightTrend.daily(later, through: day("2026-10-11"), calendar: utc)
        #expect(Array(after.prefix(8)) == Array(before.prefix(8)))
        #expect(after.suffix(3).map { ($0.value * 100).rounded() / 100 } == [90.87, 90.58, 90.13])
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
