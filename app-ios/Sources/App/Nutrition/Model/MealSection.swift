import Foundation
import GRDB

/// One of the owner's meal sections: Breakfast, AM Snack, Lunch, PM Snack, and Dinner by default. Sections tile the
/// day in order, each from its `start` to the next one's, so every minute falls in exactly one.
struct MealSection: Codable, Hashable, Identifiable, Sendable {
    /// Stable across renames, so an entry logged into "Lunch" stays there when the owner calls it "Midday".
    var id: String
    var name: String
    /// Minutes since midnight. The first section starts at 0 and the rest strictly increase.
    var start: Int

    static let defaults = [
        MealSection(id: "breakfast", name: "Breakfast", start: 0),
        MealSection(id: "am-snack", name: "AM Snack", start: 10 * 60),
        MealSection(id: "lunch", name: "Lunch", start: 12 * 60),
        MealSection(id: "pm-snack", name: "PM Snack", start: 15 * 60),
        MealSection(id: "dinner", name: "Dinner", start: 17 * 60),
    ]
}

extension [MealSection] {
    /// The section `minute` falls in.
    func section(at minute: Int) -> MealSection {
        last { $0.start <= minute } ?? self[0]
    }

    /// Where an entry shows: the section it was logged into while that section exists, else the one its minute falls
    /// in. Entries logged before sections existed have none.
    func section(of id: String?, minute: Int) -> MealSection {
        if let id, let stored = first(where: { $0.id == id }) { return stored }
        return section(at: minute)
    }

    func section(of entry: FoodEntry) -> MealSection {
        section(of: entry.section, minute: entry.minute)
    }

    /// The minutes a section covers: from its start to the next section's, the last one to midnight.
    func range(of section: MealSection) -> Range<Int> {
        guard let index = firstIndex(where: { $0.id == section.id }) else { return section.start..<section.start + 1 }
        return self[index].start..<(index + 1 < count ? self[index + 1].start : 24 * 60)
    }

    /// When food added to a section without a time lands: the middle of a section between two others, two hours before
    /// the first one ends (8 AM for a Breakfast that ends at 10), and two hours into the last (7 PM for a Dinner from 5).
    /// The open-ended sections reach midnight, so their middles would be the middle of the night.
    func typicalMinute(of section: MealSection) -> Int {
        let range = range(of: section)
        if section.id == first?.id, count > 1 { return Swift.max(range.lowerBound, range.upperBound - 120) }
        if section.id == last?.id, count > 1 { return Swift.min(range.upperBound - 1, range.lowerBound + 120) }
        return (range.lowerBound + range.upperBound) / 2
    }

    /// The minute a section's + logs at on `day`: now when today's clock is inside it, else its typical minute.
    func logMinute(for section: MealSection, on day: CalendarDay, now: Date, calendar: Calendar = .current) -> Int {
        let minute = now.minuteOfDay(in: calendar)
        if day == CalendarDay(now, in: calendar), range(of: section).contains(minute) { return minute }
        return typicalMinute(of: section)
    }
}

/// The sections editor's rules (Settings > Food Log). Every edit keeps the sections tiling the day: the first starts at
/// midnight and each start is later than the one before.
enum MealSectionsEditing {
    /// Sets where section `index` starts, kept a minute after the previous start and a minute before the next.
    static func settingStart(_ minute: Int, of index: Int, in sections: [MealSection]) -> [MealSection] {
        guard sections.indices.contains(index), index > 0 else { return sections }
        var sections = sections
        let low = sections[index - 1].start + 1
        let high = index + 1 < sections.count ? sections[index + 1].start - 1 : 24 * 60 - 1
        sections[index].start = Swift.min(high, Swift.max(low, minute))
        return sections
    }

    /// The minutes section `index` may start at.
    static func startBounds(of index: Int, in sections: [MealSection]) -> ClosedRange<Int> {
        guard index > 0, sections.indices.contains(index) else { return 0...0 }
        let high = index + 1 < sections.count ? sections[index + 1].start - 1 : 24 * 60 - 1
        return (sections[index - 1].start + 1)...high
    }

    static func renaming(_ index: Int, to name: String, in sections: [MealSection]) -> [MealSection] {
        let name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard sections.indices.contains(index), !name.isEmpty else { return sections }
        var sections = sections
        sections[index].name = name
        return sections
    }

    /// A new section after the last, starting halfway through the last one's time. Nil when the last section is a
    /// single minute and can't be split.
    static func adding(_ name: String, id: String = UUID().uuidString.lowercased(), to sections: [MealSection]) -> [MealSection]? {
        let last = sections.last!
        let start = (last.start + 24 * 60) / 2
        guard start > last.start else { return nil }
        return sections + [MealSection(id: id, name: name, start: start)]
    }

    /// Removes a section; the one before takes over its time, or for the first, the next one starts at midnight.
    /// The last section stays.
    static func removing(_ index: Int, from sections: [MealSection]) -> [MealSection] {
        guard sections.count > 1, sections.indices.contains(index) else { return sections }
        var sections = sections
        sections.remove(at: index)
        sections[0].start = 0
        return sections
    }

    /// Swaps a section's name and identity with its neighbor's; the times stay where they are, since they describe the
    /// day, not the meal.
    static func moving(_ index: Int, by offset: Int, in sections: [MealSection]) -> [MealSection] {
        let other = index + offset
        guard sections.indices.contains(index), sections.indices.contains(other) else { return sections }
        var sections = sections
        let moved = sections[index]
        sections[index].id = sections[other].id
        sections[index].name = sections[other].name
        sections[other].id = moved.id
        sections[other].name = moved.name
        return sections
    }

    /// "Section 6", the first such name not taken.
    static func newName(in sections: [MealSection]) -> String {
        let names = Set(sections.map(\.name))
        return ((sections.count + 1)...).lazy.map { "Section \($0)" }.first { !names.contains($0) }!
    }
}

extension MealSection {
    /// The owner's sections as a write finds them.
    static func current(_ db: Database) throws -> [MealSection] {
        try AppSettings.fetchOne(db, key: AppSettings.key(AppSettings.rowID))?.nutrition.mealSections ?? defaults
    }
}
