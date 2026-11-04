import Foundation
import Testing
@testable import App

/// Where the keypad goes after a set is checked: the next set, or the next member of a superset's round.
struct FlowTests {
    private func exercise(_ id: ExerciseID, sets: Int) -> BlockExercise {
        BlockExercise(exerciseID: id, sets: (0..<sets).map { _ in WorkoutSet(type: .standard) })
    }

    private func logging(_ path: RowPath, in blocks: [WorkoutBlock], rules: FlowRules = FlowRules()) -> RowPath? {
        var blocks = blocks
        blocks.setLog(SetLog(completedAt: .now), at: path)
        let step = SessionFlow.afterCompleting(path, in: blocks, settings: rules) { _, _ in 90 }
        return SessionFlow.rowAfter(path, step: step, in: blocks)
    }

    @Test func aStraightSetMovesToTheNextSet() {
        let blocks = [WorkoutBlock(exercises: [exercise("bench", sets: 3)])]
        #expect(logging(RowPath(block: 0, exercise: 0, set: 0), in: blocks) == RowPath(block: 0, exercise: 0, set: 1))
    }

    @Test func anOpenWarmUpDoesNotPullTheKeypadBack() {
        var bench = exercise("bench", sets: 3)
        bench.sets.insert(WorkoutSet(type: .warmUp), at: 0)
        let blocks = [WorkoutBlock(exercises: [bench])]
        #expect(logging(RowPath(block: 0, exercise: 0, set: 1), in: blocks) == RowPath(block: 0, exercise: 0, set: 2))
        var workingDone = blocks
        workingDone.setLog(SetLog(completedAt: .now), at: RowPath(block: 0, exercise: 0, set: 1))
        workingDone.setLog(SetLog(completedAt: .now), at: RowPath(block: 0, exercise: 0, set: 2))
        #expect(logging(RowPath(block: 0, exercise: 0, set: 3), in: workingDone) == RowPath(block: 0, exercise: 0, set: 0))
    }

    @Test func aSupersetMovesToTheNextMemberThenBackForTheNextRound() {
        let blocks = [WorkoutBlock(exercises: [exercise("curl", sets: 2), exercise("pushdown", sets: 2)])]
        #expect(logging(RowPath(block: 0, exercise: 0, set: 0), in: blocks) == RowPath(block: 0, exercise: 1, set: 0))
        var afterA = blocks
        afterA.setLog(SetLog(completedAt: .now), at: RowPath(block: 0, exercise: 0, set: 0))
        #expect(logging(RowPath(block: 0, exercise: 1, set: 0), in: afterA) == RowPath(block: 0, exercise: 0, set: 1))
    }

    @Test func withoutSupersetAutoScrollTheKeypadStaysOnTheMember() {
        let blocks = [WorkoutBlock(exercises: [exercise("curl", sets: 2), exercise("pushdown", sets: 2)])]
        var rules = FlowRules()
        rules.supersetAutoScroll = false
        #expect(logging(RowPath(block: 0, exercise: 0, set: 0), in: blocks, rules: rules) == RowPath(block: 0, exercise: 0, set: 1))
    }

    @Test func theLastSetMovesToTheNextExercise() {
        let blocks = [WorkoutBlock(exercises: [exercise("bench", sets: 1)]), WorkoutBlock(exercises: [exercise("row", sets: 2)])]
        #expect(logging(RowPath(block: 0, exercise: 0, set: 0), in: blocks) == RowPath(block: 1, exercise: 0, set: 0))
    }
}

struct RestEndHapticTests {
    @Test func theWatchTapsWhileItRecordsAndThePhoneOtherwise() {
        #expect(RestEndHaptic.device(vibrate: true, watchRecords: true) == .watch)
        #expect(RestEndHaptic.device(vibrate: true, watchRecords: false) == .phone)
        #expect(RestEndHaptic.device(vibrate: false, watchRecords: true) == nil)
        #expect(RestEndHaptic.device(vibrate: false, watchRecords: false) == nil)
    }
}
