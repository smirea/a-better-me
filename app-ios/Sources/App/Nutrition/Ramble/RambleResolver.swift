import Foundation

/// What the owner changed on a row: an option they picked, a serving they typed, or the row removed. It holds while
/// the model keeps the row's name, so a re-read of the ramble never undoes a tap.
struct RambleChoice: Hashable, Sendable {
    var name: String
    /// `FoodSearchResult.key` of the picked option.
    var option: String?
    var serving: Serving?
    var removed = false
}

/// One food a row will log, at its own day and minute.
struct RamblePlanned: Hashable, Sendable {
    var pick: LoggerPick
    var day: CalendarDay
    var minute: Int
}

/// A line of the ramble's list. Its id is its position: a ramble grows at its end, so the item at index i is the same
/// row across the model's answers.
struct RambleRow: Identifiable, Hashable, Sendable {
    struct Food: Hashable, Sendable {
        var pick: LoggerPick
        /// `FoodSearchResult.key` of the pick.
        var key: String
        /// The search's top candidates for the spoken name, best first, at most `RambleResolver.optionLimit`.
        var options: [FoodSearchResult]
        /// The model was asked to show them ("that pizza is not right").
        var showsOptions: Bool
    }

    struct Copy: Hashable, Sendable {
        var meal: RambleMeal
        /// The meal's entries without the ones the speaker left out.
        var entries: [FoodEntry]
    }

    enum Content: Hashable, Sendable {
        case food(Food)
        case copy(Copy)
        /// No food in the search matched the name.
        case unmatched
    }

    let id: Int
    var item: RambleItem
    var day: CalendarDay
    /// Nil for a copy without a time or meal, whose foods keep their own minutes.
    var minute: Int?
    var content: Content

    var planned: [RamblePlanned] {
        switch content {
        case let .food(food): [RamblePlanned(pick: food.pick, day: day, minute: minute ?? 0)]
        case let .copy(copy): copy.entries.map { RamblePlanned(pick: LoggerPick($0.portion), day: day, minute: minute ?? $0.minute) }
        case .unmatched: []
        }
    }
}

/// Turns the model's outline into rows over the local search and the log, off the main actor. Pure: the same outline,
/// context, choices, and previous rows give the same rows.
struct RambleResolver: Sendable {
    static let optionLimit = 10
    static let collapsedOptions = 5

    let index: FoodIndex
    let context: RambleContext
    let today: CalendarDay
    /// Where a food goes when the speaker gave it no day, meal, or time: the logger's chosen hour, else now.
    let fallback: (day: CalendarDay, minute: Int)

    func rows(_ items: [RambleItem], previous: [RambleRow], choices: [Int: RambleChoice]) throws -> [RambleRow] {
        let previous = Dictionary(previous.map { ($0.id, $0) }, uniquingKeysWith: { $1 })
        var rows: [RambleRow] = []
        for (position, item) in items.enumerated() {
            let choice = choices[position].flatMap { $0.name == item.name ? $0 : nil }
            if choice?.removed == true { continue }
            rows.append(try row(position, item, previous: previous[position], choice: choice))
        }
        return rows
    }

    private func row(_ id: Int, _ item: RambleItem, previous: RambleRow?, choice: RambleChoice?) throws -> RambleRow {
        let minute = item.minute ?? item.meal?.defaultMinute
        let unplaced = item.kind == .food && item.day == 0 && minute == nil
        let day = unplaced ? fallback.day : today.adding(days: item.day)
        switch item.kind {
        case .copy:
            guard let mealID = item.copy, let meal = context.meals.first(where: { $0.id == mealID }) else {
                return RambleRow(id: id, item: item, day: day, minute: minute ?? fallback.minute, content: .unmatched)
            }
            let except = Set(item.except)
            let entries = (context.mealEntries[mealID] ?? []).filter { !except.contains($0.key) }
            return RambleRow(id: id, item: item, day: day, minute: minute, content: .copy(.init(meal: meal, entries: entries)))
        case .food:
            return RambleRow(id: id, item: item, day: day, minute: minute ?? fallback.minute, content: try food(item, previous: previous, choice: choice))
        }
    }

    private func food(_ item: RambleItem, previous: RambleRow?, choice: RambleChoice?) throws -> RambleRow.Content {
        if let ref = item.ref, let entry = context.entries[ref] {
            var portion = entry.portion
            if item.amount > 0 {
                portion.serving = RambleServing.serving(amount: item.amount, unit: item.unit, of: entry.food.nutrition, history: entry.serving)
            }
            if let serving = choice?.serving { portion.serving = serving }
            let pick = LoggerPick(portion)
            return .food(.init(pick: pick, key: FoodSearchResult.key(entry.food), options: [], showsOptions: false))
        }
        let earlier: RambleRow.Food? = if case let .food(food) = previous?.content { food } else { nil }
        let options: [FoodSearchResult]
        let spoken: FoodSearchResult?
        if let earlier, previous?.item.name == item.name, !earlier.options.isEmpty {
            options = earlier.options
            spoken = nil
        } else if let earlier, let shown = earlier.options.first(where: { $0.portion.food.displayName.caseInsensitiveCompare(item.name) == .orderedSame }) {
            // The speaker picked one of the options on screen ("let's go with the pepperoni"); the list stays put.
            options = earlier.options
            spoken = shown
        } else {
            options = Array(try index.local(item.name).prefix(Self.optionLimit))
            spoken = nil
        }
        let chosen = choice?.option.flatMap { key in options.first { $0.key == key } }
        let kept = earlier.flatMap { earlier in previous?.item.name == item.name ? options.first { $0.key == earlier.key } : nil }
        guard let result = chosen ?? spoken ?? kept ?? options.first else { return .unmatched }
        var portion = result.portion
        let history = result.group == .history ? result.portion.serving : nil
        portion.serving = RambleServing.serving(amount: item.amount, unit: item.unit, of: result.portion.food.nutrition, history: history)
        if let serving = choice?.serving { portion.serving = serving }
        return .food(.init(pick: LoggerPick(portion, uncached: result.food), key: result.key, options: options, showsOptions: item.options))
    }
}

/// The serving a spoken amount and unit mean for a food (docs/decisions/nutrition.md, Ramble logging).
enum RambleServing {
    private static let grams: [String: (measure: String, factor: Double)] = [
        "g": ("g", 1), "gram": ("g", 1), "kg": ("g", 1000), "oz": ("oz", 1), "ounce": ("oz", 1), "lb": ("lb", 1), "pound": ("lb", 1),
    ]
    /// Milliliters per unit, and the words a food's own measure may start with.
    private static let volumes: [String: (milliliters: Double, words: [String])] = [
        "ml": (1, ["ml", "milliliter"]),
        "l": (1000, ["l", "liter", "litre"]),
        "fl oz": (29.5735295625, ["fl oz"]),
        "cup": (236.5882365, ["cup"]),
        "tbsp": (14.78676478125, ["tbsp", "tablespoon"]),
        "tsp": (4.92892159375, ["tsp", "teaspoon"]),
    ]

    static func serving(amount: Double, unit: String, of nutrition: FoodNutrition, history: Serving?) -> Serving {
        let fallback = history ?? defaultServing(nutrition, count: 1)
        guard amount > 0 else { return fallback }
        let unit = unit.trimmingCharacters(in: .whitespaces).lowercased()
        let all = nutrition.allMeasures
        if unit.isEmpty { return defaultServing(nutrition, count: amount) }
        if let weight = grams[unit] {
            guard let measure = all.first(where: { $0.name == weight.measure }) else { return fallback }
            return Serving(measure: measure, quantity: amount * weight.factor)
        }
        if let volume = volumes[unit] {
            // A serving's quantity counts the measure's own unit; the measure's quantity is only its reference size.
            if let measure = named(all, volume.words) { return Serving(measure: measure, quantity: amount) }
            let milliliters = amount * volume.milliliters
            if let measure = all.first(where: { $0.name == "mL" }) { return Serving(measure: measure, quantity: milliliters) }
            if let cup = named(all, ["cup"]) { return Serving(measure: cup, quantity: milliliters / 236.5882365) }
            // Water's density stands in for a food that is only weighed (chia seeds per 100 g): 2 tbsp is 30 g, where
            // two of its 100 g servings would be 200 g.
            if let gram = all.first(where: { $0.name == "g" }) { return Serving(measure: gram, quantity: milliliters) }
            return defaultServing(nutrition, count: amount)
        }
        let word = unit.hasSuffix("s") && unit.count > 3 ? String(unit.dropLast()) : unit
        if let measure = all.first(where: { $0.name.lowercased().hasPrefix(word) }) ?? all.first(where: { $0.name.lowercased().contains(word) }) {
            return Serving(measure: measure, quantity: amount)
        }
        return defaultServing(nutrition, count: amount)
    }

    private static func defaultServing(_ nutrition: FoodNutrition, count: Double) -> Serving {
        let measure = nutrition.measures[0]
        return Serving(measure: measure, quantity: measure.quantity * count)
    }

    /// The first measure named exactly one of `words`, or starting with one before a comma, a space, or a parenthesis
    /// ("cup, sliced", "tbsp (14 g)").
    private static func named(_ measures: [Measure], _ words: [String]) -> Measure? {
        measures.first { measure in
            let name = measure.name.lowercased()
            return words.contains { word in
                name == word || name == word + "s" || [",", " ", "("].contains { name.hasPrefix(word + $0) || name.hasPrefix(word + "s" + $0) }
            }
        }
    }
}
