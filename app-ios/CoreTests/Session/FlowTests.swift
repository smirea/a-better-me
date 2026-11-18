import Foundation
import Testing
@testable import Core

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
