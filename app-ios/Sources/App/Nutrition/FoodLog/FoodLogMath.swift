import Foundation

/// An entry on the timeline, and whether the gutter shows its time: only when it differs from the entry above it in
/// the same group, as MacroFactor writes "2:48" once over three foods logged together.
struct TimelineRow: Hashable, Identifiable {
    let entry: FoodEntry
    let showsTime: Bool

    var id: UUID { entry.id }
}

/// What a logged recipe's tile lists under its totals: names and amounts only, since the tile's totals are the point.
/// An altered recipe lists its alterations instead of its ingredients.
struct RecipeTileIngredients: Hashable, Sendable {
    struct Line: Hashable, Sendable {
        let name: String
        let amount: String
        var change = IngredientAlteration.Change.kept
        /// The recipe's amount, for a changed one.
        var was: String?
    }

    let lines: [Line]
    let more: Int
    var isAltered = false

    var spoken: String {
        let lines = lines.map { line in
            switch line.change {
            case .kept: line.name
            case .changed: "\(line.name) changed from \(line.was ?? "") to \(line.amount)"
            case .removed: "removed \(line.name)"
            case .added: "added \(line.name), \(line.amount)"
            }
        }
        return (isAltered ? "Alterations: " : "Ingredients: ") + (lines + (more > 0 ? ["\(more) more"] : [])).joined(separator: ", ")
    }
}

/// What a timeline group stands for: an hour of the Time display, or a meal section of the Sections display.
enum TimelineSlot: Hashable {
    case hour(Int)
    case section(MealSection)

    var label: String {
        switch self {
        case let .hour(hour): NutritionFormat.hour(hour)
        case let .section(section): section.name
        }
    }
}

/// A pill and the entries under it.
struct TimelineGroup: Hashable, Identifiable {
    let slot: TimelineSlot
    let rows: [TimelineRow]
    /// The minutes of the day it covers, which mark the current one with a dot.
    let minutes: Range<Int>

    /// Summed once here, since `DayPage` memoizes the groups and every render of the row reads them.
    let totals: NutrientAmounts
    /// A section's foods as a meal, hashed once here for the same reason. An hour is no meal, so it has none.
    let meal: MealComponents?
    /// What the meal line shows while the meal has neither a recipe nor a stored name.
    let mealFallbackName: String?

    init(slot: TimelineSlot, rows: [TimelineRow], minutes: Range<Int>) {
        self.slot = slot
        self.rows = rows
        self.minutes = minutes
        totals = rows.map(\.entry).totals
        meal = if case .section = slot { MealComponents(rows.map(\.entry.food)) } else { nil }
        mealFallbackName = meal == nil ? nil : MealComponents.fallbackName(rows.map(\.entry.portion))
    }

    var id: TimelineSlot { slot }
}

/// One of the day's four summary columns: what was eaten, what the logger's plate adds on top (nil outside the logger),
/// and the day's target when there is one. `MacroTotalsBars` draws them on the Food Log and in the logger's banner.
struct MacroLine: Hashable, Identifiable {
    /// Eaten against the target, what is left, or only what the plate adds.
    enum Page: String { case eaten, remaining, plate }

    /// A bar's two segments as fractions of its track, eaten first and the plate after it.
    struct Fill: Hashable {
        var eaten: Double
        var plate: Double
    }

    let nutrient: NutrientID
    let consumed: Double
    var plate: Double?
    let target: Double?
    /// Target minus consumed and the plate, never below zero unless overages show.
    let remaining: Double?

    var id: NutrientID { nutrient }
    var total: Double { consumed + (plate ?? 0) }

    var spoken: String {
        let unit = nutrient == .energy ? "calories" : "grams"
        let eaten = target.map { "\(total.wholeText) of \($0.wholeText)" } ?? total.wholeText
        let plate = (plate ?? 0) > 0 ? ", \((plate ?? 0).wholeText) on the plate" : ""
        return "\(nutrient.title) \(eaten) \(unit)\(plate)"
    }

    /// What the plate adds as a share of the target, or without one as a share of the day with the plate.
    var plateShare: Double? {
        let plate = plate ?? 0
        if let target, target > 0 { return plate / target }
        return total > 0 ? plate / total : nil
    }

    func text(_ page: Page) -> String {
        switch (page, target, remaining) {
        case (.plate, _, _): return "+\((plate ?? 0).wholeText)"
        case let (.remaining, _, remaining?): return "\(remaining.wholeText) left"
        case let (.eaten, target?, _): return "\(total.wholeText) / \(target.wholeText)"
        default: return total.wholeText
        }
    }

    /// Against the target when there is one. The remaining page fills what is left after the plate, with the part the
    /// plate takes beside it, and draws mirrored. Without a target the bar is the day with the plate, so the plate's
    /// share of the day shows; outside the logger there is no plate, so there is no bar, since an empty track reads
    /// as broken.
    func fill(_ page: Page) -> Fill? {
        let plate = max(0, plate ?? 0)
        if let target, target > 0 {
            let clamp = { (value: Double) in min(1, max(0, value / target)) }
            guard page == .remaining else {
                let eaten = clamp(consumed)
                return Fill(eaten: eaten, plate: min(1 - eaten, clamp(plate)))
            }
            let left = clamp(target - total)
            return Fill(eaten: left, plate: min(1 - left, clamp(min(plate, target - consumed))))
        }
        guard self.plate != nil else { return nil }
        guard total > 0 else { return Fill(eaten: 0, plate: 0) }
        return Fill(eaten: max(0, consumed) / total, plate: plate / total)
    }
}

/// Where a copy or move lands. `today` and `tomorrow` keep each entry's own time and section; the rest set one time
/// for all, and a section's paste puts them all in it.
enum PasteTarget: Hashable {
    case now
    case today
    case tomorrow
    case days([CalendarDay])
    case dateTime(CalendarDay, minute: Int)
    case hour(CalendarDay, hour: Int)
    case section(CalendarDay, MealSection, minute: Int)
}

/// Entries a copy or move lands at the same day and minute, and the meal section each ends up in.
struct Relocation: Hashable {
    enum Section: Hashable {
        /// Each entry keeps the section it has.
        case keep
        /// The section the new minute falls in.
        case fromMinute
        case chosen(String)
    }

    let ids: [UUID]
    let day: CalendarDay
    let minute: Int
    var section = Section.fromMinute

    func section(for entry: FoodEntry, in sections: [MealSection]) -> String {
        switch section {
        case .keep: entry.section ?? sections.section(at: entry.minute).id
        case .fromMinute: sections.section(at: minute).id
        case let .chosen(id): id
        }
    }
}

/// A food's share of a nutrient on the day.
struct Contributor: Hashable, Identifiable {
    let entryID: UUID
    let name: String
    let amount: Double

    var id: UUID { entryID }
}

/// The Food Log's arithmetic, kept out of the views so the suites can pin them.
enum FoodLog {
    /// The day's timeline in the owner's display: hours or meal sections.
    static func groups(_ entries: [FoodEntry], settings: NutritionSettings) -> [TimelineGroup] {
        switch settings.timeline.display {
        case .time: hours(entries, timeline: settings.timeline)
        case .sections: sections(entries, sections: settings.mealSections, hideEmpty: settings.timeline.hideEmptyHours)
        }
    }

    /// The day's hours: the configured range, unless empty hours hide, plus every hour that has an entry.
    static func hours(_ entries: [FoodEntry], timeline: NutritionSettings.Timeline) -> [TimelineGroup] {
        let byHour = Dictionary(grouping: entries, by: \.hour)
        var hours = Set(byHour.keys)
        if !timeline.hideEmptyHours, timeline.firstHour <= timeline.lastHour {
            hours.formUnion(timeline.firstHour...timeline.lastHour)
        }
        return hours.sorted().map { TimelineGroup(slot: .hour($0), rows: rows(byHour[$0] ?? []), minutes: $0 * 60..<($0 + 1) * 60) }
    }

    /// The day's meal sections in order, each with the entries logged into it, or for an entry without one (or whose
    /// section was removed), the section its minute falls in. Empty sections hide with Hide Empty Hours.
    static func sections(_ entries: [FoodEntry], sections: [MealSection], hideEmpty: Bool) -> [TimelineGroup] {
        let bySection = Dictionary(grouping: entries) { sections.section(of: $0).id }
        return sections.compactMap { section in
            let entries = bySection[section.id] ?? []
            return hideEmpty && entries.isEmpty ? nil : TimelineGroup(slot: .section(section), rows: rows(entries), minutes: sections.range(of: section))
        }
    }

    private static func rows(_ entries: [FoodEntry]) -> [TimelineRow] {
        let entries = entries.sorted { ($0.minute, $0.createdAt) < ($1.minute, $1.createdAt) }
        return entries.enumerated().map { index, entry in
            TimelineRow(entry: entry, showsTime: index == 0 || entries[index - 1].minute != entry.minute)
        }
    }

    static func remaining(consumed: Double, target: Double, showOverages: Bool) -> Double {
        showOverages ? target - consumed : max(0, target - consumed)
    }

    /// A line per nutrient, against `targets` (`NutrientTargets.goals`). The logger passes its plate, which the lines
    /// count on top of the day.
    static func summary(
        _ amounts: NutrientAmounts, plate: NutrientAmounts? = nil, nutrients: [NutrientID] = NutrientID.macros,
        targets: NutrientAmounts, showOverages: Bool
    ) -> [MacroLine] {
        nutrients.map { id in
            let consumed = amounts.amount(of: id) ?? 0
            let added = plate.map { $0.amount(of: id) ?? 0 }
            let target = targets[id]
            return MacroLine(
                nutrient: id, consumed: consumed, plate: added, target: target,
                remaining: target.map { remaining(consumed: consumed + (added ?? 0), target: $0, showOverages: showOverages) }
            )
        }
    }

    /// Shows `nutrient` in column `index`. One already in another column trades places with the one it replaces, so
    /// no nutrient shows twice.
    static func choosing(_ nutrient: NutrientID, at index: Int, in columns: [NutrientID]) -> [NutrientID] {
        var columns = columns
        if let other = columns.firstIndex(of: nutrient) {
            columns.swapAt(index, other)
        } else {
            columns[index] = nutrient
        }
        return columns
    }

    /// The day's calories as a fraction of its target, for the ring around a day pill. A day with food and no target
    /// draws a full ring, so logged days still stand out.
    static func ringProgress(kcal: Double, target: Double?) -> Double {
        guard let target, target > 0 else { return kcal > 0 ? 1 : 0 }
        return min(1, kcal / target)
    }

    /// The nutrient's largest contributors on the day, largest first; foods without it are left out.
    static func contributors(_ entries: [FoodEntry], of nutrient: NutrientID, limit: Int? = nil) -> [Contributor] {
        let sorted = entries
            .compactMap { entry -> Contributor? in
                guard let amount = entry.amounts.amount(of: nutrient), amount > 0 else { return nil }
                return Contributor(entryID: entry.id, name: entry.food.name, amount: amount)
            }
            .sorted { $0.amount > $1.amount }
        return limit.map { Array(sorted.prefix($0)) } ?? sorted
    }

    /// The daily average over `days`, counting only days the expenditure algorithm counts (`DayIntake`): logged or
    /// fasted. A partial day and a day with nothing logged are skipped instead of dragging the average down.
    static func dailyAverage(_ entries: [FoodEntry], rows: [NutritionDay], days: [CalendarDay]) -> NutrientAmounts {
        let entriesByDay = Dictionary(grouping: entries, by: \.day)
        let rowsByDay = Dictionary(uniqueKeysWithValues: rows.map { ($0.id, $0) })
        var sum = NutrientAmounts()
        var counted = 0
        for day in days {
            switch DayIntake(entries: entriesByDay[day] ?? [], day: rowsByDay[day]) {
            case let .logged(amounts):
                sum = sum + amounts
                counted += 1
            case .fasted:
                counted += 1
            case .skipped:
                break
            }
        }
        guard counted > 0 else { return [:] }
        return sum.mapValues { $0 / Double(counted) }
    }

    /// Groups the entries into the store calls that land them at `target`, seen from `now`.
    static func relocations(_ entries: [FoodEntry], to target: PasteTarget, now: Date, calendar: Calendar = .current) -> [Relocation] {
        let today = CalendarDay(now, in: calendar)
        let ids = entries.map(\.id)
        switch target {
        case .now:
            return [Relocation(ids: ids, day: today, minute: now.minuteOfDay(in: calendar))]
        case .today:
            return keepingTimes(entries, on: today)
        case .tomorrow:
            return keepingTimes(entries, on: today.adding(days: 1))
        case let .days(days):
            return days.sorted().flatMap { keepingTimes(entries, on: $0) }
        case let .dateTime(day, minute):
            return [Relocation(ids: ids, day: day, minute: minute)]
        case let .hour(day, hour):
            return [Relocation(ids: ids, day: day, minute: hour * 60)]
        case let .section(day, section, minute):
            return [Relocation(ids: ids, day: day, minute: minute, section: .chosen(section.id))]
        }
    }

    private static func keepingTimes(_ entries: [FoodEntry], on day: CalendarDay) -> [Relocation] {
        Dictionary(grouping: entries, by: \.minute).keys.sorted().map { minute in
            Relocation(ids: entries.filter { $0.minute == minute }.map(\.id), day: day, minute: minute, section: .keep)
        }
    }

    static func confirmation(_ action: FoodLogState.Action, count: Int, to target: PasteTarget, now: Date = .now, calendar: Calendar = .current) -> String {
        let today = CalendarDay(now, in: calendar)
        let verb = action == .copy ? "Copied" : "Moved"
        let foods = count == 1 ? "1 food" : "\(count) foods"
        let place = switch target {
        case .now: "Today at \(NutritionFormat.moment(now.minuteOfDay(in: calendar)))"
        case .today: "Today"
        case .tomorrow: "Tomorrow"
        case let .days(days) where days.count == 1: NutritionFormat.dayTitle(days[0], today: today)
        case let .days(days): "\(days.count) days"
        case let .dateTime(day, minute): "\(NutritionFormat.dayTitle(day, today: today)) at \(NutritionFormat.moment(minute))"
        case let .hour(day, hour): "\(NutritionFormat.dayTitle(day, today: today)) at \(NutritionFormat.moment(hour * 60))"
        case let .section(day, section, _): "\(section.name), \(NutritionFormat.dayTitle(day, today: today))"
        }
        return "\(verb) \(foods) to \(place)"
    }

    static func toggling(_ hour: [UUID], in selection: Set<UUID>) -> Set<UUID> {
        selection.isSuperset(of: hour) ? selection.subtracting(hour) : selection.union(hour)
    }

    /// A recipe logged at `serving`, as its ingredients at the amounts eaten: half a serving of a one-serving recipe
    /// halves every ingredient.
    static func ingredients(_ serving: Serving, of recipe: Recipe) -> [RecipeIngredient] {
        RecipeMath.scaled(recipe.ingredients, from: recipe.servings, to: serving.servings)
    }

    /// A logged recipe's ingredients at `serving`, as the tile, the entry editor, and Explode all read them: an altered
    /// entry's own alterations, else its recipe's ingredients as it is now, each kept. Empty when it has neither.
    static func ingredients(_ serving: Serving, of entry: FoodEntry, recipe: Recipe?) -> [IngredientAlteration] {
        if let alterations = entry.alterations {
            return alterations.map { $0.scaled(by: serving.servings) }
        }
        guard let recipe else { return [] }
        return ingredients(serving, of: recipe).map(IngredientAlteration.init(kept:))
    }

    static func exploded(_ serving: Serving, of recipe: Recipe) -> [FoodPortion] {
        ingredients(serving, of: recipe).map { FoodPortion($0.food, serving: $0.serving) }
    }

    /// A logged recipe's tile lines at the amounts eaten, the first `limit` of them and how many more there are. An
    /// unaltered recipe lists its ingredients, most calories first; an altered one lists only what changed, was
    /// removed, or was added, in the recipe's order with additions last.
    static func tileIngredients(_ ingredients: [IngredientAlteration], limit: Int = 5) -> RecipeTileIngredients {
        let isAltered = ingredients.isAltered
        let lines: [RecipeTileIngredients.Line]
        if isAltered {
            lines = ingredients.compactMap { line in
                let name = line.food.displayName
                return switch (line.change, line.original, line.serving) {
                case let (.changed, original?, eaten?): .init(name: name, amount: NutritionFormat.serving(eaten), change: .changed, was: NutritionFormat.serving(original))
                case let (.removed, original?, _): .init(name: name, amount: NutritionFormat.serving(original), change: .removed)
                case let (.added, _, eaten?): .init(name: name, amount: NutritionFormat.serving(eaten), change: .added)
                default: nil
                }
            }
        } else {
            lines = ingredients.eaten.enumerated()
                .sorted { ($1.element.amounts[.energy] ?? 0, $0.offset) < ($0.element.amounts[.energy] ?? 0, $1.offset) }
                .map { .init(name: $0.element.food.displayName, amount: NutritionFormat.serving($0.element.serving)) }
        }
        return RecipeTileIngredients(lines: Array(lines.prefix(limit)), more: max(lines.count - limit, 0), isAltered: isAltered)
    }

    /// Create Recipe's starting draft: the selected entries as ingredients at their logged servings, with the number
    /// of servings left for the owner to type.
    static func recipeDraft(_ entries: [FoodEntry]) -> RecipeDraft {
        var draft = RecipeDraft()
        draft.ingredients = entries.map { .init(RecipeIngredient($0.portion)) }
        return draft
    }

    /// A meal line's Create: the section's foods as a recipe of one serving at the amounts logged, weighed as the
    /// recipe editor weighs a blank Total Weight. Quick adds stay out, as they stay out of the meal.
    static func mealRecipe(_ name: String, from entries: [FoodEntry]) -> Recipe {
        var recipe = Recipe(name: name)
        recipe.ingredients = entries.filter { $0.food.source != .quickAdd }.map { RecipeIngredient($0.portion) }
        let grams = RecipeMath.ingredientGrams(recipe.ingredients)
        recipe.cookedGrams = grams > 0 ? grams : nil
        return recipe
    }

    /// What saving Create Recipe logs in place of the selection: the whole batch, at the earliest selected entry's
    /// day, minute, and section. The selection was the whole recipe, so a recipe made to serve 4 logs 4 servings and
    /// the day's totals stay put; a recipe of 1 serving is the owner's "1 serving of the recipe".
    static func replacement(for entries: [FoodEntry], with recipe: Recipe) -> FoodEntry? {
        guard let first = entries.min(by: { ($0.day, $0.minute) < ($1.day, $1.minute) }) else { return nil }
        let measure = recipe.nutrition.measures[0]
        let batch = Serving(measure: measure, quantity: recipe.servings * measure.quantity / measure.servings)
        return FoodEntry(FoodPortion(recipe.snapshot, serving: batch), day: first.day, minute: first.minute, section: first.section)
    }

    /// The entry to bring into view after the day's entries changed: the last one in the timeline that was not there
    /// before. Nil when nothing was added.
    static func added(from old: [FoodEntry], to new: [FoodEntry]) -> UUID? {
        let before = Set(old.map(\.id))
        return new.last { !before.contains($0.id) }?.id
    }

    /// How many day pills the header row shows in `width`: as many as fit at `minPill` or wider, an odd count so the
    /// selected day has as many days on each side, and at least three.
    static func stripCount(width: Double, minPill: Double, spacing: Double) -> Int {
        let fit = Int((width + spacing) / (minPill + spacing))
        return max(3, fit.isMultiple(of: 2) ? fit - 1 : fit)
    }

    /// How far the header row has slid away on a page scrolled `offset` down, for a row `row` tall and `maxOffset` of
    /// scrolling. The row tracks the content 1:1, so it scrolls away as if it were the timeline's first row; the page
    /// keeps its top margin either way, so sliding never resizes anything mid-drag. A day too short to scroll the row
    /// all the way out keeps it, so the row never rests half hidden.
    static func headerSlide(offset: Double, row: Double, maxOffset: Double) -> Double {
        maxOffset < row ? 0 : min(max(offset, 0), row)
    }

    /// Where a scroll that would come to rest at `target` stops instead: never with the header row half slid away.
    static func headerSnap(target: Double, row: Double, maxOffset: Double) -> Double {
        guard maxOffset >= row, target > 0, target < row else { return target }
        return target < row / 2 ? 0 : row
    }

    /// The bar's full length for `value` against `range`: the reference bound sits at 60% of the track, as
    /// MacroFactor draws its target tick, and an amount past the end stretches the track.
    static func barMaximum(value: Double, range: NutrientRange) -> Double? {
        guard let reference = range.target ?? range.ceiling ?? range.floor, reference > 0 else { return nil }
        return max(reference / 0.6, value)
    }
}

extension NutrientTargets {
    /// The summary's lines for the day: `settings` picks the columns and whether remaining goes negative.
    func summary(_ amounts: NutrientAmounts, plate: NutrientAmounts? = nil, settings: AppSettings) -> [MacroLine] {
        let columns = settings.nutrition.summaryNutrients
        return FoodLog.summary(amounts, plate: plate, nutrients: columns, targets: goals(columns), showOverages: settings.nutrition.showOverages)
    }
}
