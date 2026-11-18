import Foundation

/// A food picked in the logger, before or on the plate: the snapshot at a serving, plus the USDA or Open Food Facts
/// food a log must cache first (`FoodSearch.cache`), nil for the owner's own foods and foods already cached.
struct LoggerPick: Hashable, Sendable {
    var portion: FoodPortion
    var uncached: Food?

    init(_ portion: FoodPortion, uncached: Food? = nil) {
        self.portion = portion
        self.uncached = uncached
    }

    init(_ result: FoodSearchResult) {
        self.init(result.portion, uncached: result.food)
    }
}

/// Several foods picked before logging them together. Screen state only: `LocalStore.log` writes the plate in one
/// transaction and the plate is gone.
struct Plate: Hashable, Sendable {
    struct Item: Identifiable, Hashable, Sendable {
        let id: UUID
        var pick: LoggerPick
    }

    private(set) var items: [Item] = []

    var isEmpty: Bool { items.isEmpty }
    var portions: [FoodPortion] { items.map(\.pick.portion) }
    var totals: NutrientAmounts { items.reduce(into: NutrientAmounts()) { $0 = $0 + $1.pick.portion.amounts } }

    @discardableResult
    mutating func add(_ pick: LoggerPick) -> UUID {
        let item = Item(id: UUID(), pick: pick)
        items.append(item)
        return item.id
    }

    mutating func setServing(_ serving: Serving, of id: UUID) {
        guard let index = items.firstIndex(where: { $0.id == id }) else { return }
        items[index].pick.portion.serving = serving
    }

    mutating func setIcon(_ icon: String?, of food: FoodSnapshot) {
        let key = FoodSearchResult.key(food)
        for index in items.indices where FoodSearchResult.key(items[index].pick.portion.food) == key {
            items[index].pick.portion.food.icon = icon
        }
    }

    mutating func remove(_ id: UUID) {
        items.removeAll { $0.id == id }
    }

    func item(_ id: UUID) -> Item? { items.first { $0.id == id } }
}

/// When the plate is logged: a calendar day and an hour, MacroFactor's hour-granular time chip. The minute comes from
/// the clock when logging, so foods logged one after another keep their order. A section's + or the section picker also
/// names the meal section, which the plate logs into whatever the minute.
struct LogTime: Hashable, Sendable {
    var day: CalendarDay
    var hour: Int {
        didSet { section = nil }
    }
    var section: MealSection?

    init(day: CalendarDay, hour: Int, section: MealSection? = nil) {
        self.day = day
        self.hour = hour
        self.section = section
    }

    static func now(_ date: Date = .now, calendar: Calendar = .current) -> LogTime {
        LogTime(day: CalendarDay(date, in: calendar), hour: calendar.component(.hour, from: date))
    }

    func minute(at date: Date = .now, calendar: Calendar = .current) -> Int {
        hour * 60 + calendar.component(.minute, from: date)
    }

    /// The meal section this time logs into: the one picked, else the one its minute falls in.
    func section(in sections: [MealSection], at date: Date = .now, calendar: Calendar = .current) -> MealSection {
        section ?? sections.section(at: minute(at: date, calendar: calendar))
    }

    /// The pill this time logs under: its hour, or in the Sections display its section.
    func slot(in sections: [MealSection], showsSections: Bool, at date: Date = .now, calendar: Calendar = .current) -> TimelineSlot {
        showsSections ? .section(section(in: sections, at: date, calendar: calendar)) : .hour(hour)
    }

    /// "2 PM" today, "2 PM · Jul 31" on any other day. With `sections` (the Sections display), the section instead:
    /// "Lunch", "Lunch · Jul 31".
    func label(today: CalendarDay = .today, sections: [MealSection]? = nil, now: Date = .now) -> String {
        let slot = section?.name ?? sections.map { section(in: $0, at: now).name } ?? NutritionFormat.hour(hour)
        guard day != today else { return slot }
        return "\(slot) · \(NutritionFormat.shortDay(day))"
    }
}
