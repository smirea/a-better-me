import Foundation

/// Pure nutrition math over dated series, kept apart from records and views so the Dashboard, Strategy, and the
/// check-in call the same functions. Weights are kg, energy is kcal, macros are grams. See docs/decisions/nutrition.md.
enum NutritionEngine {
    static let kgPerLb = 0.45359237

    /// Calendar days between two dates, counted by date so a 23- or 25-hour daylight-saving day is still one.
    static func days(from start: Date, to end: Date, calendar: Calendar) -> Int {
        calendar.ordinality(of: .day, in: .era, for: end)! - calendar.ordinality(of: .day, in: .era, for: start)!
    }

    /// Every day from `start` to `end`, each at its own start of day, so a day after a midnight daylight-saving change
    /// (which starts at 01:00) is stepped from its own start.
    static func eachDay(from start: Date, through end: Date, calendar: Calendar) -> [Date] {
        var day = calendar.startOfDay(for: start)
        let last = calendar.startOfDay(for: end)
        var result: [Date] = []
        while day <= last {
            result.append(day)
            day = calendar.startOfDay(for: calendar.date(byAdding: .day, value: 1, to: day)!)
        }
        return result
    }
}
