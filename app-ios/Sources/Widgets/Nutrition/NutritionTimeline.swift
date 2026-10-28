import WidgetKit

struct NutritionEntry: TimelineEntry {
    enum State {
        case ready(NutritionSnapshot, NutritionSnapshot.Day)
        /// Past the snapshot's last day: the app hasn't run for a week.
        case stale
        /// The app hasn't written a snapshot yet.
        case empty
    }

    let date: Date
    let state: State
    /// The nutrient ids the widget shows, in order.
    let picks: [String]

    var progress: [NutrientProgress] {
        guard case let .ready(snapshot, day) = state else { return [] }
        return picks.compactMap { snapshot.progress($0, on: day) }
    }
}

/// One entry per day the snapshot covers, each from its midnight, then a stale entry. The app reloads the timelines
/// whenever it writes a snapshot, so nothing here polls.
enum NutritionTimeline {
    static let currentAndRemaining = [NutritionSnapshot.energy] + NutritionSnapshot.macros

    static func timeline(picks: (NutritionSnapshot?) -> [String], now: Date = .now, calendar: Calendar = .current) -> Timeline<NutritionEntry> {
        let snapshot = NutritionSnapshot.load()
        let picks = picks(snapshot)
        guard let snapshot else { return Timeline(entries: [NutritionEntry(date: now, state: .empty, picks: picks)], policy: .never) }
        var entries: [NutritionEntry] = []
        var start = calendar.startOfDay(for: now)
        while let day = snapshot.day(NutritionSnapshot.dayKey(start, calendar: calendar)) {
            entries.append(NutritionEntry(date: max(now, start), state: .ready(snapshot, day), picks: picks))
            start = calendar.date(byAdding: .day, value: 1, to: start)!
        }
        entries.append(NutritionEntry(date: max(now, start), state: .stale, picks: picks))
        return Timeline(entries: entries, policy: .never)
    }

    static func snapshot(picks: (NutritionSnapshot?) -> [String], inPreview: Bool) -> NutritionEntry {
        if !inPreview, let entry = timeline(picks: picks).entries.first { return entry }
        return placeholder(picks: picks(nil))
    }

    static func placeholder(picks: [String]) -> NutritionEntry {
        NutritionEntry(date: .now, state: .ready(.sample, NutritionSnapshot.sample.days[0]), picks: picks)
    }

    /// Fills unset slots with the pinned nutrients not already picked, so a new widget shows calories and macros.
    static func resolve(_ picks: [String?], pinned: [String]) -> [String] {
        var spare = pinned.filter { !picks.contains($0) }.makeIterator()
        return picks.compactMap { $0 ?? spare.next() }
    }
}

struct CurrentAndRemainingProvider: TimelineProvider {
    private let picks: (NutritionSnapshot?) -> [String] = { _ in NutritionTimeline.currentAndRemaining }

    func placeholder(in context: Context) -> NutritionEntry { NutritionTimeline.placeholder(picks: picks(nil)) }

    func getSnapshot(in context: Context, completion: @escaping (NutritionEntry) -> Void) {
        completion(NutritionTimeline.snapshot(picks: picks, inPreview: context.isPreview))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NutritionEntry>) -> Void) {
        completion(NutritionTimeline.timeline(picks: picks))
    }
}

struct NutrientFocusProvider: AppIntentTimelineProvider {
    private func picks(_ configuration: NutrientFocusConfiguration) -> (NutritionSnapshot?) -> [String] {
        { NutritionTimeline.resolve([configuration.nutrient?.id], pinned: $0?.pinned ?? [NutritionSnapshot.energy]) }
    }

    func placeholder(in context: Context) -> NutritionEntry {
        NutritionTimeline.placeholder(picks: [NutritionSnapshot.energy])
    }

    func snapshot(for configuration: NutrientFocusConfiguration, in context: Context) async -> NutritionEntry {
        NutritionTimeline.snapshot(picks: picks(configuration), inPreview: context.isPreview)
    }

    func timeline(for configuration: NutrientFocusConfiguration, in context: Context) async -> Timeline<NutritionEntry> {
        NutritionTimeline.timeline(picks: picks(configuration))
    }
}

struct NutrientCollectionProvider: AppIntentTimelineProvider {
    private func picks(_ configuration: NutrientCollectionConfiguration) -> (NutritionSnapshot?) -> [String] {
        { NutritionTimeline.resolve(configuration.picks, pinned: $0?.pinned ?? NutritionTimeline.currentAndRemaining) }
    }

    func placeholder(in context: Context) -> NutritionEntry {
        NutritionTimeline.placeholder(picks: NutritionTimeline.currentAndRemaining)
    }

    func snapshot(for configuration: NutrientCollectionConfiguration, in context: Context) async -> NutritionEntry {
        NutritionTimeline.snapshot(picks: picks(configuration), inPreview: context.isPreview)
    }

    func timeline(for configuration: NutrientCollectionConfiguration, in context: Context) async -> Timeline<NutritionEntry> {
        NutritionTimeline.timeline(picks: picks(configuration))
    }
}

extension NutritionSnapshot {
    /// The gallery's sample day: midway through a 2,400 kcal day.
    static let sample: NutritionSnapshot = {
        let nutrients = [
            Nutrient(id: "k", name: "Calories", short: "cal", unit: "kcal", tint: .calories),
            Nutrient(id: "p", name: "Protein", short: "prot", unit: "g", tint: .protein),
            Nutrient(id: "f", name: "Fat", short: "fat", unit: "g", tint: .fat),
            Nutrient(id: "c", name: "Carbs", short: "carbs", unit: "g", tint: .carbs),
            Nutrient(id: "291", name: "Fiber", short: "fiber", unit: "g", tint: .carbs),
        ]
        let day = Day(
            day: dayKey(.now),
            consumed: ["k": 1460, "p": 118, "f": 46, "c": 142, "291": 21],
            ranges: [
                "k": Range(target: 2400), "p": Range(target: 180), "f": Range(target: 70), "c": Range(target: 250),
                "291": Range(floor: 25, target: 38),
            ]
        )
        return NutritionSnapshot(nutrients: nutrients, pinned: ["k", "p", "f", "c"], showOverages: true, days: [day])
    }()
}
