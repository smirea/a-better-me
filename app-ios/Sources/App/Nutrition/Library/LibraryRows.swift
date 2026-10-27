import SwiftUI

/// The library's sort menu, MacroFactor's "Sort". Created and Modified start with the most recent.
enum LibrarySort: String, CaseIterable, Identifiable {
    case created = "Created", modified = "Modified", aToZ = "A–Z", zToA = "Z–A"

    var id: Self { self }
}

/// Filtering and sorting for the library lists. Every word of the query must appear in the name or brand.
enum LibraryFilter {
    static func foods(_ foods: [Food], matching query: String, sort: LibrarySort = .aToZ) -> [Food] {
        apply(foods, query: query, sort: sort, text: { "\($0.name) \($0.brand ?? "")" }, name: \.name, created: \.createdAt, modified: \.updatedAt)
    }

    static func recipes(_ recipes: [Recipe], matching query: String, sort: LibrarySort = .aToZ) -> [Recipe] {
        apply(recipes, query: query, sort: sort, text: \.name, name: \.name, created: \.createdAt, modified: \.updatedAt)
    }

    /// Favorites keep their saved order, oldest first.
    static func favorites(_ favorites: [FoodFavorite], matching query: String) -> [FoodFavorite] {
        favorites.filter { matches("\($0.food.name) \($0.food.brand ?? "")", query) }
    }

    private static func apply<Item>(
        _ items: [Item], query: String, sort: LibrarySort,
        text: (Item) -> String, name: (Item) -> String, created: (Item) -> Date, modified: (Item) -> Date
    ) -> [Item] {
        let matching = items.filter { matches(text($0), query) }
        return switch sort {
        case .created: matching.sorted { created($0) > created($1) }
        case .modified: matching.sorted { modified($0) > modified($1) }
        case .aToZ: matching.sorted { name($0).localizedStandardCompare(name($1)) == .orderedAscending }
        case .zToA: matching.sorted { name($0).localizedStandardCompare(name($1)) == .orderedDescending }
        }
    }

    private static func matches(_ text: String, _ query: String) -> Bool {
        query.split(separator: " ").allSatisfy { text.localizedStandardContains($0) }
    }
}

/// A food everywhere one is listed (the timeline, search, the library, the plate, a recipe), one line each like
/// MacroFactor's 47 pt rows: its icon, "Name By Brand" with the words a search matched in bold, and "120ઠ 1P 0F 31C · 1
/// large" at `serving`.
struct FoodRow: View {
    let food: FoodSnapshot
    let serving: Serving
    var showsDetail = true
    /// The search's terms (`FoodText.terms`), whose matches draw bold.
    var matching: [String] = []

    var body: some View {
        HStack(spacing: 12) {
            FoodIcon(food: food)
            RowLabel(
                title: title,
                detail: showsDetail ? Text("\(Text(macroLine: food.amounts(serving))) · \(NutritionFormat.serving(serving))") : nil
            )
            .lineLimit(1)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .contentShape(.rect)
        .accessibilityElement(children: .combine)
    }

    private var title: Text {
        let name = food.displayName
        let ranges = FoodText.matches(in: name, terms: matching)
        guard !ranges.isEmpty else { return Text(name) }
        var title = AttributedString(name)
        for range in ranges {
            guard let lower = AttributedString.Index(range.lowerBound, within: title),
                  let upper = AttributedString.Index(range.upperBound, within: title) else { continue }
            title[lower..<upper].font = AppFont.title(15)
        }
        return Text(title)
    }
}

extension Text {
    /// "105ઠ 1P 0F 27C": MacroFactor's compact nutrition, with the calorie glyph in place of "kcal".
    init(macroLine amounts: NutrientAmounts) {
        self.init("\(NutritionFormat.calories(amounts))\(calorieGlyph) \(NutritionFormat.macros(amounts))")
    }
}
