import Foundation

/// MacroFactor's "8 AM Picks": the foods the owner logs most often within an hour, above Latest when the logger opens
/// for that hour.
enum HourPicks {
    /// One logged food, as the picks read the log.
    struct Entry: Sendable {
        let portion: FoodPortion
        let day: CalendarDay
        let minute: Int
    }

    static let days = 30
    static let limit = 3

    /// Per hour, the foods logged on the most days within that hour over the `days` up to `today`, each at its latest
    /// serving there; ties go to the food logged there most recently. Future days (copies ahead of time) don't count.
    static func picks(_ entries: [Entry], today: CalendarDay) -> [Int: [FoodPortion]] {
        struct Tally {
            var days: Set<CalendarDay> = []
            var latest: Entry
        }
        let first = today.adding(days: -(days - 1))
        var tallies: [Int: [String: Tally]] = [:]
        for entry in entries where entry.day >= first && entry.day <= today {
            let key = FoodSearchResult.key(entry.portion.food)
            var tally = tallies[entry.minute / 60, default: [:]][key] ?? Tally(latest: entry)
            tally.days.insert(entry.day)
            if (entry.day, entry.minute) >= (tally.latest.day, tally.latest.minute) { tally.latest = entry }
            tallies[entry.minute / 60, default: [:]][key] = tally
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
