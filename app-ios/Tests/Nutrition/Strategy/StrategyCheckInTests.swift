import Foundation
import Testing
@testable import App

private func target(_ energy: Double, _ protein: Double, _ fat: Double, _ carbs: Double) -> DayTarget {
    DayTarget(energy: energy, protein: protein, fat: fat, carbs: carbs)
}

private func plan(_ day: String, _ style: CoachingProgram.Style = .coached, goal: NutritionGoal? = nil, targets: DayTarget = target(1700, 135, 60, 180)) -> NutritionPlan {
    NutritionPlan(
        from: calendarDay(day), kind: .setup,
        goal: goal ?? NutritionGoal(kind: .lose, targetWeightKg: 75, ratePercentPerWeek: -0.5, startedOn: calendarDay(day)),
        coaching: CoachingProgram(style: style), targets: WeekTargets(every: targets)
    )
}

struct CollaborativeWeekTests {
    let week = CollaborativeWeek(WeekTargets(every: target(2000, 150, 70, 200)))

    @Test func aCalorieChangeRebalancesTheUnlockedDaysAndKeepsTheRestExact() {
        var edited = week
        edited.locked = [1]
        edited.setCalories(2538, on: 2)
        #expect(edited.targets.days.map(\.energy) == [2000, 2538, 1892, 1892, 1892, 1893, 1893])
        #expect(edited[1] == target(2000, 150, 70, 200))
        #expect(edited[2] == target(2538, 150, 95, 271))
        #expect(edited[3] == target(1892, 150, 63, 181))
        #expect(edited.weeklyKcal == 14000)
    }

    @Test func proteinAndRatioEditOnlyTheirDay() {
        var edited = week
        edited.setProtein(180, on: 1)
        #expect(edited[1] == target(2000, 180, 63, 179))
        edited.setCarbShare(0.5, on: 2)
        #expect(edited[2] == target(2000, 150, 78, 175))
        #expect(edited[3] == target(2000, 150, 70, 200))
    }

    @Test func resetAndRescaleKeepProteinAndSplit() {
        var edited = week
        edited.locked = [1]
        edited.setCalories(2538, on: 2)
        edited.resetAll(like: 1)
        #expect(edited.targets == WeekTargets(every: target(2000, 150, 69, 196)))
        #expect(edited.locked.isEmpty)
        var scaled = week
        scaled.rescale(toAverage: 1800)
        #expect(scaled.targets == WeekTargets(every: target(1800, 150, 59, 168)))
    }
}

struct StrategyCheckInTests {
    @Test func dueOnceTheCheckInDayArrivesAfterThePlanBegan() {
        let tuesdayPlan = plan("2026-10-20")
        #expect(CheckInRules.isDue(tuesdayPlan, today: calendarDay("2026-10-26"), weekday: 1))
        #expect(CheckInRules.isDue(tuesdayPlan, today: calendarDay("2026-10-26"), weekday: 7))
        #expect(!CheckInRules.isDue(tuesdayPlan, today: calendarDay("2026-10-22"), weekday: 1))
        #expect(!CheckInRules.isDue(plan("2026-10-20", .manual), today: calendarDay("2026-10-26"), weekday: 1))
        #expect(!CheckInRules.isDue(nil, today: calendarDay("2026-10-26"), weekday: 1))
        #expect(CheckInRules.lastCheckInDay(today: calendarDay("2026-10-26"), weekday: 7) == calendarDay("2026-10-25"))
        #expect(CheckInRules.nextCheckInDay(today: calendarDay("2026-10-22"), weekday: 1) == calendarDay("2026-10-26"))
    }

    @Test func coachedAndCollaborativeUpdateManualDoesNot() {
        let basis = StrategyBasis(weightKg: 80, expenditureKcal: 2000, standardFloorKcal: 1200)
        let today = calendarDay("2026-10-26")
        let coached = CheckInRules.checkedIn(plan("2026-10-06"), basis: basis, today: today)
        #expect(coached?.targets == WeekTargets(every: target(1630, 135, 61, 132)))
        #expect(coached?.kind == .checkIn)
        #expect(coached?.id == today)
        #expect(coached?.expenditureKcal == 2000)
        #expect(coached?.trendWeightKg == 80)
        let collaborative = CheckInRules.checkedIn(plan("2026-10-06", .collaborative, targets: target(1700, 150, 50, 160)), basis: basis, today: today)
        #expect(collaborative?.targets == WeekTargets(every: target(1630, 150, 47, 151)))
        #expect(CheckInRules.checkedIn(plan("2026-10-06", .manual), basis: basis, today: today) == nil)
    }

    /// Ten weeks of a steady 80 kg and 2000 kcal a day with a 2000 kcal initial estimate hold the expenditure at 2000,
    /// so the check-in's budget is the engine's smoothing of 1559 toward last week's 1700.
    @MainActor
    @Test func aCheckInRunsEndToEndOnStoredDataAndWritesACheckInRow() async throws {
        let store = try LocalStore(unsyncedAt: FileManager.default.temporaryDirectory.appending(path: "strategy-\(UUID().uuidString)/a.sqlite"))
        let today = calendarDay("2026-10-26")
        for offset in 1...70 {
            let day = today.adding(days: -offset)
            store.insert(BodyWeight(weightKg: 80, measuredAt: StrategyInputs.date(day, utc).addingTimeInterval(12 * 3600)))
            store.quickAdd([.energy: 2000, .protein: 135, .fat: 60, .carbs: 180], on: day, minute: 720)
        }
        store.savePlan(plan("2026-10-06"))
        try await store.write { _ in }.value

        var settings = NutritionSettings()
        settings.expenditure.initialKcal = 2000
        let logged = try store.read(BodyWeight.all.fetch)
        let inputs = StrategyInputs.make(
            weighIns: WeighIns.merge(logged: logged, health: []), log: try store.read(IntakeLog.all.fetch),
            settings: settings, profile: ProfileSettings(), today: today, calendar: utc
        )
        #expect(inputs.trendWeightKg == 80)
        #expect(inputs.expenditureKcal == 2000)
        #expect(CheckInRules.summary(inputs).loggedDays == 7)
        let plans = try store.read(NutritionPlan.all.fetch)
        let current = try #require(NutritionPlan.effective(on: today, in: plans))
        #expect(CheckInRules.isDue(current, today: today, weekday: settings.checkInWeekday))

        let basis = try #require(inputs.basis(standardFloorKcal: 1200))
        let update = try #require(CheckInRules.checkedIn(current, basis: basis, today: today))
        store.savePlan(update)
        try await store.write { _ in }.value

        let saved = try store.read(NutritionPlan.all.fetch)
        #expect(saved.map(\.kind) == [.setup, .checkIn])
        #expect(saved.last?.targets[1] == target(1630, 135, 61, 132))
        #expect(saved.last?.expenditureKcal == 2000)
        #expect(saved.last?.trendWeightKg == 80)
        #expect(!CheckInRules.isDue(NutritionPlan.effective(on: today, in: saved), today: today, weekday: settings.checkInWeekday))
    }
}

struct StrategyInputsTests {
    @Test func theInitialEstimateIsBmrTimesTheAssumedActivity() {
        var profile = ProfileSettings()
        #expect(StrategyInputs.initialEstimate(weightKg: 80, profile: profile, today: calendarDay("2026-10-26")) == nil)
        profile.heightCm = 180
        profile.birthDate = calendarDay("1990-05-01")
        #expect(StrategyInputs.initialEstimate(weightKg: 80, profile: profile, today: calendarDay("2026-10-26")) == 2550)
    }

    @Test func aStaticExpenditureWins() {
        var settings = NutritionSettings()
        settings.expenditure.staticKcal = 2400
        let weighIn = WeighIn(date: StrategyInputs.date(calendarDay("2026-10-20"), utc), kg: 80, source: .health)
        let inputs = StrategyInputs.make(weighIns: [weighIn], log: IntakeLog(), settings: settings, profile: ProfileSettings(), today: calendarDay("2026-10-26"), calendar: utc)
        #expect(inputs.expenditureKcal == 2400)
        #expect(inputs.isStaticExpenditure)
        #expect(inputs.trendWeightKg == 80)
        #expect(inputs.basis(standardFloorKcal: 1200) == StrategyBasis(weightKg: 80, expenditureKcal: 2400, standardFloorKcal: 1200))
    }
}

struct GoalHistoryTests {
    @Test func plansGroupIntoGoalsByTheirStartAndEditsStayInOne() {
        let first = calendarDay("2026-08-01")
        let cut = NutritionGoal(kind: .lose, targetWeightKg: 80, ratePercentPerWeek: -0.5, startedOn: first)
        var edited = cut
        edited.targetWeightKg = 78
        let maintain = NutritionGoal(kind: .maintain, targetWeightKg: 78, ratePercentPerWeek: 0, startedOn: calendarDay("2026-10-01"))
        let plans = [
            plan("2026-08-01", goal: cut), plan("2026-08-08", goal: cut), plan("2026-09-01", goal: edited), plan("2026-10-01", goal: maintain),
        ]
        let inputs = StrategyInputs(
            today: calendarDay("2026-10-26"),
            trend: [first: 85, calendarDay("2026-10-01"): 79, calendarDay("2026-10-26"): 78.5],
            expenditure: [:], intake: [:], statuses: [:], weighInDays: [], trendWeightKg: 78.5, expenditureKcal: nil, isStaticExpenditure: false
        )
        let history = GoalPeriod.history(plans, inputs: inputs)
        #expect(history == [
            GoalPeriod(goal: maintain, start: calendarDay("2026-10-01"), end: nil, startWeightKg: 79, endWeightKg: 78.5),
            GoalPeriod(goal: edited, start: first, end: calendarDay("2026-10-01"), startWeightKg: 85, endWeightKg: 79),
        ])
        #expect(history[0].progress == nil)
        #expect(history[1].progress == 6.0 / 7)
        #expect(StrategyRules.programStart(plans, current: plans[3]) == first)
    }
}

@MainActor
struct NutrientGoalDraftTests {
    @Test func customBoundsMustNotCross() {
        var draft = NutrientGoalDraft(startsOn: calendarDay("2026-10-26"))
        #expect(draft.mode == .auto)
        draft.kind = .custom
        #expect(draft.problem == "Set at least one of the target, floor, or ceiling.")
        draft.range = NutrientRange(floor: 40, target: 38, ceiling: nil)
        #expect(draft.problem == "The floor must not exceed the target, and the target must not exceed the ceiling.")
        draft.range.floor = 25
        #expect(draft.problem == nil)
        #expect(draft.mode == .custom(NutrientRange(floor: 25, target: 38, ceiling: nil)))
        draft.kind = .none
        #expect(draft.mode == .hidden)
        #expect(NutrientGoalDraft.label(nil) == "Default · Auto")
    }

    @Test func aSavedGoalRoundTripsThroughTheStore() async throws {
        let store = try LocalStore(unsyncedAt: FileManager.default.temporaryDirectory.appending(path: "nutrient-goal-\(UUID().uuidString)/a.sqlite"))
        var draft = NutrientGoalDraft(startsOn: calendarDay("2026-10-26"))
        draft.kind = .custom
        draft.range = NutrientRange(floor: 25, target: 38, ceiling: nil)
        store.setNutrientGoal(.fiber, from: draft.startsOn, draft.mode)
        try await store.write { _ in }.value
        let goals = try store.read(NutrientGoal.all.fetch)
        #expect(NutrientGoal.range(.fiber, on: calendarDay("2026-10-27"), goals: goals, sex: .male, weightKg: nil) == NutrientRange(floor: 25, target: 38, ceiling: nil))
        #expect(NutrientGoalDraft(goals[0]) == draft)
    }
}
