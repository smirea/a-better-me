import Foundation
import Testing
@testable import App

@MainActor
struct MarkdownPackTests {
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
