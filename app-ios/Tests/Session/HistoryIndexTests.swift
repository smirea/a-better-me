import Foundation
import Testing
@testable import App

/// The Previous column's index and the Workout Complete bests, each built once over the history newest first.
struct HistoryIndexTests {
    private static func set(_ reps: Int?, weightKg: Double = 50) -> WorkoutSet {
        WorkoutSet(log: reps.map { SetLog(weightKg: weightKg, reps: $0, completedAt: Date(timeIntervalSinceReferenceDate: 0)) })
    }

    @Test func previousSetsAreTheNewestLoggedPerformance() {
        let newest = [
            WorkoutBlock(exercises: [BlockExercise(exerciseID: "bench", sets: [Self.set(nil)])]),
            WorkoutBlock(exercises: [BlockExercise(exerciseID: "row", sets: [Self.set(10)])]),
        ]
        let older = [
            WorkoutBlock(exercises: [BlockExercise(exerciseID: "bench", sets: [Self.set(5), Self.set(6)])]),
            WorkoutBlock(exercises: [BlockExercise(exerciseID: "row", sets: [Self.set(8)])]),
        ]
        let index = SessionFlow.previousSets(in: [newest, older])
        #expect(index.keys.sorted() == ["bench", "row"])
        #expect(index["bench"]?.map(\.log?.reps) == [5, 6])
        #expect(index["row"]?.map(\.log?.reps) == [10])
    }

    @Test func aRepeatedExerciseTakesItsFirstLoggedEntryInTheSession() {
        let session = [WorkoutBlock(exercises: [
            BlockExercise(exerciseID: "curl", sets: [Self.set(12)]),
            BlockExercise(exerciseID: "curl", sets: [Self.set(7)]),
        ])]
        #expect(SessionFlow.previousSets(in: [session])["curl"]?.map(\.log?.reps) == [12])
    }

    @MainActor
    @Test func recordsBeatTheBestOfEveryEarlierSession() throws {
        let catalog = ExerciseCatalog()
        let bench: ExerciseID = "19f5c6f170d8808bb424e98de4472a7e"
        func session(_ reps: [Int], kg: Double) -> [WorkoutBlock] {
            [WorkoutBlock(exercises: [BlockExercise(exerciseID: bench, sets: reps.map { Self.set($0, weightKg: kg) })])]
        }
        let bests = SessionRecords.bests(in: [session([5], kg: 100), session([10], kg: 60)], catalog: catalog.exercise)
        #expect(bests[bench]?[.volume] == 600)
        #expect(bests[bench]?[.reps] == 10)
        let records = SessionRecords.records(in: session([8], kg: 80), bests: bests, catalog: catalog.exercise)
        #expect(records.map(\.kind) == [.volume])
        #expect(records.first?.value == 640)
        #expect(records.first?.previousBest == 600)
    }
}
