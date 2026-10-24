import Foundation
import Testing
@testable import App

/// Update Workout Plan with View Changes' Undo, over a template of a bench press, a row, and a curl.
struct PlanTests {
    private static func exercise(_ name: String, reps: Int, sets count: Int = 2) -> BlockExercise {
        BlockExercise(exerciseID: name, sets: Array(repeating: WorkoutSet(target: SetTarget(repsMin: reps, repsMax: reps)), count: count))
    }

    private static let bench = exercise("bench", reps: 5)
    private static let row = exercise("row", reps: 8)
    private static let curl = exercise("curl", reps: 12)
    private static let template = [WorkoutBlock(exercises: [bench]), WorkoutBlock(exercises: [row]), WorkoutBlock(exercises: [curl])]

    private static func logged(_ item: BlockExercise) -> BlockExercise {
        var item = item
        item.sets[0].log = SetLog(weightKg: 100, reps: 5, completedAt: .now)
        return item
    }

    private static func names(_ blocks: [WorkoutBlock]) -> [[String]] { blocks.map { $0.exercises.map(\.exerciseID) } }

    @Test func undoneModifiedExerciseKeepsTheTemplateSetsAndNoLogs() {
        var heavierBench = Self.logged(Self.bench)
        heavierBench.sets.append(WorkoutSet(target: SetTarget(repsMin: 3, repsMax: 3)))
        let session = [WorkoutBlock(exercises: [heavierBench]), WorkoutBlock(exercises: [Self.row]), WorkoutBlock(exercises: [Self.curl])]

        let kept = SessionFlow.plan(from: session, template: Self.template, undoing: [])
        #expect(kept[0].exercises[0].sets.count == 3)
        #expect(kept[0].exercises[0].sets.allSatisfy { $0.log == nil })

        let undone = SessionFlow.plan(from: session, template: Self.template, undoing: [.modified])
        #expect(undone[0].exercises[0] == Self.bench)
    }

    @Test func undoneAddedExerciseIsDropped() {
        let dip = Self.exercise("dip", reps: 10)
        let session = Self.template + [WorkoutBlock(exercises: [dip])]
        #expect(Self.names(SessionFlow.plan(from: session, template: Self.template, undoing: [.added])) == [["bench"], ["row"], ["curl"]])
        #expect(Self.names(SessionFlow.plan(from: session, template: Self.template, undoing: [.modified])) == [["bench"], ["row"], ["curl"], ["dip"]])
    }

    @Test func undoneRemovedExerciseReturnsWhereTheTemplateHadIt() {
        let session = [WorkoutBlock(exercises: [Self.bench]), WorkoutBlock(exercises: [Self.curl])]
        let plan = SessionFlow.plan(from: session, template: Self.template, undoing: [.removed])
        #expect(Self.names(plan) == [["bench"], ["row"], ["curl"]])
        #expect(plan[1].exercises[0] == Self.row)
    }

    @Test func undoneSupersetSplitsBackIntoTheTemplateBlocks() {
        let session = [WorkoutBlock(exercises: [Self.bench, Self.row]), WorkoutBlock(exercises: [Self.curl])]
        #expect(Self.names(SessionFlow.plan(from: session, template: Self.template, undoing: [.regrouped])) == [["bench"], ["row"], ["curl"]])
        #expect(Self.names(SessionFlow.plan(from: session, template: Self.template, undoing: [])) == [["bench", "row"], ["curl"]])
    }

    @Test func undoneSupersetRejoinsATemplateSuperset() {
        let template = [WorkoutBlock(exercises: [Self.bench, Self.row]), WorkoutBlock(exercises: [Self.curl])]
        let session = [WorkoutBlock(exercises: [Self.bench]), WorkoutBlock(exercises: [Self.row, Self.curl])]
        #expect(Self.names(SessionFlow.plan(from: session, template: template, undoing: [.regrouped])) == [["bench", "row"], ["curl"]])
    }
}
