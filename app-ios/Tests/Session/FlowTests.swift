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

struct LiveRestTests {
    static let start = Date(timeIntervalSince1970: 1_000_000)

    static func at(_ seconds: TimeInterval) -> Date { start.addingTimeInterval(seconds) }

    @Test func aSetLoggedBeforeTheRunningRestBeganLeavesItRunning() {
        let running = LiveRest.starting(120, at: Self.at(100), now: Self.at(100))
        #expect(LiveRest.afterLogging(90, at: Self.at(60), now: Self.at(130), replacing: running) == running)
    }

    @Test func anAdjustedRestStillStartsWhenItsSetWasLogged() {
        let running = LiveRest.starting(120, at: Self.at(100), now: Self.at(100))?.adjusted(by: 15, now: Self.at(110))
        #expect(LiveRest.afterLogging(120, at: Self.at(90), now: Self.at(130), replacing: running) == running)
    }

    @Test func aLaterSetRestartsTheRest() {
        let running = LiveRest.starting(120, at: Self.at(100), now: Self.at(100))
        #expect(LiveRest.afterLogging(90, at: Self.at(150), now: Self.at(150), replacing: running) == LiveRest(endsAt: Self.at(240), duration: 90))
    }

    @Test func aLaterSetWhoseRestIsOverEndsTheRunningOne() {
        let running = LiveRest.starting(300, at: Self.at(100), now: Self.at(100))
        #expect(LiveRest.afterLogging(10, at: Self.at(110), now: Self.at(200), replacing: running) == nil)
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
