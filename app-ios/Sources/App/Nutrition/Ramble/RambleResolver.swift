import Foundation

/// What the owner changed on a row: an option they picked, a serving they typed, or the row removed. It holds while
/// the model keeps the row's name, so a re-read of the ramble never undoes a tap.
struct RambleChoice: Hashable, Sendable {
    /// The item's `identity` when the choice was made; a different item at the row's position drops it.
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
    /// The row on screen this one continues, so a correction animates as a change and a removal as a removal, where
    /// `id` would shift every row after a removed one onto its neighbour (`keyed(after:next:)`).
    var key = 0

    var planned: [RamblePlanned] {
        switch content {
        case let .food(food): [RamblePlanned(pick: food.pick, day: day, minute: minute ?? 0)]
        case let .copy(copy): copy.entries.map { RamblePlanned(pick: LoggerPick($0.portion), day: day, minute: minute ?? $0.minute) }
        case .unmatched: []
        }
    }
}

/// Lines a new list of items up with the old one by `RambleItem.identity`.
enum RambleAlignment {
    /// For each new position that continues an old one, that old position, and whether it is the same item. Items in
    /// common, in order, are the same; in each gap between them the new items take the old ones' places one for one,
    /// as the same rows changed ("a coke" became "a diet coke").
    static func align(_ old: [String], _ new: [String]) -> [Int: (old: Int, same: Bool)] {
        var common = [[Int]](repeating: [Int](repeating: 0, count: new.count + 1), count: old.count + 1)
        for i in old.indices.reversed() {
            for j in new.indices.reversed() {
                common[i][j] = old[i] == new[j] ? common[i + 1][j + 1] + 1 : max(common[i + 1][j], common[i][j + 1])
            }
        }
        var aligned: [Int: (old: Int, same: Bool)] = [:]
        var removed: [Int] = [], added: [Int] = []
        func pair() {
            for (j, i) in zip(added, removed) { aligned[j] = (i, false) }
            removed = []
            added = []
        }
        var i = 0, j = 0
        while i < old.count || j < new.count {
            if i < old.count, j < new.count, old[i] == new[j] {
                pair()
                aligned[j] = (i, true)
                i += 1
                j += 1
            } else if j == new.count || (i < old.count && common[i + 1][j] >= common[i][j + 1]) {
                removed.append(i)
                i += 1
            } else {
                added.append(j)
                j += 1
            }
        }
        pair()
        return aligned
    }
}

extension [RambleRow] {
    /// These rows keyed by the `old` ones they continue on screen (`RambleAlignment`); the rest take keys after `next`.
    func keyed(after old: [RambleRow], next: inout Int) -> [RambleRow] {
        let aligned = RambleAlignment.align(old.map(\.item.identity), map(\.item.identity))
        var rows = self
        for j in rows.indices {
            if let match = aligned[j] {
                rows[j].key = old[match.old].key
            } else {
                next += 1
                rows[j].key = next
            }
        }
        return rows
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
    /// The logger's chosen day and hour, else today and now: the day of a row whose speaker named none, and the minute of
    /// a food with no meal or time.
    let fallback: (day: CalendarDay, minute: Int)

    func rows(_ items: [RambleItem], previous: [RambleRow], choices: [Int: RambleChoice]) throws -> [RambleRow] {
        let previous = Dictionary(previous.map { ($0.id, $0) }, uniquingKeysWith: { $1 })
        var rows: [RambleRow] = []
        for (position, item) in items.enumerated() {
            let choice = choices[position].flatMap { $0.name == item.identity ? $0 : nil }
            if choice?.removed == true { continue }
            rows.append(try row(position, item, previous: previous[position], choice: choice))
        }
        return rows
    }

    private func row(_ id: Int, _ item: RambleItem, previous: RambleRow?, choice: RambleChoice?) throws -> RambleRow {
        let minute = item.minute ?? item.meal?.defaultMinute
        let day = item.day.map { today.adding(days: $0) } ?? fallback.day
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
        let earlier: RambleRow.Food? = if case let .food(food) = previous?.content { food } else { nil }
        let refEntry = item.ref.flatMap { context.entries[$0] }
        // The owner's pick outranks a ref the model added later; the row already holds that food, so it stays.
        if let refEntry, let option = choice?.option, option != FoodSearchResult.key(refEntry.food), let earlier, earlier.key == option {
            var pick = earlier.pick
            pick.portion.serving = choice?.serving
                ?? RambleServing.serving(amount: item.amount, unit: item.unit, of: pick.portion.food.nutrition, history: pick.portion.serving)
            return .food(.init(pick: pick, key: earlier.key, options: earlier.options, showsOptions: item.options))
        }
        if let entry = refEntry, choice?.option.map({ $0 == FoodSearchResult.key(entry.food) }) ?? true {
            var portion = entry.portion
            if item.amount > 0 {
                portion.serving = RambleServing.serving(amount: item.amount, unit: item.unit, of: entry.food.nutrition, history: entry.serving)
            }
            if let serving = choice?.serving { portion.serving = serving }
            let pick = LoggerPick(portion)
            return .food(.init(pick: pick, key: FoodSearchResult.key(entry.food), options: [], showsOptions: false))
        }
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
        // A measure belongs to the food it was set on; another food in the row's place keeps its own serving.
        if let serving = choice?.serving, choice?.option == result.key { portion.serving = serving }
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
            // The spoken unit, sized from a volume the food has: "2 tbsp" of oats, where "0.12 cup" read as if the
            // correction to 2 tablespoons never landed.
            if let (known, size) = volumeMeasure(all) {
                let spoken = Measure(name: ["ml": "mL", "l": "L"][unit] ?? unit, quantity: 1, servings: known.servings / known.quantity * volume.milliliters / size)
                return Serving(measure: spoken, quantity: amount)
            }
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

    /// A volume measure of the food and its milliliters per unit of its quantity.
    private static func volumeMeasure(_ measures: [Measure]) -> (Measure, Double)? {
        if let measure = measures.first(where: { $0.name == "mL" }) { return (measure, 1) }
        for volume in volumes.values.sorted(by: { $0.milliliters > $1.milliliters }) {
            if let measure = named(measures, volume.words) { return (measure, volume.milliliters) }
        }
        return nil
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
