import GRDB
import SwiftUI

/// Library (`log-14-library-recipes.jpg`, `log-15-library-foods.jpg`): the owner's recipes, custom foods, and
/// favorites, with a filter field and Log Foods at the bottom. A favorite opens at its saved serving.
struct LibraryTab: View {
    @Bindable var session: LoggerSession
    let open: (LoggerPick) -> Void
    @Environment(LocalStore.self) private var store
    @Observe(Food.custom) private var foods
    @Observe(Recipe.library) private var recipes
    @Observe(FoodFavorite.all) private var favorites
    @State private var filter = ""

    var body: some View {
        VStack(spacing: 0) {
            Picker("Library", selection: $session.library) {
                ForEach(LibrarySection.allCases, id: \.self) { Text($0.title).tag($0) }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 20)
            .padding(.bottom, 4)
            List {
                switch session.library {
                case .recipes:
                    ForEach(matching(recipes.map { FoodPortion($0.snapshot) }), id: \.food.foodID) { row($0) }
                case .foods:
                    ForEach(matching(foods.map { FoodPortion($0.snapshot) }), id: \.food.foodID) { row($0) }
                case .favorites:
                    ForEach(favorites.filter { matches($0.food) }) { favorite in
                        row(favorite.portion)
                            .swipeActions {
                                Button("Delete", systemImage: "trash", role: .destructive) { store.deleteFavorite(favorite.id) }
                            }
                    }
                }
            }
            .themedList()
            .overlay { empty }
        }
        .safeAreaInset(edge: .bottom) {
            LoggerBottomBar(session: session) {
                TextField("Filter \(session.library.title.lowercased())", text: $filter).autocorrectionDisabled()
            }
        }
    }

    @ViewBuilder private var empty: some View {
        let isEmpty = switch session.library {
        case .recipes: recipes.isEmpty
        case .foods: foods.isEmpty
        case .favorites: favorites.isEmpty
        }
        if isEmpty {
            switch session.library {
            case .recipes: ContentUnavailableView("No recipes yet", systemImage: "frying.pan")
            case .foods: ContentUnavailableView("No custom foods yet", systemImage: "fork.knife")
            case .favorites:
                ContentUnavailableView(
                    "No favorites yet", systemImage: "heart",
                    description: Text("Search for a food, open the Food Detail view, and press the heart to save it as your favorite.")
                )
            }
        }
    }

    private func matching(_ portions: [FoodPortion]) -> [FoodPortion] {
        portions.filter { matches($0.food) }
    }

    private func matches(_ food: FoodSnapshot) -> Bool {
        let query = filter.trimmingCharacters(in: .whitespaces)
        return query.isEmpty || food.name.localizedStandardContains(query) || (food.brand?.localizedStandardContains(query) ?? false)
    }

    private func row(_ portion: FoodPortion) -> some View {
        LoggerFoodRow(portion: portion, open: { open(LoggerPick(portion)) }, add: { session.add(LoggerPick(portion)) })
    }
}

extension Food {
    /// The owner's own foods by name. `Food.library` also holds every cached USDA and Open Food Facts food.
    static let custom = DatabaseQuery([Food]()) { db in
        try Food.filter(Column("source") == FoodSource.custom.rawValue && Column("archived") == false)
            .order(Column("name").collating(.localizedCaseInsensitiveCompare))
            .fetchAll(db)
    }
}
