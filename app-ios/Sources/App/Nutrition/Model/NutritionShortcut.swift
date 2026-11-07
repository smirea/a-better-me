import Foundation

/// A Nutrition "+" shortcut (research spec §2, `nav-03-choose-shortcuts.jpg`). AI, Describe, Photos, and Metrics are not
/// built, so they are not offered.
enum NutritionShortcut: String, Codable, CaseIterable, Sendable {
    case yourFoods, search, barcode, quickAdd, ramble, recipes, favorites, editDay, weight

    /// The first four are the round buttons, as MacroFactor tags them "Top Shortcut".
    static let topCount = 4

    var title: String {
        switch self {
        case .yourFoods: "Your Foods"
        case .search: "Search"
        case .barcode: "Barcode"
        case .quickAdd: "Quick Add"
        case .ramble: "Ramble"
        case .recipes: "Recipes"
        case .favorites: "Favorites"
        case .editDay: "Edit Day"
        case .weight: "Weight"
        }
    }

    var detail: String {
        switch self {
        case .yourFoods: "Browse custom foods you created"
        case .search: "Search foods to log"
        case .barcode: "Scan a barcode to log"
        case .quickAdd: "Log calories and macros"
        case .ramble: "Say what you ate"
        case .recipes: "Browse and log your recipes"
        case .favorites: "Log a saved serving"
        case .editDay: "Edit today's nutrition totals"
        case .weight: "Add scale weight and body fat %"
        }
    }

    var systemImage: String {
        switch self {
        case .yourFoods: "fork.knife"
        case .search: "magnifyingglass"
        case .barcode: "barcode.viewfinder"
        case .quickAdd: "bolt.fill"
        case .ramble: "waveform"
        case .recipes: "frying.pan"
        case .favorites: "heart.fill"
        case .editDay: "square.and.pencil"
        case .weight: "scalemass.fill"
        }
    }
}
