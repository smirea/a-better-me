import Foundation

/// Every number, serving, hour, and day nutrition prints, so a value reads the same on every screen.
enum NutritionFormat {
    /// A nutrient amount, as MacroFactor prints them: one decimal under 100, whole from there. "0.5", "15.6", "120".
    static func amount(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(abs(value) < 100 ? 0...1 : 0...0)))
    }

    static func amount(_ value: Double, _ unit: NutrientUnit) -> String {
        "\(amount(value)) \(unit.rawValue)"
    }

    /// A quantity of a measure: up to two decimals, no grouping, and a point whatever the locale, since the keypad
    /// types ".". "0.33", "1234.57".
    static func quantity(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0...2)).grouping(.never).locale(Locale(identifier: "en_US_POSIX")))
    }

    /// "12P 8F 20C": protein, fat, and carbs in whole grams.
    static func macros(_ amounts: NutrientAmounts) -> String {
        NutrientID.macros.dropFirst().map { "\(Int((amounts[$0] ?? 0).rounded()))\($0.macroLetter)" }.joined(separator: " ")
    }

    /// Whole kilocalories with grouping, "1,509"; rows follow it with `calorieGlyph` (`Text(macroLine:)`).
    static func calories(_ amounts: NutrientAmounts) -> String {
        Int((amounts[.energy] ?? 0).rounded()).formatted()
    }

    /// "1.25 cup", "100 g", or with the food's weight when it knows its grams, "1 large (136 g)".
    static func serving(_ serving: Serving, of food: FoodSnapshot? = nil) -> String {
        let text = "\(quantity(serving.quantity)) \(serving.measure.name)"
        guard let food, !SizeUnit.allCases.contains(where: { $0.rawValue == serving.measure.name }),
              let grams = RecipeMath.grams(serving, of: food) else { return text }
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
