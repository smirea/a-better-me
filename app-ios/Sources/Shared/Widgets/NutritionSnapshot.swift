import Foundation

/// The nutrition the home-screen widgets draw. The app's database lives in its private container, so the app writes
/// this file to the app group whenever the log, the plan, the goals, or the settings change, then reloads the widgets.
struct NutritionSnapshot: Codable, Equatable, Sendable {
    struct Nutrient: Codable, Hashable, Identifiable, Sendable {
        /// The registry id: `k`, `p`, `f`, `c`, or a USDA nutrient number.
        let id: String
        let name: String
        let unit: String
        let tint: NutrientTint
    }

    /// A floor, target, and ceiling; a nil bound is not set.
    struct Range: Codable, Hashable, Sendable {
        var floor: Double?
        var target: Double?
        var ceiling: Double?
    }

    struct Day: Codable, Equatable, Sendable {
        /// `YYYY-MM-DD` on the owner's calendar.
        let day: String
        let consumed: [String: Double]
        let ranges: [String: Range]
    }

    static let energy = "k"
    static let macros = ["p", "f", "c"]

    /// Every nutrient the owner hasn't hidden, in registry order.
    let nutrients: [Nutrient]
    /// The Dashboard's pinned nutrients, the default picks for a new widget.
    let pinned: [String]
    let showOverages: Bool
    /// Today, then the days after it, so a widget rolls over at midnight without waking the app.
    let days: [Day]

    static let horizon = 7

    static var url: URL? { AppGroup.url("Widgets/nutrition.json") }

    static func load() -> NutritionSnapshot? {
        guard let url, let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(NutritionSnapshot.self, from: data)
    }

    func save() throws {
        guard let url = Self.url else { throw CocoaError(.fileNoSuchFile) }
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try JSONEncoder().encode(self).write(to: url, options: .atomic)
    }

    func nutrient(_ id: String) -> Nutrient? { nutrients.first { $0.id == id } }

    func day(_ key: String) -> Day? { days.first { $0.day == key } }

    func progress(_ id: String, on day: Day) -> NutrientProgress? {
        nutrient(id).map {
            NutrientProgress(nutrient: $0, consumed: day.consumed[id] ?? 0, range: day.ranges[id] ?? Range(), showOverages: showOverages)
        }
    }

    /// The `YYYY-MM-DD` key of the day `date` falls on in the device's calendar, as the app's `CalendarDay` writes it.
    static func dayKey(_ date: Date, calendar: Calendar = .current) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year!, parts.month!, parts.day!)
    }
}

/// MacroFactor's nutrient colors: calories and the macros, then the vitamin and mineral groups.
enum NutrientTint: String, Codable, Sendable {
    case calories, protein, fat, carbs, vitamins, minerals
}

/// One nutrient's day against its goal, as MacroFactor's widgets word it: what is left to the target, else to the
/// floor while it is unmet, else to the ceiling.
struct NutrientProgress: Hashable, Sendable {
    let nutrient: NutritionSnapshot.Nutrient
    let consumed: Double
    let range: NutritionSnapshot.Range
    let showOverages: Bool

    var goal: Double? {
        if let target = range.target { return target }
        if let floor = range.floor, consumed < floor { return floor }
        return range.ceiling ?? range.floor
    }

    /// Goal minus consumed; below zero only when overages show.
    var remaining: Double? {
        goal.map { showOverages ? $0 - consumed : max(0, $0 - consumed) }
    }

    /// The ring's fill, 0 through 1. Without a goal anything logged fills it.
    var fraction: Double {
        guard let goal, goal > 0 else { return consumed > 0 ? 1 : 0 }
        return min(1, max(0, consumed / goal))
    }

    var isOver: Bool { (remaining ?? 0) < 0 }

    /// "1,240", "22.4": whole numbers from 10 up, one decimal below.
    static func number(_ value: Double) -> String {
        let magnitude = abs(value)
        return magnitude >= 10 || magnitude == magnitude.rounded()
            ? magnitude.rounded().formatted(.number.precision(.fractionLength(0)))
            : magnitude.formatted(.number.precision(.fractionLength(0...1)))
    }

    var consumedLabel: String { Self.number(consumed) }

    /// "1,240 kcal left", "120 kcal over", or the amount eaten when there is no goal.
    var remainingLabel: String {
        guard let remaining else { return "\(consumedLabel) \(nutrient.unit)" }
        return "\(Self.number(remaining)) \(nutrient.unit) \(remaining < 0 ? "over" : "left")"
    }

    /// "1,860 / 2,400 kcal", or "1,860 kcal" with no goal.
    var totalLabel: String {
        goal.map { "\(consumedLabel) / \(Self.number($0)) \(nutrient.unit)" } ?? "\(consumedLabel) \(nutrient.unit)"
    }
}
