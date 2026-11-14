import Foundation
import Testing
@testable import App

/// The meal sections: which section a time falls in, where food added to one lands, the editor's rules, and the
/// Sections display's grouping.
struct MealSectionTests {
    let sections = MealSection.defaults
    let monday = calendarDay("2026-10-26")

    func entry(minute: Int, section: String? = nil, loggedAt seconds: TimeInterval = 0) -> FoodEntry {
        FoodEntry(FoodPortion(yogurt), day: monday, minute: minute, section: section, at: Date(timeIntervalSince1970: 1_800_000_000 + seconds))
    }

    @Test func aMinuteFallsInTheLastSectionStartedByThen() {
        #expect([0, 599, 600, 719, 720, 1019, 1020, 1439].map { sections.section(at: $0).id } == [
            "breakfast", "breakfast", "am-snack", "am-snack", "lunch", "pm-snack", "dinner", "dinner",
        ])
        #expect(sections.range(of: sections[0]) == 0..<600)
        #expect(sections.range(of: sections[4]) == 1020..<1440)
    }

    @Test func aStoredSectionWinsOverTheMinuteWhileItExists() {
        #expect(sections.section(of: "lunch", minute: 11 * 60 + 50).id == "lunch")
        #expect(sections.section(of: nil, minute: 11 * 60 + 50).id == "am-snack")
        #expect(sections.section(of: "brunch", minute: 11 * 60 + 50).id == "am-snack")
    }

    @Test func foodAddedToASectionLandsNowWhenTheClockIsInsideItElseAtItsTypicalTime() {
        #expect(sections.map { sections.typicalMinute(of: $0) } == [480, 660, 810, 960, 1140])
        let noon = monday.date(atMinute: 12 * 60 + 40, in: utc)
        #expect(sections.logMinute(for: sections[2], on: monday, now: noon, calendar: utc) == 12 * 60 + 40)
        #expect(sections.logMinute(for: sections[0], on: monday, now: noon, calendar: utc) == 480)
        #expect(sections.logMinute(for: sections[2], on: monday.adding(days: -1), now: noon, calendar: utc) == 810)
        let one = [MealSection(id: "all", name: "All Day", start: 0)]
        #expect(one.typicalMinute(of: one[0]) == 720)
    }

    @Test func movingABoundaryStaysBetweenItsNeighbors() {
        #expect(MealSectionsEditing.settingStart(11 * 60, of: 2, in: sections)[2].start == 11 * 60)
        #expect(MealSectionsEditing.settingStart(8 * 60, of: 2, in: sections)[2].start == 601)
        #expect(MealSectionsEditing.settingStart(23 * 60, of: 4, in: sections)[4].start == 23 * 60)
        #expect(MealSectionsEditing.settingStart(5, of: 0, in: sections) == sections)
        #expect(MealSectionsEditing.startBounds(of: 4, in: sections) == 901...1439)
    }

    @Test func editingKeepsTheSectionsTilingTheDay() {
        let renamed = MealSectionsEditing.renaming(2, to: "  Midday ", in: sections)
        #expect(renamed[2] == MealSection(id: "lunch", name: "Midday", start: 720))
        #expect(MealSectionsEditing.renaming(2, to: " ", in: sections) == sections)

        let added = try! #require(MealSectionsEditing.adding("Late Snack", id: "late", to: sections))
        #expect(added.last == MealSection(id: "late", name: "Late Snack", start: 1230))
        #expect(MealSectionsEditing.newName(in: sections) == "Section 6")
        #expect(MealSectionsEditing.adding("X", to: [MealSection(id: "a", name: "A", start: 0), MealSection(id: "b", name: "B", start: 1439)]) == nil)

        let withoutBreakfast = MealSectionsEditing.removing(0, from: sections)
        #expect(withoutBreakfast.map(\.id) == ["am-snack", "lunch", "pm-snack", "dinner"])
        #expect(withoutBreakfast[0].start == 0)
        #expect(MealSectionsEditing.removing(2, from: sections).map(\.start) == [0, 600, 900, 1020])
        #expect(MealSectionsEditing.removing(0, from: [sections[0]]) == [sections[0]])

        let moved = MealSectionsEditing.moving(2, by: -1, in: sections)
        #expect(moved.map(\.id) == ["breakfast", "lunch", "am-snack", "pm-snack", "dinner"])
        #expect(moved.map(\.start) == sections.map(\.start))
        #expect(MealSectionsEditing.moving(0, by: -1, in: sections) == sections)
    }

    @Test func theSectionsDisplayGroupsEntriesByTheSectionTheyWereLoggedInto() {
        let toast = entry(minute: 8 * 60, section: "breakfast")
        let early = entry(minute: 11 * 60 + 50, section: "lunch", loggedAt: 2)
        let salad = entry(minute: 13 * 60, loggedAt: 1)
        let old = entry(minute: 10 * 60 + 15)
        let gone = entry(minute: 19 * 60, section: "brunch")
        let groups = FoodLog.sections([gone, salad, old, early, toast], sections: sections, hideEmpty: false)

        #expect(groups.map(\.slot) == sections.map { .section($0) })
        #expect(groups.map { $0.rows.map(\.entry.id) } == [[toast.id], [old.id], [early.id, salad.id], [], [gone.id]])
        #expect(groups[2].slot.label == "Lunch")
        #expect(FoodLog.sections([toast], sections: sections, hideEmpty: true).map(\.slot) == [.section(sections[0])])

        var settings = NutritionSettings()
        #expect(FoodLog.groups([toast], settings: settings).first?.slot == .hour(8))
        settings.timeline.display = .sections
        #expect(FoodLog.groups([toast], settings: settings).count == 5)
    }

    /// At 12:12 the AM Snack and Lunch pills both wore the ring. Exactly one pill does, at every minute and right at
    /// each boundary, and it is the one the tab bar's + logs into.
    @Test func exactlyOnePillWearsTheRingAndItIsWhereTheDefaultAddLogs() {
        let groups = FoodLog.sections([], sections: sections, hideEmpty: false)
        for minute in [0, 9 * 60 + 59, 10 * 60, 11 * 60 + 59, 12 * 60, 12 * 60 + 12, 12 * 60 + 15, 14 * 60 + 59, 15 * 60, 17 * 60, 23 * 60 + 59] {
            let now = monday.date(atMinute: minute, in: utc)
            let current = FoodLog.currentSlot(on: monday, sections: sections, showsSections: true, now: now, calendar: utc)
            #expect(groups.filter { $0.slot == current }.count == 1, "\(minute)")
            #expect(LoggerStart(LogFoodRequest(day: monday), now: now, calendar: utc).time == nil)
            let logged = LogTime.now(now, calendar: utc).section(in: sections, at: now, calendar: utc)
            #expect(current == .section(logged), "\(minute)")
        }

        let noonish = monday.date(atMinute: 12 * 60 + 12, in: utc)
        #expect(FoodLog.currentSlot(on: monday, sections: sections, showsSections: true, now: noonish, calendar: utc) == .section(sections[2]))
        #expect(FoodLog.currentSlot(on: monday, sections: sections, showsSections: false, now: noonish, calendar: utc) == .hour(12))
        let elevenFiftyNine = monday.date(atMinute: 11 * 60 + 59, in: utc)
        #expect(FoodLog.currentSlot(on: monday, sections: sections, showsSections: true, now: elevenFiftyNine, calendar: utc) == .section(sections[1]))
        #expect(FoodLog.currentSlot(on: calendarDay("2026-10-27"), sections: sections, showsSections: true, now: noonish, calendar: utc) == nil)
    }

    @Test func aCopyOrMoveKeepsTakesOrPicksItsSection() {
        let now = monday.date(atMinute: 18 * 60 + 5, in: utc)
        let early = entry(minute: 11 * 60 + 50, section: "lunch")
        let old = entry(minute: 11 * 60 + 50)

        let tomorrow = FoodLog.relocations([early, old], to: .tomorrow, now: now, calendar: utc)
        #expect(tomorrow.flatMap { relocation in [early, old].map { relocation.section(for: $0, in: sections) } } == ["lunch", "am-snack"])
        let atNine = FoodLog.relocations([early], to: .dateTime(monday, minute: 9 * 60), now: now, calendar: utc)
        #expect(atNine.map { $0.section(for: early, in: sections) } == ["breakfast"])
        let toLunch = FoodLog.relocations([old], to: .section(monday, sections[2], minute: 810), now: now, calendar: utc)
        #expect(toLunch == [Relocation(ids: [old.id], day: monday, minute: 810, section: .chosen("lunch"))])
        #expect(FoodLog.confirmation(.move, count: 2, to: .section(monday, sections[2], minute: 810), now: now, calendar: utc) == "Moved 2 foods to Lunch, Today")
    }
}
