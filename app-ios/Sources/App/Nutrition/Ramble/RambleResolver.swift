import Foundation

/// What the owner changed on a row: an option they picked, a serving they typed, or the row removed. It holds while
/// the model keeps the row's name, so a re-read of the ramble never undoes a tap. A removal also ends when the speaker
/// says the food again (`RambleCapture`).
struct RambleChoice: Hashable, Sendable {
    /// The item's `identity` when the choice was made; a different item at the row's position drops it.
    var name: String
    /// `FoodSearchResult.key` of the picked option.
    var option: String?
    var serving: Serving?
    var removed = false
    /// For a removal, the transcript word after the removed row's words.
    var through: Int?
    /// For a copy, the servings the owner set on the foods it keeps, and the ones they removed, by `FoodEntry.key`.
    var keptServings: [String: Serving] = [:]
    var keptRemoved: Set<String> = []
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
        /// The name `options` were searched for. A row renamed before its search lands holds its old options under the
        /// new name, and searching only when the row's name changed had kept "San" (sandwich spreads) for "San Marzano
        /// tomatoes".
        var searched = ""
        /// The model was asked to show them ("that pizza is not right").
        var showsOptions: Bool
    }

    struct Copy: Hashable, Sendable {
        var meal: RambleMeal
        /// The meal's foods in its order, then the foods added to it (`RambleResolver.nest`).
        var children: [Child]
        /// Every child's calories and macros, which the copy's line shows.
        var amounts = NutrientAmounts()

        /// The foods kept as logged, which the copy itself logs; the other children are rows of their own.
        var kept: [(entry: FoodEntry, pick: LoggerPick)] {
            children.compactMap { if case let .kept(entry, pick) = $0 { (entry, pick) } else { nil } }
        }
    }

    /// One food of a copied meal.
    enum Child: Hashable, Sendable {
        /// An entry as logged, at the owner's serving if they changed it.
        case kept(FoodEntry, LoggerPick)
        /// The food row, by `id`, that changes the entry ("only half the potatoes"), or joins the meal when `entry` is nil.
        case row(Int, entry: String?)

        /// What a line stands for across reads: the entry, whichever form it takes, so a kept food turning into the row
        /// that changes it is one line that animates the change.
        var slot: String {
            switch self {
            case let .kept(entry, _): entry.key
            case let .row(id, entry): entry ?? "row \(id)"
            }
        }
    }

    enum Content: Hashable, Sendable {
        case food(Food)
        case copy(Copy)
        /// Parsed from the words, not yet searched: the row shows what was said until its match lands.
        case searching
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
    /// For a food of a copied meal, the copy row's `id`. The list draws it under the copy.
    var parent: Int?
    /// For a food kept as logged, its entry: such a row is drawn from the copy (`RambleCapture.lines`), with the copy's
    /// `id` and `item`, so the owner's changes to it land on the copy's choice.
    var kept: String?

    /// A food row that changes one of a copied meal's foods by pointing back at it ("only half the potatoes").
    var changesCopiedFood: Bool { parent != nil && item.ref != nil }

    var planned: [RamblePlanned] {
        switch content {
        case let .food(food): [RamblePlanned(pick: food.pick, day: day, minute: minute ?? 0)]
        case let .copy(copy): copy.kept.map { RamblePlanned(pick: $0.pick, day: day, minute: minute ?? $0.entry.minute) }
        case .searching, .unmatched: []
        }
    }
}

/// Lines a new list of items up with the old one by `RambleItem.identity`.
enum RambleAlignment {
    /// For each new position that continues an old one, that old position, and whether it is the same item. Items in
    /// common, in order, are the same; in each gap between them a new item takes the place of an old one it shares a word
    /// with, as the same row changed ("a coke" became "a diet coke"), and the rest are new.
    static func align(_ old: [String], _ new: [String]) -> [Int: (old: Int, same: Bool)] {
        var common = [[Int]](repeating: [Int](repeating: 0, count: new.count + 1), count: old.count + 1)
        for i in old.indices.reversed() {
            for j in new.indices.reversed() {
                common[i][j] = old[i] == new[j] ? common[i + 1][j + 1] + 1 : max(common[i + 1][j], common[i][j + 1])
            }
        }
        var aligned: [Int: (old: Int, same: Bool)] = [:]
        var removed: [Int] = [], added: [Int] = []
        // A changed item continues the removed one it is related to ("diet coke" the "coke", "date" the "dates"); an
        // unrelated one is a new row, so a food taken back never hands its row, and its struck name, to the next.
        func pair() {
            var left = removed
            for j in added {
                guard let match = left.firstIndex(where: { RambleResolver.related(old[$0], new[j]) }) else { continue }
                aligned[j] = (left.remove(at: match), false)
            }
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

/// A line of the ramble's list: a row, or a food of a copied meal drawn under it.
struct RambleListLine: Identifiable, Hashable, Sendable {
    /// A copy's food keeps its line whether it is kept as logged or changed by a row, so the change animates in place.
    let id: String
    let row: RambleRow
}

extension [RambleRow] {
    /// The rows in list order, each copy followed by its foods (`RambleRow.Copy.children`). A kept food is drawn as a
    /// food row with the copy's `id` and `item`, and a key of its own that no row has.
    var lines: [RambleListLine] {
        let byID = Dictionary(map { ($0.id, $0) }, uniquingKeysWith: { $1 })
        return flatMap { row -> [RambleListLine] in
            guard row.parent == nil else { return [] }
            var lines = [RambleListLine(id: "\(row.key)", row: row)]
            guard case let .copy(copy) = row.content else { return lines }
            for child in copy.children {
                let id = "\(row.key) \(child.slot)"
                switch child {
                case let .kept(entry, pick):
                    var kept = row
                    kept.content = .food(.init(pick: pick, key: FoodSearchResult.key(entry.food), options: [], showsOptions: false))
                    kept.minute = row.minute ?? entry.minute
                    kept.parent = row.id
                    kept.kept = entry.key
                    // A copy holds at most `RambleContext.entriesPerMeal` foods, so 64 keys per copy never meet.
                    kept.key = -(row.key * 64 + (copy.meal.entries.firstIndex { $0.id == entry.key } ?? 0) + 1)
                    lines.append(RambleListLine(id: id, row: kept))
                case let .row(childID, _):
                    if let child = byID[childID] { lines.append(RambleListLine(id: id, row: child)) }
                }
            }
            return lines
        }
    }

    /// These rows at the positions of the `items` they continue (`RambleAlignment`), for the resolver, which reads the
    /// previous row by position: after "remove the pear" the dates move into the pear's place and must find their own row.
    func lined(up items: [RambleItem]) -> [RambleRow] {
        RambleAlignment.align(map(\.item.identity), items.map(\.identity)).map { position, match in
            let row = self[match.old]
            return RambleRow(id: position, item: row.item, day: row.day, minute: row.minute, content: row.content, key: row.key)
        }
    }

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
/// context, choices, and previous rows give the same rows. With `search` off it never searches, so it is cheap enough
/// for the main actor: a food it would have to search for is `.searching`.
struct RambleResolver: Sendable {
    static let optionLimit = 10
    static let collapsedOptions = 5

    let index: FoodIndex
    let context: RambleContext
    let today: CalendarDay
    /// The logger's chosen day and hour, else today and now: the day of a row whose speaker named none, and the minute of
    /// a food with no meal or time.
    let fallback: (day: CalendarDay, minute: Int)
    /// What the online search found for names the local one did not, by lowercased name.
    var online: [String: [FoodSearchResult]] = [:]

    func rows(_ items: [RambleItem], previous: [RambleRow], choices: [Int: RambleChoice], search: Bool = true) throws -> [RambleRow] {
        let previous = Dictionary(previous.map { ($0.id, $0) }, uniquingKeysWith: { $1 })
        var rows: [RambleRow] = []
        for (position, item) in items.enumerated() {
            let choice = choices[position].flatMap { $0.name == item.identity ? $0 : nil }
            if choice?.removed == true { continue }
            rows.append(try row(position, item, previous: previous[position], choice: choice, search: search))
        }
        return Self.nest(rows)
    }

    private func row(_ id: Int, _ item: RambleItem, previous: RambleRow?, choice: RambleChoice?, search: Bool) throws -> RambleRow {
        let minute = item.minute ?? item.meal?.defaultMinute
        let day = item.day.map { today.adding(days: $0) } ?? fallback.day
        switch item.kind {
        case .copy:
            guard let mealID = item.copy, let meal = context.meals.first(where: { $0.id == mealID }) else {
                return RambleRow(id: id, item: item, day: day, minute: minute ?? fallback.minute, content: .unmatched)
            }
            let except = Set(item.except).union(choice?.keptRemoved ?? [])
            let kept = (context.mealEntries[mealID] ?? []).filter { !except.contains($0.key) }.map { entry in
                var portion = index.library.current.resolve(entry.portion)
                if let serving = choice?.keptServings[entry.key] { portion.serving = serving }
                return RambleRow.Child.kept(entry, LoggerPick(portion))
            }
            return RambleRow(id: id, item: item, day: day, minute: minute, content: .copy(.init(meal: meal, children: kept)))
        case .food:
            return RambleRow(id: id, item: item, day: day, minute: minute ?? fallback.minute, content: try food(item, previous: previous, choice: choice, search: search))
        }
    }

    private func food(_ item: RambleItem, previous: RambleRow?, choice: RambleChoice?, search: Bool) throws -> RambleRow.Content {
        // Searching the same name again finds nothing again; going back to `.searching` on every read made the row flicker.
        if previous?.content == .unmatched, previous?.item.name == item.name, item.ref == nil, online[item.name.lowercased()] == nil {
            return .unmatched
        }
        let earlier: RambleRow.Food? = if case let .food(food) = previous?.content { food } else { nil }
        let refEntry = item.ref.flatMap { context.entries[$0] }
        // The owner's pick outranks a ref the model added later; the row already holds that food, so it stays.
        if let refEntry, let option = choice?.option, option != FoodSearchResult.key(refEntry.food), let earlier, earlier.key == option {
            var pick = earlier.pick
            pick.portion.serving = choice?.serving
                ?? RambleServing.serving(amount: item.amount, unit: item.unit, food: item.name, of: pick.portion.food.nutrition, history: pick.portion.serving)
            return .food(.init(pick: pick, key: earlier.key, options: earlier.options, searched: earlier.searched, showsOptions: item.options))
        }
        if let entry = refEntry, choice?.option.map({ $0 == FoodSearchResult.key(entry.food) }) ?? true {
            var portion = index.library.current.resolve(entry.portion)
            if item.amount > 0 {
                portion.serving = RambleServing.serving(amount: item.amount, unit: item.unit, food: item.name, of: portion.food.nutrition, history: portion.serving)
            } else {
                portion.serving.quantity *= item.scale
            }
            if let serving = choice?.serving { portion.serving = serving }
            let pick = LoggerPick(portion)
            return .food(.init(pick: pick, key: FoodSearchResult.key(entry.food), options: [], showsOptions: false))
        }
        let options: [FoodSearchResult]
        let spoken: FoodSearchResult?
        if let earlier, earlier.searched == item.name, !earlier.options.isEmpty {
            options = earlier.options
            spoken = nil
        } else if let earlier, let shown = earlier.options.first(where: { $0.portion.food.displayName.caseInsensitiveCompare(item.name) == .orderedSame }) {
            // The speaker picked one of the options on screen ("let's go with the pepperoni"); the list stays put. A counted
            // can the named product cannot size is no pick: "San Marzano" grew into an unbranded product's own name.
            options = earlier.options
            spoken = RambleServing.counts(item.unit) && !RambleServing.sizes(item.unit, of: shown.portion.food.nutrition) ? nil : shown
        } else {
            // A row renamed by a correction ("coke" to "diet coke") keeps its food, at the new amount, until the search for
            // its new name lands. Rows are positions, so after a removal another food sits here; it shares no word.
            guard search else {
                guard var food = earlier, let before = previous?.item.name, Self.related(before, item.name) else { return .searching }
                food.pick.portion.serving = RambleServing.serving(amount: item.amount, unit: item.unit, food: item.name, of: food.pick.portion.food.nutrition, history: food.pick.portion.serving)
                return .food(food)
            }
            let local = try index.spoken(item.name)
            options = Array((local.isEmpty ? online[item.name.lowercased()] ?? [] : local).prefix(Self.optionLimit))
            spoken = nil
        }
        let chosen = choice?.option.flatMap { key in options.first { $0.key == key } }
        // A rename the speaker did not mean as another food ("halibut" read again as "Greenland halibut", or an amount
        // correction) keeps the food the row showed while the new search still finds it.
        let kept = earlier.flatMap { earlier in
            previous.map { Self.related($0.item.name, item.name) } == true ? options.first { $0.key == earlier.key } : nil
        }
        // The search matches by prefix, so "peas" also finds "Pears, raw"; an option holding every word said comes first
        // (the online search for "365 nonfat milk" lists other brands' nonfat milk too), then one sharing a word.
        let terms = FoodText.terms(item.name)
        let holding = options.filter { FoodText($0.portion.food.name, brand: $0.portion.food.brand).holds(terms) }
        // "1 can of San Marzano tomatoes" takes a product that knows its can over one that would log 100 g, unless the
        // owner logged one of them.
        let sized = holding.contains { $0.group == .history } ? nil : holding.first { RambleServing.sizes(item.unit, of: $0.portion.food.nutrition) }
        let best = sized ?? holding.first ?? options.first { Self.related(item.name, $0.portion.food.displayName) } ?? options.first
        guard let result = chosen ?? spoken ?? kept ?? best else { return .unmatched }
        var portion = result.portion
        let history = result.group == .history ? result.portion.serving : nil
        portion.serving = RambleServing.serving(amount: item.amount, unit: item.unit, food: item.name, of: result.portion.food.nutrition, history: history)
        // A measure belongs to the food it was set on; another food in the row's place keeps its own serving.
        if let serving = choice?.serving, choice?.option == result.key { portion.serving = serving }
        return .food(.init(pick: LoggerPick(portion, uncached: result.food), key: result.key, options: options, searched: item.name, showsOptions: item.options))
    }
}

extension RambleResolver {
    static func related(_ a: String, _ b: String) -> Bool {
        let words = { (text: String) in Set(text.lowercased().split(whereSeparator: { !$0.isLetter }).map { singular(String($0)) }) }
        return !words(a).isDisjoint(with: words(b))
    }

    /// "potatoes" is "potato" and "berries" is "berry", where dropping the "s" alone made "potatoe".
    static func singular(_ word: String) -> String {
        guard word.count > 3, word.hasSuffix("s"), !word.hasSuffix("ss") else { return word }
        if word.hasSuffix("ies") { return word.dropLast(3) + "y" }
        if word.hasSuffix("oes") { return String(word.dropLast(2)) }
        return String(word.dropLast())
    }

    /// Moves the food rows that change or join a copied meal under it, as its children: the foods said right after the
    /// copy at its day, meal, and time, since the model lists a copy's changes right after it. A food that refs one of
    /// the meal's entries ("only half the potatoes") takes that entry's place, as does one sharing a word with an entry
    /// the speaker left out ("sweet potatoes instead"); the others join the meal at its end.
    static func nest(_ rows: [RambleRow]) -> [RambleRow] {
        var rows = rows
        for index in rows.indices {
            guard case var .copy(copy) = rows[index].content else { continue }
            let head = rows[index]
            let left = Set(head.item.except)
            var slots: [String: Int] = [:]
            var added: [Int] = []
            var next = index + 1
            while next < rows.count, rows[next].item.kind == .food, rows[next].day == head.day,
                  rows[next].item.meal == head.item.meal, rows[next].item.minute == head.item.minute {
                let row = rows[next]
                if let ref = row.item.ref, copy.meal.entries.contains(where: { $0.id == ref }), slots[ref] == nil {
                    slots[ref] = row.id
                } else if row.item.ref == nil,
                          let replaced = copy.meal.entries.first(where: { left.contains($0.id) && slots[$0.id] == nil && related($0.name, row.item.name) }) {
                    slots[replaced.id] = row.id
                } else {
                    added.append(row.id)
                }
                rows[next].parent = head.id
                next += 1
            }
            let kept = Dictionary(copy.kept.map { ($0.entry.key, RambleRow.Child.kept($0.entry, $0.pick)) }, uniquingKeysWith: { $1 })
            copy.children = copy.meal.entries.compactMap { entry in slots[entry.id].map { .row($0, entry: entry.id) } ?? kept[entry.id] }
                + added.map { .row($0, entry: nil) }
            let portions = copy.kept.map(\.pick.portion) + rows[(index + 1)..<next].flatMap(\.planned).map(\.pick.portion)
            copy.amounts = portions.reduce(into: NutrientAmounts()) { $0 = $0 + $1.amounts }
            rows[index].content = .copy(copy)
        }
        return rows
    }
}

/// The serving a spoken amount and unit mean for a food (docs/decisions/nutrition.md, Ramble logging).
enum RambleServing {
    private static let grams: [String: (measure: String, factor: Double)] = [
        "g": ("g", 1), "gram": ("g", 1), "kg": ("kg", 1), "kilogram": ("kg", 1), "kilo": ("kg", 1), "oz": ("oz", 1), "ounce": ("oz", 1), "lb": ("lb", 1), "pound": ("lb", 1),
    ]
    /// Milliliters per unit, and the words a food's own measure may start with.
    private static let volumes: [String: (milliliters: Double, words: [String])] = [
        "ml": (1, ["ml", "milliliter"]),
        "l": (1000, ["l", "liter", "litre"]),
        "fl oz": (SizeUnit.flOz.size, ["fl oz"]),
        "cup": (SizeUnit.cup.size, ["cup"]),
        "tbsp": (NamedUnit.Unit.tbsp.size, ["tbsp", "tablespoon"]),
        "tsp": (NamedUnit.Unit.tsp.size, ["tsp", "teaspoon"]),
    ]

    /// What a row's serving menu offers: half, one and a half, or twice the serving, the food's own servings, and 100 g.
    static func choices(_ current: Serving, of nutrition: FoodNutrition) -> [Serving] {
        var all = [0.5, 1, 1.5, 2].map { Serving(measure: current.measure, quantity: current.quantity * $0) }
        all += nutrition.measures.map { Serving(measure: $0, quantity: $0.quantity) }
        if let gram = nutrition.allMeasures.first(where: { $0.name == SizeUnit.g.rawValue }) { all.append(Serving(measure: gram, quantity: 100)) }
        var seen = Set<String>()
        return all.filter { seen.insert(NutritionFormat.serving($0)).inserted }
    }

    /// Words for a container, which a product's "package" measure (its label's net quantity) sizes.
    private static let containers: Set<String> = ["can", "jar", "bottle", "package", "pack", "box", "bag", "carton", "tub", "container", "pouch", "packet"]

    /// `amount` of `unit` of the food the speaker called `food`.
    static func serving(amount: Double, unit: String, food: String, of nutrition: FoodNutrition, history: Serving?) -> Serving {
        let fallback = history ?? defaultServing(nutrition, count: 1)
        guard amount > 0 else { return fallback }
        let unit = unit.trimmingCharacters(in: .whitespaces).lowercased()
        let all = nutrition.allMeasures
        if unit.isEmpty { return counted(nutrition, food: food, count: amount) }
        if let weight = grams[unit] {
            if let measure = all.first(where: { $0.name == weight.measure }) { return Serving(measure: measure, quantity: amount * weight.factor) }
            // Water's density stands in for a food measured only by volume (milk per 100 mL): 200 g is 200 mL, where the
            // latest serving it fell back to was a whole carton.
            guard let milliliter = all.first(where: { $0.name == SizeUnit.mL.rawValue }), let perUnit = SizeUnit(rawValue: weight.measure)?.size else { return fallback }
            return Serving(measure: milliliter, quantity: (amount * weight.factor * perUnit).rounded())
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
            if let gram = all.first(where: { $0.name == SizeUnit.g.rawValue }) { return Serving(measure: gram, quantity: milliliters.rounded()) }
            return defaultServing(nutrition, count: amount)
        }
        let word = singular(unit)
        if let measure = all.first(where: { $0.name.lowercased().hasPrefix(word) }) ?? all.first(where: { $0.name.lowercased().contains(word) }) {
            return Serving(measure: measure, quantity: amount)
        }
        // "1 can" of a product that lists no can: its package, shown in the speaker's word.
        if let package = self.package(word, of: nutrition) { return Serving(measure: package, quantity: amount) }
        return defaultServing(nutrition, count: amount)
    }

    /// Whether `unit` counts containers ("can", "jars").
    static func counts(_ unit: String) -> Bool { containers.contains(singular(unit.trimmingCharacters(in: .whitespaces).lowercased())) }

    /// Whether `unit` is a container the food knows the size of, so a spoken "1 can" can be logged as one.
    static func sizes(_ unit: String, of nutrition: FoodNutrition) -> Bool {
        let word = singular(unit.trimmingCharacters(in: .whitespaces).lowercased())
        return counts(word) && (nutrition.allMeasures.contains { $0.name.lowercased().hasPrefix(word) } || package(word, of: nutrition) != nil)
    }

    private static func package(_ word: String, of nutrition: FoodNutrition) -> Measure? {
        guard containers.contains(word), let package = nutrition.measures.first(where: { $0.name == "package" }) else { return nil }
        return Measure(name: word, quantity: 1, servings: package.servings / package.quantity)
    }

    private static func singular(_ unit: String) -> String {
        unit.hasSuffix("s") && unit.count > 3 ? String(unit.dropLast()) : unit
    }

    /// A count of the food itself ("2 shallots", "2 apricots"): a measure named for it, else a whole one of a size, else
    /// the default. The default alone made "2 apricots" 2 "cup, halves".
    private static func counted(_ nutrition: FoodNutrition, food: String, count: Double) -> Serving {
        let said = Set(FoodText.terms(food))
        let first = { (measure: Measure) in FoodText.terms(measure.name).first ?? "" }
        let measure = nutrition.measures.first { said.contains(first($0)) }
            ?? nutrition.measures.first { ["medium", "large", "small", "whole"].contains(first($0)) }
        guard let measure else { return defaultServing(nutrition, count: count) }
        return Serving(measure: measure, quantity: count)
    }

    /// A volume measure of the food and its milliliters per unit of its quantity.
    private static func volumeMeasure(_ measures: [Measure]) -> (Measure, Double)? {
        if let measure = measures.first(where: { $0.name == SizeUnit.mL.rawValue }) { return (measure, 1) }
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
