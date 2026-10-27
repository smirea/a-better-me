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

/// A food, recipe, or favorite in a list: icon, name and brand, then its macros at `serving`.
struct FoodRow: View {
    let food: FoodSnapshot
    let serving: Serving

    var body: some View {
        HStack(spacing: 12) {
            FoodIconView(name: food.icon)
            VStack(alignment: .leading, spacing: 2) {
                Text(food.brand.map { "\(food.name) By \($0)" } ?? food.name)
                    .font(AppFont.medium(15))
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(2)
                Text("\(NutritionFormat.macroLine(food.amounts(serving))) · \(NutritionFormat.serving(serving, of: food))")
                    .font(AppFont.caption(12))
                    .foregroundStyle(Theme.textSecondary)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .contentShape(.rect)
        .accessibilityElement(children: .combine)
    }
}
