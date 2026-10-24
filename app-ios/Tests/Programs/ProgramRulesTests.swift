import Foundation
import Testing
@testable import App

struct RepSchemeTests {
    @Test func linearHypertrophyPrimaryWalksTheLadder() {
        #expect(RepScheme.tiers(goal: .hypertrophy, role: .primary, progression: .linear).map(\.min) == [11, 11, 9, 8, 7, 5, 5])
        #expect(RepScheme.tiers(goal: .hypertrophy, role: .accessory, progression: .noPreference).map(\.min) == [19, 19, 16, 14, 12, 9, 9])
        #expect(RepScheme.tiers(goal: .strength, role: .primary, progression: .linear).map(\.min) == [7, 7, 5, 4, 4, 2, 2])
        #expect(RepScheme.tiers(goal: .both, role: .pullPrimary, progression: .linear).map(\.min) == [11, 11, 9, 8, 7, 5, 5])
        #expect(RepScheme.tiers(goal: .both, role: .secondary, progression: .linear).map(\.min) == [14, 14, 12, 10, 9, 7, 7])
    }

    @Test func reverseAndUndulatingReorderTheLadder() {
        #expect(RepScheme.tiers(goal: .hypertrophy, role: .primary, progression: .reverseLinear).map(\.min) == [5, 5, 7, 8, 9, 11, 11])
        #expect(RepScheme.tiers(goal: .hypertrophy, role: .primary, progression: .undulating).map(\.min) == [11, 8, 5, 11, 7, 9, 5])
        #expect(RepScheme.tiers(goal: .hypertrophy, role: .accessory, progression: .undulating).map(\.min) == [19, 14, 9, 19, 12, 16, 9])
    }

    @Test func staticKeepsOneTierPerRole() {
        let roles: [GeneratedRole] = [.primary, .secondary, .pullPrimary, .pullSecondary, .accessory]
        #expect(roles.map { RepScheme.tiers(goal: .hypertrophy, role: $0, progression: .constant).map(\.min) } == [
            Array(repeating: 7, count: 7), Array(repeating: 9, count: 7), Array(repeating: 9, count: 7),
            Array(repeating: 11, count: 7), Array(repeating: 14, count: 7),
        ])
    }

    @Test func rirTracksFollowTheSetCount() {
        #expect(RepScheme.rir(role: .primary, sets: 1) == [2])
        #expect(RepScheme.rir(role: .primary, sets: 3) == [3, 2, 1])
        #expect(RepScheme.rir(role: .secondary, sets: 4) == [3, 2, 2, 1])
        #expect(RepScheme.rir(role: .primary, sets: 5) == [3, 2, 2, 1, 1])
        #expect(RepScheme.rir(role: .pullPrimary, sets: 2) == [1, 0])
        #expect(RepScheme.rir(role: .pullSecondary, sets: 4) == [2, 1, 1, 0])
        #expect(RepScheme.rir(role: .accessory, sets: 2) == [0, 0])
        #expect(RepScheme.rir(role: .accessory, sets: 3) == [1, 0, 0])
    }

    @Test func cycleTargetsHoldSevenCyclesOfStandardSets() {
        let targets = RepScheme.cycleTargets(count: 3, goal: .hypertrophy, role: .primary, progression: .linear)
        #expect(targets.count == 7)
        #expect(targets[2].sets.map { $0.target?.repsMin } == [9, 9, 9])
        #expect(targets[2].sets.map { $0.target?.repsMax } == [11, 11, 11])
        #expect(targets[2].sets.map { $0.target?.rir } == [3, 2, 1])
        #expect(targets.allSatisfy { $0.sets.allSatisfy { $0.type == .standard && $0.restSeconds == nil } })
    }
}

struct DeloadRuleTests {
    private func sets(_ reps: (Int, Int), _ rirs: [Int]) -> [WorkoutSet] {
        rirs.map { WorkoutSet(target: SetTarget(repsMin: reps.0, repsMax: reps.1, rir: $0)) }
    }

    private func describe(_ sets: [WorkoutSet]) -> [String] {
        sets.map { "\($0.target!.repsMin!)-\($0.target!.repsMax!) RIR \($0.target!.rir!)" }
    }

    @Test func dropsTheLastSetAddsThreeRIRAndScalesReps() {
        #expect(describe(DeloadRule.apply(to: sets((5, 7), [3, 2, 1]))) == ["4-6 RIR 6", "4-6 RIR 5"])
        #expect(describe(DeloadRule.apply(to: sets((7, 9), [2, 1]))) == ["6-7 RIR 5"])
        #expect(describe(DeloadRule.apply(to: sets((7, 9), [1, 0]))) == ["6-7 RIR 4"])
        #expect(describe(DeloadRule.apply(to: sets((9, 11), [1, 0, 0]))) == ["7-9 RIR 4", "7-9 RIR 3"])
        #expect(describe(DeloadRule.apply(to: sets((2, 4), [3, 2, 1]))) == ["2-3 RIR 6", "2-3 RIR 5"])
        #expect(describe(DeloadRule.apply(to: sets((7, 9), [0, 0]))) == ["6-7 RIR 3"])
    }

    @Test func aSingleSetStays() {
        #expect(describe(DeloadRule.apply(to: sets((11, 13), [2]))) == ["9-10 RIR 5"])
    }
}

struct ProgramCyclesTests {
    private func program(deload: Deload, cycles: Int = 7) -> Program {
        var config = ProgramConfig()
        config.deload = deload
        return Program(name: "Test", color: .blue, cycles: cycles, days: [ProgramDay(templateID: UUID()), ProgramDay(), ProgramDay(templateID: UUID())], config: config)
    }

    private var item: BlockExercise {
        let targets = RepScheme.cycleTargets(count: 2, goal: .hypertrophy, role: .primary, progression: .linear)
        return BlockExercise(exerciseID: "x", sets: targets[0].sets, cycleTargets: targets)
    }

    @Test func deloadLastAddsAnEighthCycleDerivedFromWeekSeven() {
        let program = program(deload: .lastCycle)
        #expect(program.totalCycles == 8)
        #expect((1...8).map(program.cycleLabel) == ["Cycle 1", "Cycle 2", "Cycle 3", "Cycle 4", "Cycle 5", "Cycle 6", "Cycle 7", "Deload"])
        #expect(program.sets(of: item, cycle: 7)?.map { $0.target?.repsMin } == [5, 5])
        #expect(program.sets(of: item, cycle: 8)?.map { $0.target?.repsMin } == [4])
        #expect(program.sets(of: item, cycle: 8)?.map { $0.target?.rir } == [5])
    }

    @Test func deloadFirstShiftsTheWeeks() {
        let program = program(deload: .firstCycle)
        #expect((1...8).map(program.cycleLabel) == ["Deload", "Cycle 1", "Cycle 2", "Cycle 3", "Cycle 4", "Cycle 5", "Cycle 6", "Cycle 7"])
        #expect(program.sets(of: item, cycle: 1)?.map { $0.target?.repsMin } == [9])
        #expect(program.sets(of: item, cycle: 2)?.map { $0.target?.repsMin } == [11, 11])
        #expect(program.sets(of: item, cycle: 8)?.map { $0.target?.repsMin } == [5, 5])
    }

    @Test func withoutCycleTargetsEveryCycleUsesThePlainSets() {
        let program = program(deload: .none, cycles: 10)
        let plain = BlockExercise(exerciseID: "x", sets: [WorkoutSet(target: SetTarget(repsMin: 8, repsMax: 10, rir: 2))])
        #expect(program.totalCycles == 10)
        #expect(program.sets(of: plain, cycle: 10)?.map { $0.target?.repsMin } == [8])
    }

    @Test func skippedWeeksDropTheExerciseFromTheSessionBlocks() {
        let program = program(deload: .none)
        var skipped = item
        skipped.setSkipped(true, week: 3, weeks: 7)
        var template = WorkoutTemplate(name: "Day", blocks: [WorkoutBlock(exercises: [skipped]), WorkoutBlock(exercises: [item])])
        template.programID = program.id
        #expect(program.blocks(of: template, cycle: 3).count == 1)
        #expect(program.blocks(of: template, cycle: 2).count == 2)
        #expect(program.blocks(of: template, cycle: 2).allSatisfy { $0.exercises.allSatisfy { $0.cycleTargets == nil } })
    }

    @Test func settingWeekTargetsGrowsTheCycleList() {
        var plain = BlockExercise(exerciseID: "x", sets: [WorkoutSet(target: SetTarget(repsMin: 8, repsMax: 10, rir: 2))])
        plain.setWeekTargets([WorkoutSet(target: SetTarget(repsMin: 5, repsMax: 7, rir: 1))], week: 4, weeks: 6)
        #expect(plain.cycleTargets?.count == 6)
        #expect(plain.cycleTargets?.map { $0.sets[0].target?.repsMin } == [8, 8, 8, 5, 8, 8])
        plain.setWeekTargets([WorkoutSet(target: SetTarget(repsMin: 12, repsMax: 14, rir: 2))], week: 1, weeks: 6)
        #expect(plain.sets[0].target?.repsMin == 12)
    }

    @Test func sessionStartsAtTheCurrentCycleWithItsPosition() {
        var program = program(deload: .lastCycle)
        program.currentCycle = 3
        var template = WorkoutTemplate(name: "Day", blocks: [WorkoutBlock(exercises: [item])])
        template.programID = program.id
        let session = program.session(startingFrom: template, dayID: program.days[0].id, gymID: nil)
        #expect(session.program == ProgramPosition(programID: program.id, dayID: program.days[0].id, cycle: 3))
        #expect(session.blocks[0].exercises[0].sets.map { $0.target?.repsMin } == [9, 9])
        #expect(session.templateID == template.id)
    }
}

struct ProgramAdvanceTests {
    private func finished(_ program: Program, day: Int, cycle: Int) -> WorkoutSession {
        var session = WorkoutSession(name: "Day \(day)")
        session.program = ProgramPosition(programID: program.id, dayID: program.days[day].id, cycle: cycle)
        session.endedAt = .now
        return session
    }

    private var program: Program {
        var config = ProgramConfig()
        config.deload = .lastCycle
        var program = Program(name: "Test", color: .blue, cycles: 2, days: [ProgramDay(templateID: UUID()), ProgramDay(), ProgramDay(templateID: UUID())], config: config)
        program.currentCycle = 1
        return program
    }

    @Test func staysUntilEveryWorkoutDayOfTheCycleIsDone() {
        let program = program
        #expect(ProgramAdvance.cycle(after: finished(program, day: 0, cycle: 1), program: program, finished: []) == nil)
        #expect(ProgramAdvance.cycle(after: finished(program, day: 2, cycle: 1), program: program, finished: [finished(program, day: 0, cycle: 1)]) == 2)
        #expect(ProgramAdvance.cycle(after: finished(program, day: 0, cycle: 1), program: program, finished: [finished(program, day: 2, cycle: 1)]) == 2)
    }

    @Test func ignoresSessionsOfOtherCyclesAndPrograms() {
        let program = program
        #expect(ProgramAdvance.cycle(after: finished(program, day: 2, cycle: 1), program: program, finished: [finished(program, day: 0, cycle: 2)]) == nil)
        var other = program
        other.id = UUID()
        #expect(ProgramAdvance.cycle(after: finished(other, day: 2, cycle: 1), program: program, finished: [finished(program, day: 0, cycle: 1)]) == nil)
        #expect(ProgramAdvance.cycle(after: finished(program, day: 2, cycle: 2), program: program, finished: [finished(program, day: 0, cycle: 2)]) == nil)
    }

    @Test func sessionsBeforeTheRunStartedCountForNothing() {
        var program = program
        program.config.runStartedAt = Date(timeIntervalSince1970: 1_000)
        var old = finished(program, day: 0, cycle: 1)
        old.startedAt = Date(timeIntervalSince1970: 500)
        var fresh = finished(program, day: 2, cycle: 1)
        fresh.startedAt = Date(timeIntervalSince1970: 2_000)
        #expect(!program.isDone(program.days[0], finished: [old]))
        #expect(program.isDone(program.days[2], finished: [fresh]))
        #expect(ProgramAdvance.cycle(after: fresh, program: program, finished: [old]) == nil)
        var redone = old
        redone.startedAt = Date(timeIntervalSince1970: 1_500)
        #expect(ProgramAdvance.cycle(after: fresh, program: program, finished: [redone]) == 2)
    }

    @Test func wrapsToCycleOneAfterTheDeload() {
        var program = program
        program.currentCycle = 3
        #expect(program.totalCycles == 3)
        #expect(ProgramAdvance.cycle(after: finished(program, day: 2, cycle: 3), program: program, finished: [finished(program, day: 0, cycle: 3)]) == 1)
    }
}

struct ExerciseAssessmentTests {
    private func exercise(_ precondition: String?) -> Exercise {
        var exercise = Exercise(id: "e", name: "E", type: .compound, primaryMuscles: [.chest], metrics: [.weight, .reps])
        exercise.selection = ExerciseSelection(
            hypertrophy: RecommendationLevels(), strength: RecommendationLevels(), hypertrophyClassification: [], strengthClassification: [],
            exerciseGroups: [], exclusionGroupings: [], preconditions: precondition.map { [$0] } ?? [], stretchedMuscles: [],
            emphasizedAgonists: [], deemphasizedAgonists: []
        )
        return exercise
    }

    @Test func questionsGateTheirPreconditionFamilies() {
        #expect(ExerciseAssessment.question(gating: "Barbell bench press preconditions") == "benchPress10")
        #expect(ExerciseAssessment.question(gating: "45° incline barbell press preconditions") == "inclinePress10")
        #expect(ExerciseAssessment.question(gating: "Barbell overhead press preconditions") == "overheadPress10")
        #expect(ExerciseAssessment.question(gating: "Bodyweight vertical pulls preconditions") == "pullUps5")
        #expect(ExerciseAssessment.question(gating: "Weighted vertical pulls preconditions") == "pullUps10")
        #expect(ExerciseAssessment.question(gating: "Wide grip weighted pull-up preconditions") == "pullUps10")
        #expect(ExerciseAssessment.question(gating: "Bodyweight dip preconditions") == "dips10")
        #expect(ExerciseAssessment.question(gating: "Intermediate push-up preconditions") == "pushUps15")
        #expect(ExerciseAssessment.question(gating: "Nordic curl preconditions") == nil)
    }

    @Test func unansweredQuestionsCloseTheGate() {
        var profile = ProfileSettings()
        #expect(!ExerciseAssessment.allows(exercise("Barbell bench press preconditions"), profile: profile))
        #expect(ExerciseAssessment.allows(exercise(nil), profile: profile))
        #expect(ExerciseAssessment.allows(exercise("Nordic curl preconditions"), profile: profile))
        profile.assessment["benchPress10"] = "yes"
        #expect(ExerciseAssessment.allows(exercise("Barbell bench press preconditions"), profile: profile))
        profile.assessment["benchPress10"] = "no"
        #expect(!ExerciseAssessment.allows(exercise("Barbell bench press preconditions"), profile: profile))
    }
}

struct SplitPlanTests {
    @Test func weekPatternsFollowTheDayCount() {
        #expect(SplitPlan.weekPattern(daysPerWeek: 2) == [true, false, false, true, false, false, false])
        #expect(SplitPlan.weekPattern(daysPerWeek: 3) == [true, false, true, false, true, false, false])
        #expect(SplitPlan.weekPattern(daysPerWeek: 4) == [true, false, true, false, true, true, false])
        #expect(SplitPlan.weekPattern(daysPerWeek: 5) == [true, true, true, true, true, false, false])
        #expect(SplitPlan.weekPattern(daysPerWeek: 6) == [true, true, true, true, true, true, false])
    }

    @Test func noPreferenceResolvesPerDayCount() {
        #expect(SplitPlan.resolve(.noPreference, daysPerWeek: 2) == .fullBody)
        #expect(SplitPlan.resolve(.noPreference, daysPerWeek: 5) == .pushPullLegsUpperLower)
        #expect(SplitPlan.resolve(.noPreference, daysPerWeek: 6) == .pushPullLegsPushPullLegs)
        #expect(SplitPlan.resolve(.pushPullLegs, daysPerWeek: 3) == .pushPullLegs)
    }

    @Test func everySplitGivesEachPatternOnePrimaryPerWeek() {
        for days in 2...6 {
            for split in SplitPlan.options(daysPerWeek: days) {
                let skeletons = SplitPlan.skeletons(for: SplitPlan.resolve(split, daysPerWeek: days), daysPerWeek: days)
                #expect(skeletons.count == days, "\(split) at \(days) days")
                #expect(skeletons.flatMap(\.primaries).sorted { $0.rawValue < $1.rawValue } == MovementPattern.allCases.sorted { $0.rawValue < $1.rawValue }, "\(split) at \(days) days")
            }
        }
    }

    @Test func splitOptionsMatchTheWizard() {
        #expect(SplitPlan.options(daysPerWeek: 4) == [.noPreference, .fullBody, .upperLowerUpperLower, .pushPullHingeSquat, .pushPullLegsAccessories])
        #expect(SplitPlan.options(daysPerWeek: 6).map(\.title) == ["No preference", "Full Body", "Push/Pull/Hinge/Squat/Upper/Lower Split", "Push/Pull/Legs/Push/Pull/Legs Split"])
    }
}

struct ProgramDayNameTests {
    @Test func duplicateTakesTheNextLetterOrAddsCopy() {
        #expect(ProgramDayName.duplicate(of: "Workout C", taken: ["Workout A", "Workout B", "Workout C"]) == "Workout D")
        #expect(ProgramDayName.duplicate(of: "Workout A", taken: ["Workout A", "Workout B"]) == "Workout A Copy")
        #expect(ProgramDayName.duplicate(of: "Push", taken: ["Push"]) == "Push Copy")
        #expect(ProgramDayName.duplicate(of: "Upper A", taken: ["Upper A", "Lower A"]) == "Upper B")
    }
}

struct ProgramPlanUpdateTests {
    private func set(_ reps: Int, rir: Int = 2) -> WorkoutSet { WorkoutSet(target: SetTarget(repsMin: reps, repsMax: reps + 2, rir: rir)) }

    private func fixture() -> (Program, WorkoutTemplate) {
        var config = ProgramConfig()
        config.periodization = true
        config.deload = .lastCycle
        var program = Program(name: "P", color: .red, cycles: 3, config: config)
        let bench = BlockExercise(exerciseID: "bench", sets: [set(11)], cycleTargets: [CycleTargets(sets: [set(11)]), CycleTargets(sets: [set(9)]), CycleTargets(sets: [set(7)])])
        let row = BlockExercise(exerciseID: "row", sets: [set(14)], cycleTargets: [CycleTargets(sets: [set(14)]), CycleTargets(sets: [set(12)]), CycleTargets(sets: [set(10)])])
        var template = WorkoutTemplate(name: "Day", blocks: [WorkoutBlock(exercises: [bench]), WorkoutBlock(exercises: [row])])
        template.programID = program.id
        program.days = [ProgramDay(templateID: template.id)]
        return (program, template)
    }

    @Test func aWeeksSessionRewritesOnlyThatWeek() {
        var (program, template) = fixture()
        program.currentCycle = 2
        var session = program.session(startingFrom: template, dayID: program.days[0].id, gymID: nil)
        session.blocks[0].exercises[0].sets = [set(8), set(8)]
        session.blocks.remove(at: 1)
        session.blocks.append(WorkoutBlock(exercises: [BlockExercise(exerciseID: "curl", sets: [set(15)])]))
        let blocks = ProgramPlanUpdate.blocks(of: template, updatedBy: session, program: program)
        let bench = blocks[0].exercises[0]
        #expect(bench.cycleTargets?.map { $0.sets.map { $0.target?.repsMin } } == [[11], [8, 8], [7]])
        #expect(bench.sets.map { $0.target?.repsMin } == [11])
        let row = blocks[1].exercises[0]
        #expect(row.cycleTargets?.map(\.skip) == [false, true, false])
        #expect(row.cycleTargets?.map { $0.sets.map { $0.target?.repsMin } } == [[14], [12], [10]])
        #expect(blocks[2].exercises[0].exerciseID == "curl")
        #expect(blocks[2].exercises[0].cycleTargets == nil)
    }

    @Test func aDeloadSessionChangesNothingAndAnUnperiodizedProgramTakesTheSets() {
        var (program, template) = fixture()
        program.currentCycle = 4
        var session = program.session(startingFrom: template, dayID: program.days[0].id, gymID: nil)
        session.blocks[0].exercises[0].sets = [set(3)]
        #expect(ProgramPlanUpdate.blocks(of: template, updatedBy: session, program: program) == template.blocks)

        program.config.periodization = false
        program.currentCycle = 1
        template.blocks[0].exercises[0].cycleTargets = nil
        var plain = program.session(startingFrom: template, dayID: program.days[0].id, gymID: nil)
        plain.blocks[0].exercises[0].sets = [set(6), set(6)]
        let blocks = ProgramPlanUpdate.blocks(of: template, updatedBy: plain, program: program)
        #expect(blocks[0].exercises[0].sets.map { $0.target?.repsMin } == [6, 6])
        #expect(blocks[0].exercises[0].cycleTargets == nil)
    }
}
