import Foundation
import Testing
@testable import App

/// The row commands' one meaning, which the editor, the phone's stored sessions, and the watch all apply.
struct RowCommandTests {
    private static let at = Date(timeIntervalSince1970: 1_000_000)
    private static func id(_ n: Int) -> UUID { UUID(uuidString: String(format: "00000000-0000-0000-0000-%012d", n))! }
    private static let first = RowPath(block: 0, exercise: 0, set: 0)

    private static func blocks() -> [WorkoutBlock] {
        [WorkoutBlock(id: id(1), exercises: [BlockExercise(id: id(2), exerciseID: "bench", sets: [WorkoutSet(id: id(21)), WorkoutSet(id: id(22))])])]
    }

    @Test func aLogLandsOnlyOnAnOpenRow() {
        var blocks = Self.blocks()
        let values = LiveValues(weightKg: 100, reps: 5)
        #expect(blocks.apply(.log(rowID: Self.id(21), values: values), at: Self.at) == .logged(Self.first))
        #expect(blocks.log(at: Self.first) == SetLog(weightKg: 100, reps: 5, completedAt: Self.at))

        let logged = blocks
        #expect(blocks.apply(.log(rowID: Self.id(21), values: LiveValues(weightKg: 110, reps: 3)), at: Self.at) == .none)
        #expect(blocks == logged)
    }

    @Test func unlogClearsTheLogElseTheSkip() {
        var blocks = Self.blocks()
        _ = blocks.apply(.log(rowID: Self.id(21), values: LiveValues(reps: 5)), at: Self.at)
        #expect(blocks.apply(.unlog(rowID: Self.id(21)), at: Self.at) == .unlogged(Self.first, SetLog(reps: 5, completedAt: Self.at)))
        #expect(blocks == Self.blocks())

        _ = blocks.apply(.skip(rowID: Self.id(21)), at: Self.at)
        #expect(blocks.isSkipped(at: Self.first))
        #expect(blocks.apply(.unlog(rowID: Self.id(21)), at: Self.at) == .none)
        #expect(blocks == Self.blocks())
    }

    @Test func aSkipLandsOnlyOnARowNeitherLoggedNorSkipped() {
        var blocks = Self.blocks()
        #expect(blocks.apply(.skip(rowID: Self.id(21)), at: Self.at) == .skipped(Self.first))
        #expect(blocks.apply(.skip(rowID: Self.id(21)), at: Self.at) == .none)

        _ = blocks.apply(.log(rowID: Self.id(22), values: LiveValues(reps: 5)), at: Self.at)
        #expect(blocks.apply(.skip(rowID: Self.id(22)), at: Self.at) == .none)
        #expect(!blocks.isSkipped(at: RowPath(block: 0, exercise: 0, set: 1)))
    }

    @Test func aSetIsAddedOnceAndAGoneRowChangesNothing() {
        var blocks = Self.blocks()
        #expect(blocks.apply(.addSet(exerciseID: Self.id(2), setID: Self.id(23)), at: Self.at) == .added)
        #expect(blocks.apply(.addSet(exerciseID: Self.id(2), setID: Self.id(23)), at: Self.at) == .none)
        #expect(blocks[0].exercises[0].sets.map(\.id) == [Self.id(21), Self.id(22), Self.id(23)])

        let before = blocks
        #expect(blocks.apply(.log(rowID: Self.id(99), values: LiveValues(reps: 1)), at: Self.at) == .none)
        #expect(blocks.apply(.addSet(exerciseID: Self.id(99), setID: Self.id(24)), at: Self.at) == .none)
        #expect(blocks == before)
    }
}
