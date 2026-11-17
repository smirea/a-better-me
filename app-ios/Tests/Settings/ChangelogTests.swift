import Foundation
import Testing
@testable import App

struct ChangelogTests {
    /// The shape `scripts/changelog.ts bundle` writes, newest first.
    private let json = #"""
    {"build":"2026.1112.183941","entries":[
      {"id":"2026-11-12-b","date":"2026-11-12","title":"B","tasks":[{"id":"2ca9f3dd-67c0-4ffc-8670-266407c5df7b","title":"Add a changelog"},{"id":"d6c161bd-1f76-4dfb-aee8-8ec0e3a5bc85"}],"build":"2026.1112.183941"},
      {"id":"2026-11-12-a","date":"2026-11-12","title":"A","description":"Detail.","tasks":[],"build":"2026.1112.170758"},
      {"id":"2026-11-11-c","date":"2026-11-11","title":"C","tasks":[],"build":"2026.1111.184217"},
      {"id":"2026-10-30-d","date":"2026-10-30","title":"D","tasks":[],"build":"2026.1030.90000"}
    ]}
    """#

    @Test func buildTimeReadsTheUTCArchiveTime() throws {
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = .gmt
        let made = try #require(Changelog.buildTime("2026.1112.212004"))
        #expect(utc.dateComponents([.year, .month, .day, .hour, .minute, .second], from: made)
            == DateComponents(year: 2026, month: 11, day: 12, hour: 21, minute: 20, second: 4))

        let unpadded = try #require(Changelog.buildTime("2026.105.426"))
        #expect(utc.dateComponents([.month, .day, .hour, .minute, .second], from: unpadded)
            == DateComponents(month: 1, day: 5, hour: 0, minute: 4, second: 26))
    }
}
