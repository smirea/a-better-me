import Foundation
@testable import App
import Testing

@MainActor
struct SessionHistoryMemoTests {
    @Test func optionalValueIsComputedOnAMissAndCachedAfter() throws {
        let store = try LocalStore(unsyncedAt: FileManager.default.temporaryDirectory.appending(path: "memo-\(UUID().uuidString)/a.sqlite"))
        let history = SessionHistory(store: store)
        var calls = 0
        let compute: ([WorkoutSession]) -> Int? = { _ in
            calls += 1
            return 42
        }

        #expect(history.memo("answer", compute) == 42)
        #expect(history.memo("answer", compute) == 42)
        #expect(calls == 1)
    }

    @Test func cachedNilIsAHit() throws {
        let store = try LocalStore(unsyncedAt: FileManager.default.temporaryDirectory.appending(path: "memo-\(UUID().uuidString)/a.sqlite"))
        let history = SessionHistory(store: store)
        var calls = 0
        let compute: ([WorkoutSession]) -> Int? = { _ in
            calls += 1
            return nil
        }

        #expect(history.memo("nothing", compute) == nil)
        #expect(history.memo("nothing", compute) == nil)
        #expect(calls == 1)
    }
}
