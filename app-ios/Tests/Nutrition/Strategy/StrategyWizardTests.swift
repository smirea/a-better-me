import Foundation
import Testing
@testable import App

/// The research spec's §7.1 sample: a 197 lb lifter at 2210 kcal, losing 0.76% a week, Fri and Sat high days. MacroFactor
/// planned it at 3500 kcal/lb (1421 and 1564 kcal days); the engine plans at `NutritionEngine.kcalPerLb`.
private let weightKg = 197 * Engine.kgPerLb
private let today = calendarDay("2026-10-26")

private func wizard(_ mode: StrategyWizardModel.Mode = .newGoal, current: NutritionPlan? = nil, floor: Int = 1361) -> StrategyWizardModel {
    StrategyWizardModel(mode: mode, current: current, today: today, weightKg: weightKg, expenditureKcal: 2210, standardFloorKcal: floor)
}

private func target(_ energy: Double, _ protein: Double, _ fat: Double, _ carbs: Double) -> DayTarget {
    DayTarget(energy: energy, protein: protein, fat: fat, carbs: carbs)
}

struct StrategyWizardTests {
    @Test func theSpecSamplePlansAtTheEnginesDensity() {
        var model = wizard()
        model.goal.change(kind: .lose, currentWeightKg: weightKg)
        model.goal.targetWeightKg = 85
        model.goal.ratePercent = 0.7594
        model.choose(.coached)
        model.coaching.diet = .balanced
        model.coaching.floor = .standard
        model.coaching.training = .lifting
        model.shiftCalories = true
        model.toggleHighDay(5)
        model.toggleHighDay(6)
        model.coaching.protein = .moderate

        #expect(model.steps == [.goalType, .goalWeightRate, .goalSummary, .style, .diet, .floor, .training, .distribution, .highDays, .protein, .coachedResult])
        let plan = model.plan(isFirst: true)
        #expect(plan.id == today)
        #expect(plan.kind == .setup)
        #expect(plan.goal == NutritionGoal(kind: .lose, targetWeightKg: 85, ratePercentPerWeek: -0.7594, startedOn: today))
        #expect(plan.coaching.highDays == [5, 6])
        #expect(plan.targets[1] == target(1525, 151, 52, 111))
        #expect(plan.targets[4] == target(1525, 151, 52, 111))
        #expect(plan.targets[5] == target(1678, 151, 60, 130))
        #expect(plan.targets[6] == target(1678, 151, 60, 130))
        #expect(plan.targets[7] == target(1525, 151, 52, 111))
        #expect(model.designNotes.map(\.title) == ["Estimated Expenditure", "Average Target", "Calorie Shift", "Target Protein", "Diet Type"])
        #expect(model.designNotes[1].value == "1569 kcal")
    }

    @Test func extraHighProteinSwitchesToKetoAndSaysSo() {
        var model = wizard()
        model.goal.ratePercent = 0.7594
        model.goal.targetWeightKg = 85
        model.choose(.coached)
        model.shiftCalories = true
        model.coaching.highDays = [5, 6]
        model.coaching.protein = .extraHigh
        #expect(model.plan(isFirst: true).targets[1] == target(1525, 212, 53, 49))
        #expect(model.designNotes.last?.value == "Keto")
    }

    @Test func goalTilesMatchTheWizard() {
        var goal = GoalDraft(kind: .lose, currentWeightKg: weightKg)
        #expect(goal.ratePercent == 0.5)
        #expect(goal.initialBudget(StrategyBasis(weightKg: weightKg, expenditureKcal: 2210, standardFloorKcal: 1361)) == 1800)
        #expect(goal.band == .standard)
        goal.ratePercent = 0.27
        #expect(goal.band == .slower)
        goal.ratePercent = 1.39
        #expect(goal.band == .faster)
        #expect(goal.problem(currentWeightKg: weightKg) == "A weight loss goal needs a target below your current weight.")
        goal.targetWeightKg = 80
        goal.ratePercent = 0.5
        #expect(goal.problem(currentWeightKg: weightKg) == nil)
        #expect(goal.projectedEnd(from: today, currentWeightKg: 90) == calendarDay("2027-04-09"))
        #expect(GoalDraft(kind: .maintain, currentWeightKg: 90).projectedEnd(from: today, currentWeightKg: 90) == nil)
    }

    @Test(arguments: [
        (NutritionGoal.Kind.lose, 0.7594, target(1569, 151, 54, 117)),
        (.maintain, 0, target(2210, 151, 90, 194)),
        (.gain, 0.25, target(2421, 151, 102, 219)),
    ])
    func coachedEvenWeekForEachGoal(kind: NutritionGoal.Kind, rate: Double, expected: DayTarget) {
        var model = wizard()
        model.goal.change(kind: kind, currentWeightKg: weightKg)
        model.goal.ratePercent = rate
        model.goal.targetWeightKg = weightKg + (kind == .lose ? -5 : kind == .gain ? 5 : 0)
        model.choose(.coached)
        let plan = model.plan(isFirst: false)
        #expect(plan.kind == .edit)
        #expect(plan.targets == WeekTargets(every: expected))
        #expect(plan.goal.ratePercentPerWeek == (kind == .lose ? -rate : rate))
    }

    @Test(arguments: [NutritionGoal.Kind.lose, .maintain, .gain])
    func collaborativeStartsFromTheEvenCoachedWeekAndSavesItsEdits(kind: NutritionGoal.Kind) {
        var model = wizard()
        model.goal.change(kind: kind, currentWeightKg: weightKg)
        model.goal.targetWeightKg = weightKg + (kind == .lose ? -5 : kind == .gain ? 5 : 0)
        model.choose(.collaborative)
        model.leave(.style)
        #expect(model.steps.suffix(1) == [.collaborative])
        let even = StrategyRules.weekTargets(Engine.Targets.weekly(
            program: Engine.CoachedProgram(diet: .balanced, protein: .moderate, floor: .standard(kcal: 1361)),
            goal: StrategyRules.engineGoal(model.savedGoal), expenditure: 2210, weightKg: weightKg
        ))
        #expect(model.collaborative.targets == even)
        model.collaborative.locked = [1]
        model.collaborative.setCalories(Int(even[2].energy) + 538, on: 2)
        let plan = model.plan(isFirst: false)
        #expect(plan.coaching.style == .collaborative)
        #expect(plan.targets == model.collaborative.targets)
        #expect(plan.targets[1] == even[1])
        #expect(plan.targets.days.map(\.energy).reduce(0, +) == even.days.map(\.energy).reduce(0, +))
    }

    @Test func aNewGoalMovesTheCurrentCollaborativeWeekToItsBudget() {
        let current = NutritionPlan(
            from: calendarDay("2026-10-01"), kind: .setup,
            goal: NutritionGoal(kind: .maintain, targetWeightKg: weightKg, ratePercentPerWeek: 0, startedOn: calendarDay("2026-10-01")),
            coaching: CoachingProgram(style: .collaborative), targets: WeekTargets(every: target(2400, 150, 80, 250))
        )
        var model = wizard(.newGoal, current: current)
        model.goal.change(kind: .lose, currentWeightKg: weightKg)
        model.goal.targetWeightKg = 85
        model.goal.ratePercent = 0.7594
        #expect(model.coaching.style == .collaborative)
        model.leave(.style)
        #expect(model.plan(isFirst: false).targets.days.map(\.energy) == Array(repeating: 1569, count: 7))
        #expect(model.plan(isFirst: false).targets[1].protein == 150)
    }

    @Test func aTargetOfZeroIsRejectedWithoutProjecting() {
        var goal = GoalDraft(kind: .lose, currentWeightKg: 90)
        goal.targetWeightKg = 0
        #expect(goal.problem(currentWeightKg: 90) == "Enter a target weight.")
        #expect(goal.projectedEnd(from: today, currentWeightKg: 90) == nil)
        goal.targetWeightKg = -3
        #expect(goal.projectedEnd(from: today, currentWeightKg: 90) == nil)
    }

    @Test(arguments: [NutritionGoal.Kind.lose, .maintain, .gain])
    func manualSavesTheOwnersTargets(kind: NutritionGoal.Kind) {
        var model = wizard()
        model.goal.change(kind: kind, currentWeightKg: weightKg)
        model.goal.targetWeightKg = weightKg + (kind == .lose ? -5 : kind == .gain ? 5 : 0)
        model.choose(.manual)
        #expect(model.steps.suffix(2) == [.manualMode, .manualTargets])
        model.manualSameAllWeek = true
        model.manual[1] = target(1600, 170, 48, 170)
        model.manual[3] = target(9999, 1, 1, 1)
        #expect(model.plan(isFirst: true).targets == WeekTargets(every: target(1600, 170, 48, 170)))
        model.manualSameAllWeek = false
        #expect(model.plan(isFirst: true).targets[3] == target(9999, 1, 1, 1))
    }

    @Test func withoutAnExpenditureOnlyManualIsOffered() {
        let model = StrategyWizardModel(mode: .newGoal, current: nil, today: today, weightKg: weightKg, expenditureKcal: nil, standardFloorKcal: 1200)
        #expect(model.coaching.style == .manual)
        #expect(!model.canChoose(.coached))
        #expect(!model.canChoose(.collaborative))
        #expect(model.canChoose(.manual))
    }

    @Test func editGoalKeepsTheGoalsStartAndRetargetsACoachedProgram() {
        var sample = wizard()
        sample.goal.targetWeightKg = 85
        sample.goal.ratePercent = 0.7594
        sample.choose(.coached)
        sample.shiftCalories = true
        sample.coaching.highDays = [5, 6]
        var current = sample.plan(isFirst: true)
        current = NutritionPlan(from: calendarDay("2026-10-01"), kind: .setup, goal: NutritionGoal(kind: .lose, targetWeightKg: 85, ratePercentPerWeek: -0.7594, startedOn: calendarDay("2026-10-01")), coaching: current.coaching, targets: current.targets)

        var edit = wizard(.editGoal, current: current)
        #expect(edit.steps == [.goalWeightRate, .goalSummary])
        edit.goal.ratePercent = 0.5
        let plan = edit.plan(isFirst: false)
        #expect(plan.goal.startedOn == calendarDay("2026-10-01"))
        #expect(plan.goal.ratePercentPerWeek == -0.5)
        #expect(plan.targets[1].energy == 1738)
        #expect(plan.targets[5].energy == 1912)

        var manual = current
        manual.coaching.style = .manual
        var manualEdit = wizard(.editGoal, current: manual)
        manualEdit.goal.ratePercent = 0.5
        #expect(manualEdit.plan(isFirst: false).targets == manual.targets)
    }

    @Test func editProgramWalksOnlyTheCurrentStylesSteps() {
        let current = NutritionPlan(
            from: calendarDay("2026-10-01"), kind: .setup,
            goal: NutritionGoal(kind: .maintain, targetWeightKg: 89, ratePercentPerWeek: 0, startedOn: calendarDay("2026-10-01")),
            coaching: CoachingProgram(style: .collaborative), targets: WeekTargets(every: target(2000, 150, 70, 200))
        )
        let model = wizard(.editProgram, current: current)
        #expect(model.steps == [.collaborative])
        #expect(model.collaborative.targets == current.targets)
        #expect(model.plan(isFirst: false).goal == current.goal)
        #expect(wizard(.newProgram, current: nil).mode == .newGoal)
    }

    @Test func reopeningAGoalStartsItTodayWithTheCurrentProgram() {
        let previous = NutritionGoal(kind: .maintain, targetWeightKg: weightKg, ratePercentPerWeek: 0, startedOn: calendarDay("2026-01-01"))
        let current = NutritionPlan(
            from: calendarDay("2026-10-01"), kind: .edit,
            goal: NutritionGoal(kind: .lose, targetWeightKg: 85, ratePercentPerWeek: -0.5, startedOn: calendarDay("2026-10-01")),
            coaching: CoachingProgram(), targets: WeekTargets(every: target(1700, 151, 50, 120))
        )
        let basis = StrategyBasis(weightKg: weightKg, expenditureKcal: 2210, standardFloorKcal: 1361)
        let plan = StrategyRules.reopenedPlan(previous: previous, current: current, basis: basis, today: today)
        #expect(plan.id == today)
        #expect(plan.goal.startedOn == today)
        #expect(plan.goal.kind == .maintain)
        #expect(plan.targets == WeekTargets(every: target(2210, 151, 90, 194)))
    }
}
