import Foundation

enum FoodLibraryTab: String, CaseIterable, Identifiable {
    case recipes = "Recipes", foods = "Foods", favorites = "Favorites"

    /// The Library opens on the segment last chosen, in the logger and in Settings alike.
    static let storageKey = "nutrition.library.tab"

    var id: Self { self }
}
