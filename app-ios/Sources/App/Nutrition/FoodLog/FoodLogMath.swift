import Foundation

/// An entry on the timeline, and whether the gutter shows its time: only when it differs from the entry above it in
/// the same hour, as MacroFactor writes "2:48" once over three foods logged together.
struct TimelineRow: Hashable, Identifiable {
    let entry: FoodEntry
    let showsTime: Bool

    var id: UUID { entry.id }
}

/// One hour pill of the timeline and the entries under it.
struct TimelineHour: Hashable, Identifiable {
    let hour: Int
    let rows: [TimelineRow]

    var id: Int { hour }
    var totals: NutrientAmounts { FoodLog.totals(rows.map(\.entry)) }
}

/// One of the four summary lines: an amount eaten against the day's target, when a plan sets one.
struct MacroLine: Hashable, Identifiable {
    let nutrient: NutrientID
    let consumed: Double
    let target: Double?
    /// Target minus consumed, never below zero unless overages show.
    let remaining: Double?

    var id: NutrientID { nutrient }
    /// The bar's fill, 0 through 1.
    var progress: Double {
        guard let target, target > 0 else { return 0 }
        return min(1, max(0, consumed / target))
    }
}

/// Where a copy or move lands. `today` and `tomorrow` keep each entry's own time; the rest set one time for all.
enum PasteTarget: Hashable {
    case now
    case today
    case tomorrow
    case days([CalendarDay])
    case dateTime(CalendarDay, minute: Int)
    case hour(CalendarDay, hour: Int)
}

/// One `LocalStore.copyEntries` or `moveEntries` call: entries that land at the same day and minute.
struct Relocation: Hashable {
    let ids: [UUID]
    let day: CalendarDay
    let minute: Int
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
    static func totals(_ entries: [FoodEntry]) -> NutrientAmounts {
        entries.reduce(into: NutrientAmounts()) { $0 = $0 + $1.amounts }
    }

    /// The day's hours: the configured range, unless empty hours hide, plus every hour that has an entry.
    static func hours(_ entries: [FoodEntry], timeline: NutritionSettings.Timeline) -> [TimelineHour] {
        let byHour = Dictionary(grouping: entries, by: \.hour)
        var hours = Set(byHour.keys)
        if !timeline.hideEmptyHours, timeline.firstHour <= timeline.lastHour {
            hours.formUnion(timeline.firstHour...timeline.lastHour)
        }
        return hours.sorted().map { hour in
            let entries = (byHour[hour] ?? []).sorted { ($0.minute, $0.createdAt) < ($1.minute, $1.createdAt) }
            let rows = entries.enumerated().map { index, entry in
                TimelineRow(entry: entry, showsTime: index == 0 || entries[index - 1].minute != entry.minute)
            }
            return TimelineHour(hour: hour, rows: rows)
        }
    }

    static func remaining(consumed: Double, target: Double, showOverages: Bool) -> Double {
        showOverages ? target - consumed : max(0, target - consumed)
    }

    static func summary(_ amounts: NutrientAmounts, target: DayTarget?, showOverages: Bool) -> [MacroLine] {
        NutrientID.macros.map { id in
            let consumed = amounts[id] ?? 0
            let target = target?.amount(id)
            return MacroLine(
                nutrient: id, consumed: consumed, target: target,
                remaining: target.map { remaining(consumed: consumed, target: $0, showOverages: showOverages) }
            )
        }
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
        }
    }

    private static func keepingTimes(_ entries: [FoodEntry], on day: CalendarDay) -> [Relocation] {
        Dictionary(grouping: entries, by: \.minute).keys.sorted().map { minute in
            Relocation(ids: entries.filter { $0.minute == minute }.map(\.id), day: day, minute: minute)
        }
    }

    /// The bar's full length for `value` against `range`: the reference bound sits at 60% of the track, as
    /// MacroFactor draws its target tick, and an amount past the end stretches the track.
    static func barMaximum(value: Double, range: NutrientRange) -> Double? {
        guard let reference = range.target ?? range.ceiling ?? range.floor, reference > 0 else { return nil }
        return max(reference / 0.6, value)
    }
}
