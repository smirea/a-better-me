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

    @Test func aNewPingStartsOnTheFirstSwatchNoPingDrawsInAndAColorlessPingDrawsInTheFallback() {
        let colorless = Ping(name: "Old", icon: "circle", kind: .boolean)
        let red = Ping(name: "Red", icon: "circle", color: .red, kind: .boolean)
        #expect(PingColor.unused(by: []) == .red)
        #expect(PingColor.unused(by: [red]) == .orange)
        let allButTeal = PingColor.allCases.filter { $0 != .teal }.map { Ping(name: $0.rawValue, icon: "circle", color: $0, kind: .boolean) }
        #expect(PingColor.unused(by: allButTeal) == .teal)
        #expect(PingColor.unused(by: allButTeal + [colorless, red]) == .orange)
    }

    @Test func theSamePingAtTheSameValueLoggedAgainWithNothingBetweenIsOneRowAtTheFirstsTime() {
        let logs = [entry(water, 9), entry(water, 11), entry(mood, 12, value: 3), entry(mood, 13, value: 3), entry(mood, 14, value: 4)]
        let rows = PingTimeline(entries: logs).rows()
        #expect(rows.map(\.at) == [at(9), at(12), at(14)])
        #expect(rows.map { $0.entries.count } == [2, 2, 1])
        guard case let .group(group) = rows[0] else { Issue.record("Not a group"); return }
        #expect(group.items.map(\.count) == [2])
    }

    @Test func booleanPingsWithinTenMinutesOfTheFirstShareARowUnlessAMarkerOrANoteComesBetween() {
        let coffee = Ping(name: "Coffee", icon: "cup.and.saucer", kind: .boolean)
        let bathroom = Ping(name: "Bathroom", icon: "toilet", kind: .boolean)
        var noted = entry(coffee, 15)
        noted.log.note = "decaf"
        let entries = [entry(water, 9), entry(coffee, 9 + 5 / 60), entry(water, 9 + 9 / 60), entry(bathroom, 9 + 11 / 60),
                       entry(water, 14), entry(coffee, 14 + 2 / 60), noted, entry(water, 15 + 1 / 60)]
        let marker = TimelineMarker(id: "meal/lunch", kind: .meal, at: at(14 + 1 / 60), title: "Lunch")
        let rows = PingTimeline(entries: entries, markers: [marker]).rows()
        guard case let .group(group) = rows[0] else { Issue.record("Not a group"); return }
        #expect(group.items.map(\.ping.id) == [water.id, coffee.id])
        #expect(group.items.map(\.count) == [2, 1])
        #expect(rows.map(\.at) == [at(9), at(9 + 11 / 60), at(14), at(14 + 1 / 60), at(14 + 2 / 60), at(15), at(15 + 1 / 60)])
    }

    private func at(_ hour: Double) -> Date { day("2026-11-19", 0).addingTimeInterval(hour * 3600) }

    private func entry(_ ping: Ping, _ hour: Double, value: Int = 1) -> PingEntry {
        PingEntry(log: PingLog(pingID: ping.id, value: value, at: at(hour)), ping: ping)
    }
}
