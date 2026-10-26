import Foundation
import Testing
@testable import App


/// A synthetic profile that reproduces every number MacroFactor's program wizard showed for one sample (a lifter
/// with Fri and Sat high days): 197 lb at 2210 kcal with a rate the wizard would display as 0.76%.
private let weightKg = 197 * Engine.kgPerLb
private let expenditure = 2210.0
private let lose = Engine.Goal(kind: .lose, ratePercentPerWeek: 0.7594)
private let floor = Engine.CalorieFloor.standard(kcal: 1361)

struct TargetsTests {
    @Test func initialDailyBudgetRoundsToTwentyFive() {
        let half = Engine.Goal(kind: .lose, ratePercentPerWeek: 0.5)
        #expect(Engine.Targets.initialDailyBudget(expenditure: expenditure, goal: half, weightKg: weightKg) == 1725)
        #expect(Engine.Targets.initialDailyBudget(expenditure: expenditure, goal: Engine.Goal(kind: .maintain, ratePercentPerWeek: 0), weightKg: weightKg) == 2200)
        #expect(Engine.Targets.initialDailyBudget(expenditure: expenditure, goal: Engine.Goal(kind: .gain, ratePercentPerWeek: 0.5), weightKg: weightKg) == 2700)
    }

    @Test func balancedModerateProteinWithTwoHighDays() {
        let program = Engine.CoachedProgram(diet: .balanced, protein: .moderate, floor: floor, highDays: [.friday, .saturday])
        let plan = Engine.Targets.weekly(program: program, goal: lose, expenditure: expenditure, weightKg: weightKg)
        #expect(plan.diet == .balanced)
        #expect(!plan.proteinReduced)
        #expect(plan.days[.monday] == Engine.DayTarget(kcal: 1421, proteinG: 151, fatG: 46, carbsG: 99))
        #expect(plan.days[.sunday] == plan.days[.monday])
        #expect(plan.days[.friday] == Engine.DayTarget(kcal: 1564, proteinG: 151, fatG: 54, carbsG: 116))
        #expect(plan.days[.saturday] == plan.days[.friday])
        #expect((plan.averageKcal * 100).rounded() / 100 == 1461.86)
    }

    @Test func extraHighProteinFallsBackToKetoWhenFatWouldDropUnderItsFloor() {
        let program = Engine.CoachedProgram(diet: .balanced, protein: .extraHigh, floor: floor, highDays: [.friday, .saturday])
        let plan = Engine.Targets.weekly(program: program, goal: lose, expenditure: expenditure, weightKg: weightKg)
        #expect(plan.diet == .keto)
        #expect(plan.days[.monday] == Engine.DayTarget(kcal: 1421, proteinG: 212, fatG: 44, carbsG: 42))
        #expect(plan.days[.friday] == Engine.DayTarget(kcal: 1564, proteinG: 212, fatG: 56, carbsG: 52))
    }

    @Test func proteinLevelsAreGramsPerPound() {
        let grams = Engine.ProteinLevel.allCases.map { ($0.gramsPerLb * 197).rounded(.down) }
        #expect(grams == [124, 151, 183, 212])
    }

    @Test func evenDistributionGivesEveryDayTheAverage() {
        let program = Engine.CoachedProgram(diet: .balanced, protein: .moderate, floor: floor)
        let plan = Engine.Targets.weekly(program: program, goal: lose, expenditure: expenditure, weightKg: weightKg)
        #expect(Set(plan.days.values.map(\.kcal)) == [1462])
        #expect(plan.days.count == 7)
    }

    @Test func theCalorieFloorStopsTheDeficit() {
        let fast = Engine.Goal(kind: .lose, ratePercentPerWeek: 2)
        let program = Engine.CoachedProgram(diet: .balanced, protein: .moderate, floor: floor)
        let plan = Engine.Targets.weekly(program: program, goal: fast, expenditure: expenditure, weightKg: weightKg)
        #expect(Set(plan.days.values.map(\.kcal)) == [1361])
        #expect(Engine.CalorieFloor.low(standardKcal: 1361).kcal == 907)
        let low = Engine.CoachedProgram(diet: .balanced, protein: .moderate, floor: .low(standardKcal: 1361))
        #expect(Set(Engine.Targets.weekly(program: low, goal: fast, expenditure: expenditure, weightKg: weightKg).days.values.map(\.kcal)) == [907])
    }

    @Test func proteinGivesWayWhenItAndTheFatFloorExceedTheDay() {
        let target = Engine.Targets.macros(kcal: 900, proteinG: 212, diet: .keto, fatFloorG: 44)
        #expect(target == Engine.DayTarget(kcal: 900, proteinG: 126, fatG: 44, carbsG: 0))
    }

    @Test func lowCarbCapsCarbsAtTwoHundredGrams() {
        let target = Engine.Targets.macros(kcal: 3500, proteinG: 150, diet: .lowCarb, fatFloorG: 44)
        #expect(target.carbsG == 200)
        #expect(target.fatG == 233)
    }

    @Test func estimatedDaysCompoundTheRateOnTheFallingWeight() {
        let goal = Engine.Goal(kind: .lose, ratePercentPerWeek: 0.5, targetWeightKg: 80)
        #expect(Engine.Targets.estimatedDays(goal: goal, weightKg: 90) == 165)
        #expect(Engine.Targets.estimatedDays(goal: goal, weightKg: 79) == 0)
        #expect(Engine.Targets.estimatedDays(goal: Engine.Goal(kind: .maintain, ratePercentPerWeek: 0, targetWeightKg: 80), weightKg: 90) == nil)
    }

    /// The measured edit: +538 on one day took 108 off each of five unlocked days, so the week moves by the rounding.
    @Test func collaborativeRebalanceSpreadsTheChangeOverTheUnlockedDays() {
        let week = Dictionary(uniqueKeysWithValues: Engine.Weekday.allCases.map { ($0, 2000) })
        let moved = Engine.Targets.rebalance(week, changing: .tuesday, to: 2538, locked: [.monday])
        #expect(moved[.tuesday] == 2538)
        #expect(moved[.monday] == 2000)
        #expect(moved[.wednesday] == 1892)
        #expect(moved.values.reduce(0, +) == 13998)
    }
}

struct CheckInTests {
    @Test func smoothsTheNewBudgetAgainstLastWeeks() {
        let program = Engine.CoachedProgram(diet: .balanced, protein: .moderate, floor: floor)
        let half = Engine.Goal(kind: .lose, ratePercentPerWeek: 0.5)
        let fresh = Engine.CheckIn.plan(program: program, goal: half, expenditure: expenditure, trendWeightKg: weightKg, previousAverageKcal: nil)
        #expect(Set(fresh.days.values.map(\.kcal)) == [1718])
        let smoothed = Engine.CheckIn.plan(program: program, goal: half, expenditure: expenditure, trendWeightKg: weightKg, previousAverageKcal: 1900)
        #expect(Set(smoothed.days.values.map(\.kcal)) == [1809])
    }

    @Test func maintenanceNudgesOutsideTheBand() {
        let goal = Engine.Goal(kind: .maintain, ratePercentPerWeek: 0, targetWeightKg: 85)
        #expect(Engine.CheckIn.effectiveGoal(goal, trendWeightKg: 85.5) == goal)
        #expect(Engine.CheckIn.effectiveGoal(goal, trendWeightKg: 86) == Engine.Goal(kind: .lose, ratePercentPerWeek: 0.15, targetWeightKg: 85))
        #expect(Engine.CheckIn.effectiveGoal(goal, trendWeightKg: 84) == Engine.Goal(kind: .gain, ratePercentPerWeek: 0.15, targetWeightKg: 85))
        let program = Engine.CoachedProgram(diet: .balanced, protein: .moderate, floor: floor)
        let plan = Engine.CheckIn.plan(program: program, goal: goal, expenditure: expenditure, trendWeightKg: 86, previousAverageKcal: nil)
        #expect(Set(plan.days.values.map(\.kcal)) == [2068])
    }
}
