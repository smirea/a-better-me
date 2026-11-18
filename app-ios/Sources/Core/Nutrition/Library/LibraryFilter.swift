import Foundation

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

/// The library's sort menu, MacroFactor's "Sort". Created and Modified start with the most recent.
enum LibrarySort: String, CaseIterable, Identifiable {
    case created = "Created", modified = "Modified", aToZ = "A–Z", zToA = "Z–A"

    var id: Self { self }
}
