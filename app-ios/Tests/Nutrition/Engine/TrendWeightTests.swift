import Foundation
import Testing
@testable import App

private typealias Trend = NutritionEngine.TrendWeight

struct EngineTrendWeightTests {
    @Test func interpolatesTheScaleAcrossAGapAndHoldsTheLastWeighInAfterIt() {
        let weighIns = [
            DatedValue(date: day("2026-10-01"), value: 100),
            DatedValue(date: day("2026-10-02"), value: 99),
            DatedValue(date: day("2026-10-04"), value: 98),
        ]
        let scale = Trend.dailyScale(weighIns, through: day("2026-10-05"), calendar: utc)
        #expect(scale.map(\.value) == [100, 99, 98.5, 98, 98])
        let trend = Trend.daily(weighIns: weighIns, through: day("2026-10-05"), calendar: utc)
        #expect(trend.map(\.date) == ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"].map { day($0, 0) })
        #expect(trend.map { ($0.value * 1000).rounded() / 1000 } == [99.73, 99.657, 99.541, 99.387, 99.248])
    }

    @Test func keepsEasingTowardTheLastWeighInOnDaysAfterIt() {
        let weighIns = [
            DatedValue(date: day("2026-10-01", 7), value: 80),
            DatedValue(date: day("2026-10-02", 7), value: 81),
            DatedValue(date: day("2026-10-02", 21), value: 83),
        ]
        let trend = Trend.daily(weighIns: weighIns, through: day("2026-10-04"), calendar: utc)
        #expect(trend.map { ($0.value * 1000).rounded() / 1000 } == [80.54, 80.686, 80.817, 80.936])
    }

    @Test func seedsTheStartFromTheFirstWeeksLine() {
        #expect(Trend.seed([100, 99, 98.5, 98, 98]) == 99.7)
        #expect(Trend.seed([100, 99, 98, 97]) == 100)
        #expect(Trend.seed([80, 82]) == 80)
        #expect(Trend.seed([90]) == 90)
    }

    @Test func aSingleWeighInIsItsOwnTrend() {
        let trend = Trend.daily(weighIns: [DatedValue(date: day("2026-10-03"), value: 90)], through: day("2026-10-03"), calendar: utc)
        #expect(trend == [DatedValue(date: day("2026-10-03", 0), value: 90)])
    }

    @Test func noWeighInsGiveNoTrend() {
        #expect(Trend.daily(weighIns: [], through: day("2026-10-03"), calendar: utc).isEmpty)
    }

    @Test func runsThroughTheLastWeighInEvenWhenEndIsEarlier() {
        let weighIns = [DatedValue(date: day("2026-10-01"), value: 90), DatedValue(date: day("2026-10-03"), value: 92)]
        #expect(Trend.daily(weighIns: weighIns, through: day("2026-10-01"), calendar: utc).count == 3)
    }

    @Test func countsGapDaysByDateAcrossADaylightSavingChange() {
        var la = Calendar(identifier: .gregorian)
        la.timeZone = TimeZone(identifier: "America/Los_Angeles")!
        let weighIns = [
            DatedValue(date: la.date(from: DateComponents(year: 2026, month: 3, day: 7, hour: 8))!, value: 100),
            DatedValue(date: la.date(from: DateComponents(year: 2026, month: 3, day: 10, hour: 8))!, value: 97),
        ]
        let end = la.date(from: DateComponents(year: 2026, month: 3, day: 10, hour: 12))!
        let trend = Trend.daily(weighIns: weighIns, through: end, calendar: la)
        #expect(trend.map { la.component(.day, from: $0.date) } == [7, 8, 9, 10])
        #expect(trend.map { ($0.value * 1000).rounded() / 1000 } == [100, 99.9, 99.71, 99.439])
    }
}
