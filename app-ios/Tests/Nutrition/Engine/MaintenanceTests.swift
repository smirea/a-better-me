import Foundation
import Testing
@testable import App

/// The literals are shared with `server/src/agent-maintenance.test.ts`, so the server's port answers what the phone does.
struct MaintenanceTests {
    func at(_ index: Int) -> Date { utc.date(byAdding: .day, value: index, to: utc.startOfDay(for: day("2026-01-01")))! }

    func counted(_ index: Int, _ kcal: Double, protein: Double = 150, entries: Int = 7, marked: Bool = false) -> Engine.CountedDay {
        Engine.CountedDay(date: at(index), kcal: kcal, proteinG: protein, entries: entries, isMarked: marked)
    }

    /// Sixty days: 2000 kcal logged four days in five, a daily weigh-in losing 50 g a day, and one weigh-in 3 kg off.
    var days: [Engine.CountedDay] { (0..<60).filter { $0 % 5 != 4 }.map { counted($0, 2000) } }
    var weighIns: [DatedValue] { (0..<60).map { DatedValue(date: at($0), value: 100 - 0.05 * Double($0) + ($0 == 30 ? 3 : 0)) } }

    func round(_ value: Double) -> Double { (value * 10).rounded() / 10 }

    @Test func leavesOutADayFarBelowTheTypicalOneOrALightOneWithFewEntriesOrLittleProteinButNeverAMarkedOne() {
        let typical = (0..<20).map { counted($0, 2000 + Double($0 % 3) * 100) }
        let screened = Engine.Maintenance.screen(typical + [
            counted(20, 500, protein: 40, entries: 2),
            counted(21, 1400, protein: 120, entries: 2),
            counted(22, 1400, protein: 60),
            counted(23, 1400),
            counted(24, 0, protein: 0, entries: 0, marked: true),
            counted(25, 300, protein: 20, entries: 0, marked: true),
        ], calendar: utc)
        #expect(screened.incomplete == [
            .init(date: at(20), kcal: 500, typicalKcal: 2100, reason: .farBelowTypical),
            .init(date: at(21), kcal: 1400, typicalKcal: 2100, reason: .fewEntries),
            .init(date: at(22), kcal: 1400, typicalKcal: 2100, reason: .lowProtein),
        ])
        #expect(screened.counted.suffix(3).map(\.date) == [at(23), at(24), at(25)])
    }

    @Test func measuresADenseStretchAfterItSettlesWithoutTheOutlierWeighInAtTodaysWeight() throws {
        let estimate = try #require(Engine.Maintenance.estimate(
            days: days, weighIns: weighIns, weightKg: 97, steps: [], workouts: [], prior: nil, today: at(60), calendar: utc
        ))
        let period = try #require(estimate.periods.first)
        #expect([period.start, period.end] == [at(14), at(58)])
        #expect(period.intakeKcal == 2000)
        #expect([round(period.weightChangeKg), round(period.meanWeightKg), round(period.measuredKcal)] == [-2.3, 98.2, 2330.7])
        #expect(period.days == 45 && period.loggedDays == 36 && period.weighIns == 44)
        #expect(period.adjustments.map(\.kind) == [.weight])
        #expect(period.adjustments.map { round($0.kcal) } == [-26.4])
        #expect([round(estimate.kcal), round(estimate.sdKcal), period.share] == [2304.3, 100, 1])
    }

    @Test func movesAnOldStretchToTodaysStepsAndWorkoutsAndPoolsItWithThePrior() throws {
        let steps = (0..<100).map { DatedValue(date: at($0), value: $0 < 60 ? 5000 : 9000) }
        let workouts = (0..<30).map { DatedValue(date: at($0 * 2), value: 60) }
        let estimate = try #require(Engine.Maintenance.estimate(
            days: days, weighIns: weighIns, weightKg: 96, steps: steps, workouts: workouts, prior: .init(kcal: 2600, source: .bmr), today: at(100), calendar: utc
        ))
        let period = try #require(estimate.periods.first)
        #expect(period.adjustments.map(\.kind) == [.weight, .steps, .workouts])
        #expect(period.adjustments.map { [round($0.before), round($0.now), round($0.kcal)] } == [[98.2, 96, -48.4], [5000, 9000, 160], [3.6, 0, -122.7]])
        #expect([round(period.kcal), round(period.sdKcal), round(period.share)] == [2319.6, 123.7, 0.9])
        #expect([round(estimate.kcal), round(estimate.prior?.share ?? 0)] == [2344.1, 0.1])
    }

    @Test func fallsBackToThePriorWithoutADenseStretchAndToNothingWithoutOne() throws {
        let thin = Array(days.prefix(10)), thinWeighIns = Array(weighIns.prefix(10))
        let estimate = try #require(Engine.Maintenance.estimate(
            days: thin, weighIns: thinWeighIns, weightKg: 97, steps: [], workouts: [], prior: .init(kcal: 2600, source: .bmr), today: at(60), calendar: utc
        ))
        #expect([estimate.kcal, estimate.sdKcal, Double(estimate.periods.count), estimate.prior?.share ?? 0] == [2600, 400, 0, 1])
        #expect(Engine.Maintenance.estimate(days: thin, weighIns: thinWeighIns, weightKg: 97, steps: [], workouts: [], prior: nil, today: at(60), calendar: utc) == nil)
    }
}
