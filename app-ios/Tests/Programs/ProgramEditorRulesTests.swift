import Foundation
import Testing
@testable import App

private let benchID: ExerciseID = "19f5c6f170d8808bb424e98de4472a7e"
private let legExtensionID: ExerciseID = "1a25c6f170d880c59f17ce7802758fc3"

private func sets(_ reps: (Int, Int), _ rirs: [Int]) -> [WorkoutSet] {
    rirs.map { WorkoutSet(target: SetTarget(repsMin: reps.0, repsMax: reps.1, rir: $0)) }
}

private func describe(_ sets: [WorkoutSet]?) -> [String] {
    (sets ?? []).map { "\($0.target?.repsMin ?? 0)-\($0.target?.repsMax ?? 0) RIR \($0.target?.rir ?? -1)" }
}

/// Bench 3 sets at 11-13 in weeks 1-2, 9-11 in 3-4, 5-7 in 5-7; leg extension 2 x 14-16 every week.
private func bench() -> BlockExercise {
    let ladder = [(11, 13), (11, 13), (9, 11), (9, 11), (5, 7), (5, 7), (5, 7)]
    let targets = ladder.map { CycleTargets(sets: sets($0, [3, 2, 1])) }
    return BlockExercise(exerciseID: benchID, sets: targets[0].sets, cycleTargets: targets)
}

private func legExtension() -> BlockExercise {
    let week = sets((14, 16), [1, 0])
    return BlockExercise(exerciseID: legExtensionID, sets: week, cycleTargets: Array(repeating: CycleTargets(sets: week), count: 7))
}

private func weeks(_ item: BlockExercise) -> [[String]] {
    (item.cycleTargets ?? []).map { describe($0.sets) }
}

struct SavingScopeTests {
    let blocks = [WorkoutBlock(exercises: [bench()]), WorkoutBlock(exercises: [legExtension()])]
    var benchItem: BlockExercise { blocks[0].exercises[0] }

    func edit(week: Int, skip: Bool = false) -> WeekTargetsEdit {
        WeekTargetsEdit(exerciseID: benchItem.id, week: week, sets: sets((8, 10), [2, 2]), skip: skip)
    }

    @Test func saveWritesOneWeekOfOneExercise() {
        let saved = SavingScope().apply(edit(week: 2), to: blocks, isSourceDay: true, weeks: 7, periodized: true)
        #expect(weeks(saved[0].exercises[0]).map(\.first) == ["11-13 RIR 3", "8-10 RIR 2", "9-11 RIR 3", "9-11 RIR 3", "5-7 RIR 3", "5-7 RIR 3", "5-7 RIR 3"])
        #expect(saved[0].exercises[0].cycleTargets?[1].sets.count == 2)
        #expect(describe(saved[0].exercises[0].sets) == ["11-13 RIR 3", "11-13 RIR 2", "11-13 RIR 1"])
        #expect(saved[1] == blocks[1])
    }

    @Test func weekOneAndBeyondLeavesEarlierWeeks() {
        let scope = SavingScope(cycles: .thisAndLater)
        let saved = scope.apply(edit(week: 6), to: blocks, isSourceDay: true, weeks: 7, periodized: true)
        #expect(weeks(saved[0].exercises[0]).map(\.count) == [3, 3, 3, 3, 3, 2, 2])
    }

    @Test func allWeeksOfWeekOneAlsoRewritesThePlainSets() {
        let saved = SavingScope.allWeeks.apply(edit(week: 1), to: blocks, isSourceDay: true, weeks: 7, periodized: true)
        #expect(Set(weeks(saved[0].exercises[0])) == [["8-10 RIR 2", "8-10 RIR 2"]])
        #expect(describe(saved[0].exercises[0].sets) == ["8-10 RIR 2", "8-10 RIR 2"])
    }

    @Test func otherExercisesTakeCountRepsAndRIR() {
        let scope = SavingScope(cycles: .thisWeek, exercises: .day)
        let saved = scope.apply(WeekTargetsEdit(exerciseID: benchItem.id, week: 1, sets: sets((6, 8), [3, 2, 1]), skip: false), to: blocks, isSourceDay: true, weeks: 7, periodized: true)
        #expect(weeks(saved[1].exercises[0])[0] == ["6-8 RIR 3", "6-8 RIR 2", "6-8 RIR 1"])
        #expect(weeks(saved[1].exercises[0])[1] == ["14-16 RIR 1", "14-16 RIR 0"])
    }

    @Test func dayScopeSkipsOtherDaysAndProgramScopeReachesThem() {
        let other = [WorkoutBlock(exercises: [legExtension()])]
        let day = SavingScope(cycles: .thisWeek, exercises: .day).apply(edit(week: 3), to: other, isSourceDay: false, weeks: 7, periodized: true)
        #expect(day == other)
        let program = SavingScope(cycles: .thisWeek, exercises: .program).apply(edit(week: 3), to: other, isSourceDay: false, weeks: 7, periodized: true)
        #expect(weeks(program[0].exercises[0])[2] == ["8-10 RIR 2", "8-10 RIR 2"])
    }

    @Test func skipMarksTheChosenWeeks() {
        let saved = SavingScope(cycles: .thisAndLater).apply(edit(week: 6, skip: true), to: blocks, isSourceDay: true, weeks: 7, periodized: true)
        #expect(saved[0].exercises[0].cycleTargets?.map(\.skip) == [false, false, false, false, false, true, true])
    }

    @Test func withoutPeriodizationTheSetsArePlain() {
        let plain = [WorkoutBlock(exercises: [BlockExercise(exerciseID: benchID, sets: sets((11, 13), [3, 2, 1]))])]
        let edit = WeekTargetsEdit(exerciseID: plain[0].exercises[0].id, week: 1, sets: sets((8, 10), [2, 1]), skip: true)
        let saved = SavingScope.allWeeks.apply(edit, to: plain, isSourceDay: true, weeks: 7, periodized: false)
        #expect(describe(saved[0].exercises[0].sets) == ["8-10 RIR 2", "8-10 RIR 1"])
        #expect(saved[0].exercises[0].cycleTargets == nil)
    }
}

struct ProgramEditorRulesTests {
    @Test func addingAWeekRepeatsTheLastWeek() {
        let grown = ProgramEditorRules.settingWeeks(8, from: 7, in: [WorkoutBlock(exercises: [bench()])])
        let targets = weeks(grown[0].exercises[0])
        #expect(targets.count == 8)
        #expect(targets[7] == ["5-7 RIR 3", "5-7 RIR 2", "5-7 RIR 1"])
    }

    @Test func removingWeeksDropsTheLastOnes() {
        let shrunk = ProgramEditorRules.settingWeeks(3, from: 7, in: [WorkoutBlock(exercises: [bench()])])
        #expect(weeks(shrunk[0].exercises[0]).map(\.first) == ["11-13 RIR 3", "11-13 RIR 3", "9-11 RIR 3"])
    }

    @Test func shortTargetsArePaddedWithThePlainSetsBeforeGrowing() {
        var item = bench()
        item.cycleTargets = Array(item.cycleTargets!.prefix(2).map { CycleTargets(sets: sets((9, 11), [1]), skip: $0.skip) })
        let plain = BlockExercise(exerciseID: legExtensionID, sets: sets((14, 16), [1, 0]))
        let grown = ProgramEditorRules.settingWeeks(5, from: 4, in: [WorkoutBlock(exercises: [item, plain])])
        #expect(weeks(grown[0].exercises[0]).map(\.first) == ["9-11 RIR 1", "9-11 RIR 1", "11-13 RIR 3", "11-13 RIR 3", "11-13 RIR 3"])
        #expect(grown[0].exercises[1].cycleTargets == nil)
    }

    @Test func turningOffPeriodizationKeepsWeekOne() {
        var item = bench()
        item.sets = sets((1, 2), [0])
        let collapsed = ProgramEditorRules.collapsingPeriodization([WorkoutBlock(exercises: [item])])
        #expect(describe(collapsed[0].exercises[0].sets) == ["11-13 RIR 3", "11-13 RIR 2", "11-13 RIR 1"])
        #expect(collapsed[0].exercises[0].cycleTargets == nil)
    }

    private func program(days: Int = 7, deload: Deload, periodization: Bool) -> Program {
        var config = ProgramConfig()
        config.deload = deload
        config.periodization = periodization
        return Program(name: "P", color: .red, cycles: 7, days: Array(repeating: ProgramDay(), count: days), config: config)
    }

    @Test func cardsFollowTheDeloadAndPeriodization() {
        #expect(ProgramEditorRules.cards(of: program(deload: .lastCycle, periodization: true)).map(\.title)
            == ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6", "Week 7", "Deload"])
        #expect(ProgramEditorRules.cards(of: program(days: 8, deload: .firstCycle, periodization: true)).map(\.title).prefix(2) == ["Deload", "Cycle 1"])
        let off = ProgramEditorRules.cards(of: program(deload: .lastCycle, periodization: false))
        #expect(off.map(\.title) == ["7 Weeks", "Deload"])
        #expect(off.map(\.cycle) == [1, 8])
        let offFirst = ProgramEditorRules.cards(of: program(days: 6, deload: .firstCycle, periodization: false))
        #expect(offFirst.map(\.title) == ["Deload", "7 Cycles"])
        #expect(offFirst.map(\.cycle) == [1, 2])
        #expect(ProgramEditorRules.cards(of: program(deload: .none, periodization: false)).map(\.title) == ["7 Weeks"])
    }

    @MainActor @Test func targetMusclesAverageEveryCycleIncludingTheDeload() {
        let catalog = ExerciseCatalog()
        let program = program(deload: .lastCycle, periodization: true)
        let dayA = WorkoutTemplate(name: "Workout A", blocks: [WorkoutBlock(exercises: [bench()])])
        let dayB = WorkoutTemplate(name: "Workout B", blocks: [WorkoutBlock(exercises: [bench(), legExtension()])])
        let day = ProgramEditorRules.averageMuscleSets(program: program, templates: [dayA], exercise: catalog.exercise)
        #expect(day[.chest] == 2.875)
        #expect(day[.triceps] == 1.4375)
        let week = ProgramEditorRules.averageMuscleSets(program: program, templates: [dayA, dayB], exercise: catalog.exercise)
        #expect(week[.chest] == 5.75)
        #expect(week[.quads] == 1.875)
    }

    @Test func reorderingKeepsDaysAddedMeanwhile() {
        let days = [ProgramDay(), ProgramDay(), ProgramDay()]
        let reordered = ProgramEditorRules.reordering(days, by: [days[1].id, days[0].id])
        #expect(reordered.map(\.id) == [days[1].id, days[0].id, days[2].id])
    }

    @Test func newWorkoutDaysTakeTheFirstFreeLetter() {
        #expect(ProgramEditorRules.nextWorkoutName(taken: ["Workout A", "Workout C"]) == "Workout B")
    }
}
