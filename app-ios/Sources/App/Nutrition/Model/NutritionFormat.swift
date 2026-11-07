import Foundation

/// Every number, serving, hour, and day nutrition prints, so a value reads the same on every screen.
enum NutritionFormat {
    /// A nutrient amount: one decimal under 10, whole from there (`niceText`). "0.5", "6.7", "16", "120".
    static func amount(_ value: Double) -> String {
        value.niceText
    }

    /// Calories are always whole, "33 kcal"; every other unit reads like `amount`, "6.7 g".
    static func amount(_ value: Double, _ unit: NutrientUnit) -> String {
        "\(unit == .kcal ? value.wholeText : value.niceText) \(unit.rawValue)"
    }

    /// A nutrient's amount by its id: whole calories, `niceText` for the rest.
    static func amount(_ value: Double, of id: NutrientID) -> String {
        id == .energy ? value.wholeText : value.niceText
    }

    /// "12P 8F 20C": protein, fat, and carbs in whole grams, as every condensed macro line reads.
    static func macros(_ amounts: NutrientAmounts) -> String {
        NutrientID.macros.dropFirst().map { "\((amounts[$0] ?? 0).wholeText)\($0.macroLetter)" }.joined(separator: " ")
    }

    /// Whole kilocalories with grouping, "1,509"; rows follow it with `calorieGlyph` (`Text(macroLine:)`).
    static func calories(_ amounts: NutrientAmounts) -> String {
        (amounts[.energy] ?? 0).wholeText
    }

    /// "1.25 cup", "100 g", or with the food's weight when it knows its grams, "1 large (136 g)".
    static func serving(_ serving: Serving, of food: FoodSnapshot? = nil) -> String {
        let text = "\(NumberText.plain(serving.quantity)) \(serving.measure.name)"
        guard let food, !SizeUnit.allCases.contains(where: { $0.rawValue == serving.measure.name }),
              let grams = food.nutrition.grams(serving) else { return text }
        return "\(text) (\(amount(grams)) g)"
    }

    static func hour(_ hour: Int) -> String {
        "\(hour % 12 == 0 ? 12 : hour % 12) \(hour < 12 ? "AM" : "PM")"
    }

    /// The timeline gutter's "2:48", without AM or PM, as the hour pill above already says which.
    static func time(_ minute: Int) -> String {
        let hour = minute / 60 % 12 == 0 ? 12 : minute / 60 % 12
        return String(format: "%d:%02d", hour, minute % 60)
    }

    static func clock(_ minute: Int) -> String {
        "\(time(minute)) \(minute < 720 ? "AM" : "PM")"
    }

    /// "8 AM" on the hour, as the timeline's hour labels read, and "8:30 AM" otherwise.
    static func moment(_ minute: Int) -> String {
        minute % 60 == 0 ? hour(minute / 60) : clock(minute)
    }

    static func dayTitle(_ day: CalendarDay, today: CalendarDay = .today) -> String {
        switch day {
        case today: "Today"
        case today.adding(days: -1): "Yesterday"
        case today.adding(days: 1): "Tomorrow"
        default: day.date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
        }
    }

    static func shortDay(_ day: CalendarDay) -> String {
        day.date.formatted(.dateTime.month(.abbreviated).day())
    }
}
