import Foundation

enum FoodLibraryTab: String, CaseIterable, Identifiable {
    case recipes = "Recipes", foods = "Foods", favorites = "Favorites"

    var id: Self { self }
}
