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
        let ranked = ExerciseGroup.ranked(catalog.bundled)
        #expect(catalog.all.count == ranked.count)
        #expect(catalog.all.map(\.id) == ranked.map(\.id))
    }

    @Test func customExercisesMergeIntoTheRankedOrder() {
        let catalog = ExerciseCatalog()
        let custom = [exercise("custom-b", "Zzz Last Lift"), exercise("custom-a", "Aaa First Lift", boost: 1000)]
        catalog.setCustom(custom)
        #expect(catalog.all.first?.id == "custom-a")
        #expect(catalog.all.map(\.id) == ExerciseGroup.ranked(custom + catalog.bundled).map(\.id))
        #expect(catalog.revision == 1)
        catalog.setCustom(custom)
        #expect(catalog.revision == 1)
        catalog.setCustom([])
        #expect(catalog.all.count == catalog.bundled.count)
        #expect(catalog.revision == 2)
    }

    /// Run with `-only-testing:AppTests/ExerciseCatalogOrderTests` to read the launch cost in the log.
    @Test func catalogLoadTime() {
        let start = ContinuousClock.now
        _ = ExerciseCatalog()
        print("ExerciseCatalog.init took \(ContinuousClock.now - start)")
    }
}

struct ExerciseRankingTests {
    let bench = exercise("bench", "Bench Press", boost: 10)
    let curl = exercise("curl", "biceps Curl", category: .machines, muscle: .biceps)
    let apple = exercise("apple", "Apple Press")
    let dip = exercise("dip", "Dip", boost: 10, muscle: .triceps)

    @Test func rankedPutsBoostFirstThenNamesIgnoringCase() {
        #expect(ExerciseGroup.ranked([curl, apple, dip, bench]).map(\.id) == ["bench", "dip", "apple", "curl"])
    }

    @Test func rankingNameSortedListsMatchesAFullSort() {
        let nameSorted = [apple, bench, curl, dip]
        #expect(ExerciseGroup.ranked(nameSorted: nameSorted).map(\.id) == ["bench", "dip", "apple", "curl"])
    }

    @Test func mergeInterleavesTwoRankedLists() {
        #expect(ExerciseGroup.merge([dip, curl], [bench, apple]).map(\.id) == ["bench", "dip", "apple", "curl"])
        #expect(ExerciseGroup.merge([], [bench]).map(\.id) == ["bench"])
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

struct DownsamplingTests {
    @Test func fillCoversTheFrameAndFitStaysInsideIt() {
        // A 360x640 frame in a 22 pt tile at 3x (66x99 px): filling needs width 66, so height 118.
        #expect(ImageRequest.maxPixelSize(sourceWidth: 360, sourceHeight: 640, width: 66, height: 99, fills: true) == 118)
        #expect(ImageRequest.maxPixelSize(sourceWidth: 360, sourceHeight: 640, width: 66, height: 99, fills: false) == 99)
        #expect(ImageRequest.maxPixelSize(sourceWidth: 360, sourceHeight: 640, width: 1200, height: 1260, fills: true) == 640)
    }

    @Test func decodesAFileAtTheDrawnSize() async throws {
        let url = URL.temporaryDirectory.appending(path: "downsample-\(UUID()).png")
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let png = UIGraphicsImageRenderer(size: CGSize(width: 360, height: 640), format: format).pngData { context in
            UIColor.red.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 360, height: 640))
        }
        try png.write(to: url)
        defer { try? FileManager.default.removeItem(at: url) }
        let request = try #require(ImageRequest(path: "test", url: url, size: CGSize(width: 22, height: 33), scale: 3, contentMode: .fill))
        let image = try #require(await DownsampledImages.decode(request))
        #expect(image.cgImage?.height == 118)
        #expect((image.cgImage?.width ?? 0) >= 66)
    }

    @Test func noRequestBeforeTheViewIsMeasured() {
        #expect(ImageRequest(path: "a", url: URL(filePath: "/a"), size: .zero, scale: 3, contentMode: .fill) == nil)
    }
}

struct InstructionSourceTests {
    @Test func readsAndSplitsTheInstructionsAndArticles() async {
        let instructions = "Lie down.\n## Exercise technique\nPress up."
        let pack = MarkdownPack(
            data: Data((instructions + "Breathe.").utf8),
            ranges: ["Instructions/bench": [0, instructions.utf8.count], "Articles/bracing": [instructions.utf8.count, 8]]
        )
        let source = InstructionSource(about: nil, instructions: "bench", articles: [
            Article(id: "bracing", title: "Bracing"),
            Article(id: "missing", title: "Not in the pack"),
        ])
        let content = await source.load(from: pack)
        #expect(content.sections.map(\.title) == ["Description", "Exercise technique"])
        #expect(content.sections.map(\.body) == ["Lie down.", "Press up."])
        #expect(content.articles.map(\.title) == ["Bracing"])
        #expect(content.articles.map(\.body) == ["Breathe."])
    }

    @Test func aCustomDescriptionReplacesTheInstructions() async {
        let content = await InstructionSource(about: "## Setting up\nStand.", instructions: nil, articles: []).load()
        #expect(content.sections.map(\.title) == ["Setting up"])
    }
}
