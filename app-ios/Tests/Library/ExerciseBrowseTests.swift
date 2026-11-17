import Foundation
import Testing
import UIKit
@testable import App

private func exercise(_ id: String, _ name: String, boost: Int = 0, category: ExerciseCategory = .freeWeights, muscle: Muscle = .chest) -> Exercise {
    Exercise(id: id, name: name, type: .compound, primaryMuscles: [muscle], metrics: [.weight, .reps], category: category, searchBoost: boost)
}

@MainActor
struct ExerciseCatalogOrderTests {
    @Test func catalogListsEveryExerciseInRankedOrder() {
        let catalog = ExerciseCatalog()
        let ranked = Exercise.ranked(catalog.bundled)
        #expect(catalog.all.count == ranked.count)
        #expect(catalog.all.map(\.id) == ranked.map(\.id))
    }

    @Test func customExercisesMergeIntoTheRankedOrder() {
        let catalog = ExerciseCatalog()
        let custom = [exercise("custom-b", "Zzz Last Lift"), exercise("custom-a", "Aaa First Lift", boost: 1000)]
        catalog.setCustom(custom)
        #expect(catalog.all.first?.id == "custom-a")
        #expect(catalog.all.map(\.id) == Exercise.ranked(custom + catalog.bundled).map(\.id))
        #expect(catalog.revision == 1)
        catalog.setCustom(custom)
        #expect(catalog.revision == 1)
        catalog.setCustom([])
        #expect(catalog.all.count == catalog.bundled.count)
        #expect(catalog.revision == 2)
    }
}

struct ExerciseRankingTests {
    let bench = exercise("bench", "Bench Press", boost: 10)
    let curl = exercise("curl", "biceps Curl", category: .machines, muscle: .biceps)
    let apple = exercise("apple", "Apple Press")
    let dip = exercise("dip", "Dip", boost: 10, muscle: .triceps)

    @Test func rankedPutsBoostFirstThenNamesIgnoringCase() {
        #expect(Exercise.ranked([curl, apple, dip, bench]).map(\.id) == ["bench", "dip", "apple", "curl"])
    }

    @Test func mergeInterleavesTwoRankedLists() {
        #expect(Exercise.mergeRanked([dip, curl], [bench, apple]).map(\.id) == ["bench", "dip", "apple", "curl"])
        #expect(Exercise.mergeRanked([], [bench]).map(\.id) == ["bench"])
    }

    @Test func browseScopesFiltersSearchesAndGroupsInRankedOrder() {
        let ranked = [bench, dip, apple, curl]
        let all = ExerciseGroup.browse(ranked, scope: .except(["dip"]), filter: ExerciseFilter(), search: ExerciseSearch("press"), availability: nil)
        #expect(all.scoped.map(\.id) == ["bench", "apple", "curl"])
        #expect(all.groups.map(\.category) == [.freeWeights])
        #expect(all.groups.map { $0.exercises.map(\.id) } == [["bench", "apple"]])

        var biceps = ExerciseFilter()
        biceps.muscle = .biceps
        let only = ExerciseGroup.browse(ranked, scope: .only(["curl", "dip"]), filter: biceps, search: ExerciseSearch(""), availability: nil)
        #expect(only.scoped.map(\.id) == ["dip", "curl"])
        #expect(only.groups.map { $0.exercises.map(\.id) } == [["curl"]])
    }
}

struct PerformedCountsTests {
    @Test func countsSessionsWithACompletedSetOncePerSession() {
        var done = WorkoutSet()
        done.log = SetLog(weightKg: 50, reps: 5, completedAt: .now)
        let first = WorkoutSession(name: "A", blocks: [
            WorkoutBlock(exercises: [BlockExercise(exerciseID: "bench", sets: [done, done])]),
            WorkoutBlock(exercises: [BlockExercise(exerciseID: "bench", sets: [done]), BlockExercise(exerciseID: "curl", sets: [WorkoutSet()])]),
        ])
        let second = WorkoutSession(name: "B", blocks: [WorkoutBlock(exercises: [BlockExercise(exerciseID: "bench", sets: [done])])])
        #expect(ExerciseLibrary.performedCounts([first, second]) == ["bench": 2])
    }
}
