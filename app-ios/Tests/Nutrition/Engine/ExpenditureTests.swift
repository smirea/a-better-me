import Foundation
import Testing
@testable import App

typealias Engine = NutritionEngine

private func dates(_ from: String, count: Int) -> [Date] {
    (0..<count).map { utc.date(byAdding: .day, value: $0, to: day(from))! }
}

struct ExpenditureTests {
    let days = dates("2026-01-01", count: 45)
    var weighIns: [DatedValue] { days.map { DatedValue(date: $0, value: 80) } }
    var intake: [Engine.IntakeDay] { days.map { Engine.IntakeDay(date: $0, kcal: 2000) } }

    @Test func closesAShareOfTheGapToTheEnergyBalanceEstimateEachDay() {
        let trend = Engine.TrendWeight.daily(weighIns: weighIns, through: days[44], calendar: utc)
        let result = Engine.Expenditure.daily(intake: intake, trend: trend, weighIns: weighIns, initial: 2500, from: days[30], through: days[32], calendar: utc)
        #expect(result.map { ($0.kcal * 10000).rounded() / 10000 } == [2492.5, 2485.1125, 2477.8358])
        #expect(result.map(\.isHolding) == [false, false, false])
    }

    @Test func aFallingTrendRaisesTheEstimate() {
        let falling = days.enumerated().map { DatedValue(date: $1, value: 90 - 0.1 * Double($0)) }
        let result = Engine.Expenditure.daily(intake: intake, trend: falling, weighIns: weighIns, initial: 2500, from: days[30], through: days[30], calendar: utc)
        #expect(result.map { ($0.kcal * 10000).rounded() / 10000 } == [2502.4208])
    }

    @Test func holdsWithoutThreeLoggedDaysOrAWeighInInTheWeekBefore() {
        let trend = Engine.TrendWeight.daily(weighIns: weighIns, through: days[44], calendar: utc)
        let sparse = intake.filter { utc.component(.day, from: $0.date) % 4 == 0 }
        let held = Engine.Expenditure.daily(intake: sparse, trend: trend, weighIns: weighIns, initial: 2500, from: days[30], through: days[32], calendar: utc)
        #expect(held.map(\.kcal) == [2500, 2500, 2500])
        #expect(held.map(\.isHolding) == [true, true, true])
        let noWeighIns = Engine.Expenditure.daily(intake: intake, trend: trend, weighIns: [], initial: 2500, from: days[30], through: days[30], calendar: utc)
        #expect(noWeighIns == [Engine.ExpenditureDay(date: utc.startOfDay(for: days[30]), kcal: 2500, isHolding: true)])
    }

    @Test func todaysLogAndIncompleteDaysDoNotCount() {
        let trend = Engine.TrendWeight.daily(weighIns: weighIns, through: days[44], calendar: utc)
        var incomplete = intake
        for index in 23...29 { incomplete[index].isIncomplete = true }
        let result = Engine.Expenditure.daily(intake: incomplete, trend: trend, weighIns: weighIns, initial: 2500, from: days[30], through: days[30], calendar: utc)
        #expect(result == [Engine.ExpenditureDay(date: utc.startOfDay(for: days[30]), kcal: 2500, isHolding: true)])
    }

    @Test func aNewUserUpdatesOverTheTrendThereIsAtTheStartupGain() {
        let trend = Engine.TrendWeight.daily(weighIns: weighIns, through: days[44], calendar: utc)
        let result = Engine.Expenditure.daily(intake: intake, trend: trend, weighIns: weighIns, initial: 2500, from: days[0], through: days[5], calendar: utc)
        #expect(result.map(\.isHolding) == [true, true, true, true, false, false])
        #expect(result.map { ($0.kcal * 100).rounded() / 100 } == [2500, 2500, 2500, 2500, 2400, 2320])
    }

    @Test func aRiseInTheWeeksMeanStepsRaisesTheEstimateAtOnce() {
        let trend = Engine.TrendWeight.daily(weighIns: weighIns, through: days[44], calendar: utc)
        let steps = days.enumerated().map { DatedValue(date: $1, value: $0 < 29 ? 6000 : 13000) }
        let result = Engine.Expenditure.daily(
            intake: intake, trend: trend, weighIns: weighIns, initial: 2000, from: days[30], through: days[31], calendar: utc,
            modifiers: .init(steps: steps)
        )
        #expect(result.map { ($0.kcal * 100).rounded() / 100 } == [2039.4, 2078.21])
        let off = Engine.Expenditure.daily(intake: intake, trend: trend, weighIns: weighIns, initial: 2000, from: days[30], through: days[31], calendar: utc)
        #expect(off.map(\.kcal) == [2000, 2000])
    }

    @Test func aGoalRateScalesTheEstimateRampedOverTwoWeeks() {
        let trend = Engine.TrendWeight.daily(weighIns: weighIns, through: days[44], calendar: utc)
        let modifiers = Engine.Expenditure.Modifiers(goalRates: [DatedValue(date: days[30], value: -1)])
        let model = Engine.Expenditure.Model(gain: 0, startupGain: 0)
        let ramp = Engine.Expenditure.daily(
            intake: intake, trend: trend, weighIns: weighIns, initial: 2000, from: days[29], through: days[44], calendar: utc, model: model, modifiers: modifiers
        )
        #expect(ramp.map { ($0.kcal * 100).rounded() / 100 }[0...2] == [2000, 1994.29, 1988.57])
        #expect((ramp[14].kcal * 100).rounded() / 100 == 1920)
        let before = Engine.Expenditure.daily(
            intake: intake, trend: trend, weighIns: weighIns, initial: 2000, from: days[44], through: days[44], calendar: utc, model: model, modifiers: modifiers
        )
        #expect((before[0].kcal * 100).rounded() / 100 == 1920)
    }

    @Test func noTrendMeansEveryDayHolds() {
        let result = Engine.Expenditure.daily(intake: intake, trend: [], weighIns: [], initial: 2300, from: days[0], through: days[1], calendar: utc)
        #expect(result.map(\.kcal) == [2300, 2300])
        #expect(result.map(\.date) == [days[0], days[1]].map { utc.startOfDay(for: $0) })
    }

    @Test func stepsOneCalendarDayAcrossADaylightSavingChange() {
        var la = Calendar(identifier: .gregorian)
        la.timeZone = TimeZone(identifier: "America/Los_Angeles")!
        let start = la.date(from: DateComponents(year: 2026, month: 3, day: 7, hour: 8))!
        let end = la.date(from: DateComponents(year: 2026, month: 3, day: 9, hour: 8))!
        let result = Engine.Expenditure.daily(intake: [], trend: [], weighIns: [], initial: 2000, from: start, through: end, calendar: la)
        #expect(result.map { la.component(.day, from: $0.date) } == [7, 8, 9])
        #expect(result.map { la.component(.hour, from: $0.date) } == [0, 0, 0])
    }
}

struct BMRTests {
    @Test func macroFactorEquationByHeightAndWeight() {
        #expect((Engine.BMR.macroFactor(weightKg: 100, heightCm: 180, ageYears: 30, sex: .male) * 10).rounded() / 10 == 1929.2)
        #expect((Engine.BMR.macroFactor(weightKg: 100, heightCm: 180, ageYears: 30, sex: .female) * 10).rounded() / 10 == 1715.4)
        #expect((Engine.BMR.macroFactor(weightKg: 100, heightCm: 180, ageYears: 65, sex: .male) * 10).rounded() / 10 == 1669.5)
    }

    @Test func macroFactorEquationByBodyComposition() {
        #expect((Engine.BMR.macroFactor(fatFreeMassKg: 60, fatMassKg: 20, ageYears: 30) * 10).rounded() / 10 == 1715.9)
    }

    @Test func cunningham() {
        #expect(Engine.BMR.cunningham(fatFreeMassKg: 60) == 1666)
    }

    @Test func initialExpenditureIsBMRTimesTheActivityFactor() {
        #expect(Engine.InitialExpenditure.estimate(bmr: 1900, activity: .moderatelyActive, exercise: .fourToSix) == 2945)
        #expect(Engine.InitialExpenditure.estimate(bmr: 1900, activity: .sedentary, exercise: .none) == 2280)
    }
}
