import Foundation

/// What the ramble model can point back at, built once per capture from the log: the last week's meals to copy
/// ("the same breakfast as yesterday"), the foods logged most often ("my usual"), and the entries both name, so the
/// resolver turns a `ref` or a `copy` back into snapshots and servings.
struct RambleContext: Sendable {
    static let mealDays = 7
    static let usualDays = 60
    static let usualLimit = 15
    /// The server's cap per meal.
    static let entriesPerMeal = 30

    var meals: [RambleMeal] = []
    var usual: [RambleLogged] = []
    var entries: [String: FoodEntry] = [:]
    var mealEntries: [String: [FoodEntry]] = [:]

    /// The bucket a logged minute falls in. The log has no meals, so these windows stand in for them.
    static func meal(at minute: Int) -> RambleMealKind {
        switch minute {
        case 4 * 60..<11 * 60: .breakfast
        case 11 * 60..<15 * 60: .lunch
        case 15 * 60..<17 * 60: .snack
        case 17 * 60..<23 * 60: .dinner
        default: .snack
        }
    }

    /// `entries` are the log from `usualDays` back through today; later days are ignored, so copies made ahead of time
    /// never count as eaten.
    init(entries: [FoodEntry], today: CalendarDay) {
        let eaten = entries.filter { $0.day <= today }.sorted { ($0.day, $0.minute, $0.createdAt) < ($1.day, $1.minute, $1.createdAt) }
        let firstMealDay = today.adding(days: -(Self.mealDays - 1))
        var grouped: [String: (day: CalendarDay, meal: RambleMealKind, entries: [FoodEntry])] = [:]
        var order: [String] = []
        for entry in eaten where entry.day >= firstMealDay {
            let meal = Self.meal(at: entry.minute)
            let id = "\(entry.day)-\(meal.rawValue)"
            if grouped[id] == nil {
                grouped[id] = (entry.day, meal, [])
                order.append(id)
            }
            grouped[id]!.entries.append(entry)
        }
        for id in order {
            let group = grouped[id]!
            let shown = Array(group.entries.prefix(Self.entriesPerMeal))
            meals.append(RambleMeal(id: id, day: group.day, meal: group.meal, entries: shown.map(Self.logged)))
            mealEntries[id] = shown
            for entry in shown { self.entries[entry.key] = entry }
        }

        let firstUsualDay = today.adding(days: -(Self.usualDays - 1))
        var days: [String: Set<CalendarDay>] = [:]
        var latest: [String: FoodEntry] = [:]
        for entry in eaten where entry.day >= firstUsualDay && entry.food.source != .quickAdd {
            let key = FoodSearchResult.key(entry.food)
            days[key, default: []].insert(entry.day)
            latest[key] = entry
        }
        let ranked = latest.values.sorted { lhs, rhs in
            let left = days[FoodSearchResult.key(lhs.food)]!.count, right = days[FoodSearchResult.key(rhs.food)]!.count
            return left != right ? left > right : (lhs.day, lhs.minute) > (rhs.day, rhs.minute)
        }
        for entry in ranked.prefix(Self.usualLimit) {
            usual.append(Self.logged(entry))
            self.entries[entry.key] = entry
        }
    }

    init() {}

    private static func logged(_ entry: FoodEntry) -> RambleLogged {
        RambleLogged(id: entry.key, name: String(entry.food.displayName.prefix(200)), serving: String(NutritionFormat.serving(entry.serving).prefix(80)))
    }
}
