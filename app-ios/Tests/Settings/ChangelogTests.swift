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

    @Test func groupsEntriesByDayInBundleOrder() throws {
        let changelog = try JSONDecoder().decode(Changelog.self, from: Data(json.utf8))
        let days = changelog.days(today: CalendarDay("2026-11-12")!)
        #expect(days.map(\.day.description) == ["2026-11-12", "2026-11-11", "2026-10-30"])
        #expect(days.map { $0.entries.map(\.id) } == [["2026-11-12-b", "2026-11-12-a"], ["2026-11-11-c"], ["2026-10-30-d"]])
        #expect(days[0].title == "Today")
        #expect(days[1].title == "Yesterday")
        #expect(days[0].entries[1].description == "Detail.")
        #expect(days[0].entries[0].buildTimeLabel != nil)
        #expect(changelog.entries.allSatisfy { $0.buildTimeLabel != nil })
    }

    @Test func tasksShowTheirTitleOrAFallback() throws {
        let tasks = try JSONDecoder().decode(Changelog.self, from: Data(json.utf8)).entries[0].tasks
        #expect(tasks.map(\.label) == ["Add a changelog", "ProcrastiMate task"])
        #expect(tasks[1].url.absoluteString == "https://procrastimate.stf.lol/inbox?task=d6c161bd-1f76-4dfb-aee8-8ec0e3a5bc85")
    }

    @Test func taskLinksOpenProcrastiMate() {
        #expect(Changelog.taskURL("2ca9f3dd-67c0-4ffc-8670-266407c5df7b").absoluteString
            == "https://procrastimate.stf.lol/inbox?task=2ca9f3dd-67c0-4ffc-8670-266407c5df7b")
    }

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

    @Test func aDevBuildHasNoTime() throws {
        #expect(Changelog.buildTime("dev") == nil)
        let entry = try JSONDecoder().decode(Changelog.Entry.self, from: Data(#"{"id":"x","date":"2026-11-12","title":"X","tasks":[],"build":"dev"}"#.utf8))
        #expect(entry.buildTimeLabel == nil)
    }

    @Test func aBuildFromALaterDayNamesItsDate() throws {
        let entry = try JSONDecoder().decode(Changelog.Entry.self, from: Data(#"{"id":"x","date":"2026-11-01","title":"X","tasks":[],"build":"2026.1112.212004"}"#.utf8))
        let made = try #require(Changelog.buildTime(entry.build))
        #expect(entry.buildTimeLabel == made.formatted(.dateTime.month(.abbreviated).day().hour().minute()))
    }
}
