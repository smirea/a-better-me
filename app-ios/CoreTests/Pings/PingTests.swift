import Foundation
import Testing
@testable import Core

struct PingTests {
    private let water = Ping(name: "Water", icon: "drop", kind: .boolean)
    private let mood = Ping(name: "Mood", icon: "face.smiling", kind: .range(["", "", "", "", ""]))

    @Test func aBooleanPingsDayShadesByItsCountAgainstTheBusiestOfThirtyDays() {
        let logs = [day("2026-11-19", 9), day("2026-11-19", 23), day("2026-11-18", 0), day("2026-10-20", 12)].map { PingLog(pingID: water.id, at: $0) }
        let card = PingCard.cards([water], logs: logs, now: day("2026-11-19", 23), calendar: utc)[0]
        #expect(card.chart == .days(Array(repeating: 0, count: 28) + [0.5, 1]))
        #expect(card.value == 2)
    }

    @Test func aRangePingsDayIsTheAverageOfItsLogsAndItsWeekTheAverageOfEveryLog() {
        let logs = [(day("2026-11-19", 9), 2), (day("2026-11-19", 20), 5), (day("2026-11-17", 9), 2)].map {
            PingLog(pingID: mood.id, value: $0.1, at: $0.0)
        }
        let card = PingCard.cards([mood], logs: logs, now: day("2026-11-19", 21), calendar: utc)[0]
        #expect(card.chart == .week([0, 0, 0, 0, 2, 0, 3.5], steps: 5))
        #expect(card.value == 3)
    }

    @Test func pickingAValueAgainTakesItBackAndANoteWithoutAPickStaysUnlogged() {
        var selection = PingSelection()
        selection.toggle(mood.id, value: 4)
        selection.toggle(mood.id, value: 2)
        selection.toggle(water.id)
        selection.toggle(water.id)
        selection.notes = [mood.id: " tired ", water.id: "not logged"]
        let logs = selection.logs(at: day("2026-11-19"))
        #expect(logs.map(\.pingID) == [mood.id])
        #expect(logs.first?.value == 2)
        #expect(logs.first?.note == "tired")
        #expect(selection.afterLogging.notes == [water.id: "not logged"])
        #expect(selection.afterLogging.isEmpty)
    }

    @Test func aPingLoggedOnAnotherDayLandsOnThatDayAtTheClocksTimeAndOnTodayAtNow() {
        let now = day("2026-11-19", 9).addingTimeInterval(25 * 60 + 20.5)
        #expect(PingLog.instant(on: CalendarDay("2026-11-17")!, now: now, calendar: utc) == day("2026-11-17", 9).addingTimeInterval(25 * 60 + 20.5))
        #expect(PingLog.instant(on: CalendarDay("2026-11-19")!, now: now, calendar: utc) == now)
    }
}
