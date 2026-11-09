import Foundation

/// MacroFactor's "8 AM Picks": the foods the owner logs most often within an hour, above Latest in the logger. The
/// Sections display asks the same of a meal section ("Breakfast Picks").
enum HourPicks {
    /// One logged food, as the picks read the log.
    struct Entry: Sendable {
        let portion: FoodPortion
        let day: CalendarDay
        let minute: Int
        /// The meal section it was logged into, nil before sections existed.
        var section: String?
        /// Orders entries logged in the same minute: the later write, then the id.
        let written: String
    }

    static let days = 30
    static let limit = 3

    private struct Tally {
        var days: Set<CalendarDay> = []
        var latest: Entry
    }

    /// Per slot (an hour, or a section id), the foods logged on the most days within that slot over the `days` up to
    /// `today`, each at its latest serving there; ties go to the food logged there most recently. Future days (copies
    /// ahead of time) don't count, and neither do the foods `hidden` from that slot, so the next one takes their place.
    static func picks<Slot: Hashable>(
        _ entries: [Entry], today: CalendarDay, by slot: (Entry) -> Slot, hidden: [Slot: Set<String>] = [:]
    ) -> [Slot: [FoodPortion]] {
        let first = today.adding(days: -(days - 1))
        var tallies: [Slot: [String: Tally]] = [:]
        for entry in entries where entry.day >= first && entry.day <= today {
            let key = FoodSearchResult.key(entry.portion.food)
            let slot = slot(entry)
            if hidden[slot]?.contains(key) == true { continue }
            var tally = tallies[slot, default: [:]][key] ?? Tally(latest: entry)
            tally.days.insert(entry.day)
            if (entry.day, entry.minute, entry.written) > (tally.latest.day, tally.latest.minute, tally.latest.written) { tally.latest = entry }
            tallies[slot, default: [:]][key] = tally
        }
        return tallies.mapValues { foods in
            foods.values
                .sorted { a, b in
                    let lhs = (a.days.count, a.latest.day, a.latest.minute), rhs = (b.days.count, b.latest.day, b.latest.minute)
                    return lhs != rhs ? lhs > rhs : a.latest.portion.food.name < b.latest.portion.food.name
                }
                .prefix(limit)
                .map(\.latest.portion)
        }
    }
}
