import Foundation
import Testing
@testable import App

@MainActor
struct MarkdownPackTests {
    @Test func bundledPackHoldsEveryCatalogExercisesInstructionsAndEveryArticle() {
        let catalog = ExerciseCatalog()
        let withInstructions = catalog.bundled.filter(\.hasInstructions)
        #expect(withInstructions.count == 1_213)
        #expect(withInstructions.allSatisfy { MarkdownPack.bundled.instructions($0.id) != nil })
        #expect(catalog.articles.count == 277)
        #expect(catalog.articles.keys.allSatisfy { MarkdownPack.bundled.article($0)?.isEmpty == false })
    }

    @Test func textsDecodeAtTheirByteRangesAndMissingOrOutOfRangeKeysAreNil() {
        let pack = MarkdownPack(
            data: Data("Squat ✓Bench".utf8),
            ranges: ["Instructions/squat": [0, 9], "Articles/bench": [9, 5], "Articles/broken": [9, 50]]
        )
        #expect(pack.instructions("squat") == "Squat ✓")
        #expect(pack.article("bench") == "Bench")
        #expect(pack.article("broken") == nil)
        #expect(pack.instructions("deadlift") == nil)
    }
}
