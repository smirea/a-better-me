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

    mutating func remove(_ id: UUID) {
        items.removeAll { $0.id == id }
    }

    func item(_ id: UUID) -> Item? { items.first { $0.id == id } }
}

/// What the logger's banner shows per nutrient (Settings › Food Log › Logger Banner).
enum LoggerBannerDisplay: String, Codable, CaseIterable, Sendable {
    case plateOnly, dayAndPlate, remainingAfterPlate
}

/// One nutrient of the banner: the day's amount before the plate, the plate's, and the day's target when a plan sets
/// one.
struct BannerValue: Hashable, Sendable {
    var day: Double
    var plate: Double
    var target: Double?

    /// The bar's fill: the day with the plate against the target, nil without a target.
    var progress: Double? {
        guard let target, target > 0 else { return nil }
        return min(1, (day + plate) / target)
    }

    /// The number the banner prints. Remaining falls back to the day's total when there is no target, and stops at
    /// zero unless overages show.
    func amount(_ display: LoggerBannerDisplay, showOverages: Bool) -> Double {
        switch display {
        case .plateOnly: return plate
        case .dayAndPlate: return day + plate
        case .remainingAfterPlate:
            guard let target else { return day + plate }
            let left = target - day - plate
            return showOverages ? left : max(0, left)
        }
    }
}

/// When the plate is logged: a calendar day and an hour, MacroFactor's hour-granular time chip. The minute comes from
/// the clock when logging, so foods logged one after another keep their order.
struct LogTime: Hashable, Sendable {
    var day: CalendarDay
    var hour: Int

    static func now(_ date: Date = .now, calendar: Calendar = .current) -> LogTime {
        LogTime(day: CalendarDay(date, in: calendar), hour: calendar.component(.hour, from: date))
    }

    func minute(at date: Date = .now, calendar: Calendar = .current) -> Int {
        hour * 60 + calendar.component(.minute, from: date)
    }

    /// "2 PM" today, "2 PM · Jul 31" on any other day.
    func label(today: CalendarDay = .today) -> String {
        let hourText = Self.hourLabel(hour)
        guard day != today else { return hourText }
        return "\(hourText) · \(day.shortLabel)"
    }

    static func hourLabel(_ hour: Int) -> String {
        let twelve = hour % 12 == 0 ? 12 : hour % 12
        return "\(twelve) \(hour < 12 ? "AM" : "PM")"
    }
}

extension CalendarDay {
    /// "Jul 31".
    var shortLabel: String {
        let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        return "\(months[month - 1]) \(day)"
    }

    /// "Yesterday", "Today", "Tomorrow", or "Sat Oct 24", as the logger's date wheel names days.
    func relativeLabel(today: CalendarDay = .today) -> String {
        switch self {
        case today: return "Today"
        case today.adding(days: -1): return "Yesterday"
        case today.adding(days: 1): return "Tomorrow"
        default:
            let weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
            return "\(weekdays[weekday - 1]) \(shortLabel)"
        }
    }
}
