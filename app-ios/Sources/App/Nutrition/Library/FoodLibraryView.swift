import SwiftUI

/// A create or edit sheet for a food or recipe.
struct LibraryEditorSheet: Identifiable {
    enum Kind {
        case newFood(FoodDraft), editFood(Food), newRecipe(RecipeDraft), editRecipe(Recipe)
    }

    let id = UUID()
    let kind: Kind

    init(_ kind: Kind) { self.kind = kind }

    @MainActor @ViewBuilder var editor: some View {
        switch kind {
        case let .newFood(draft): FoodEditor(draft: draft)
        case let .editFood(food): FoodEditor(food: food)
        case let .newRecipe(draft): RecipeEditor(draft: draft)
        case let .editRecipe(recipe): RecipeEditor(recipe: recipe)
        }
    }
}

/// MacroFactor's Library: Recipes | Foods | Favorites, each filtered by the search field, with Create Food and
/// Create Recipe under +. Settings pushes it as is. The logger embeds it in its Library tab and passes `onOpen` to
/// show its own food detail for a tapped row and `onAdd` for each row's + (the default serving onto the plate).
/// Without `onOpen`, a food opens its editor and a recipe its detail page.
struct FoodLibraryView: View {
    enum Tab: String, CaseIterable, Identifiable {
        case recipes = "Recipes", foods = "Foods", favorites = "Favorites"

        var id: Self { self }
    }

    enum Item {
        case food(Food), recipe(Recipe), favorite(FoodFavorite)
    }

    private let onOpen: ((Item) -> Void)?
    private let onAdd: ((FoodPortion) -> Void)?
    @Environment(LocalStore.self) private var store
    @Observe(Food.library) private var foods
    @Observe(Recipe.library) private var recipes
    @Observe(FoodFavorite.all) private var favorites
    @State private var tab: Tab
    @State private var sort = LibrarySort.created
    @State private var query = ""
    @State private var sheet: LibraryEditorSheet?
    @State private var openedRecipe: UUID?
    @State private var pendingDelete: Item?
    @State private var favorited = false

    init(tab: Tab = .foods, onOpen: ((Item) -> Void)? = nil, onAdd: ((FoodPortion) -> Void)? = nil) {
        _tab = State(initialValue: tab)
        self.onOpen = onOpen
        self.onAdd = onAdd
    }

    var body: some View {
        List {
            switch tab {
            case .recipes: recipeRows
            case .foods: foodRows
            case .favorites: favoriteRows
            }
        }
        .themedList()
        .overlay { emptyState }
        .safeAreaBar(edge: .top) {
            Picker("Library", selection: $tab) {
                Text("Recipes").tag(Tab.recipes)
                Text("Foods").tag(Tab.foods)
                Image(systemName: "heart.fill").accessibilityLabel("Favorites").tag(Tab.favorites)
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 20)
            .padding(.bottom, 8)
        }
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Filter \(tab.rawValue.lowercased())")
        .navigationTitle("Foods & Recipes")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if tab != .favorites {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Picker("Sort", selection: $sort) {
                            ForEach(LibrarySort.allCases) { Text($0.rawValue).tag($0) }
                        }
                    } label: {
                        Label("Sort", systemImage: "arrow.up.arrow.down")
                    }
                }
            }
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button("Create Food", systemImage: "carrot") { sheet = LibraryEditorSheet(.newFood(FoodDraft())) }
                    Button("Create Recipe", systemImage: "frying.pan") { sheet = LibraryEditorSheet(.newRecipe(RecipeDraft())) }
                } label: {
                    Label("Create", systemImage: "plus")
                }
            }
        }
        .sheet(item: $sheet) { $0.editor }
        .navigationDestination(item: $openedRecipe) { RecipeDetailView(recipeID: $0) }
        .sensoryFeedback(.success, trigger: favorited)
        .confirmationDialog(deleteTitle, isPresented: Binding { pendingDelete != nil } set: { if !$0 { pendingDelete = nil } }, titleVisibility: .visible) {
            Button(pendingDelete.map { if case .favorite = $0 { "Remove" } else { "Delete" } } ?? "Delete", role: .destructive) {
                switch pendingDelete {
                case let .food(food): store.deleteFood(food.id)
                case let .recipe(recipe): store.deleteRecipe(recipe.id)
                case let .favorite(favorite): store.deleteFavorite(favorite.id)
                case nil: break
                }
                pendingDelete = nil
            }
        } message: {
            Text(deleteMessage)
        }
    }

    private var foodRows: some View {
        ForEach(LibraryFilter.foods(foods, matching: query, sort: sort)) { food in
            row(food.snapshot, serving: nil) {
                if let onOpen { onOpen(.food(food)) } else { sheet = LibraryEditorSheet(.editFood(food)) }
            }
            .swipeActions { deleteButton(.food(food)) }
            .contextMenu {
                Button("Edit", systemImage: "pencil") { sheet = LibraryEditorSheet(.editFood(food)) }
                Button("Favorite", systemImage: "heart") { favorite(FoodPortion(food.snapshot)) }
                Button("Duplicate", systemImage: "plus.square.on.square") { sheet = LibraryEditorSheet(.newFood(FoodDraft(food).duplicate())) }
                Button("Delete", systemImage: "trash", role: .destructive) { pendingDelete = .food(food) }
            }
        }
    }

    private var recipeRows: some View {
        ForEach(LibraryFilter.recipes(recipes, matching: query, sort: sort)) { recipe in
            row(recipe.snapshot, serving: nil) {
                if let onOpen { onOpen(.recipe(recipe)) } else { openedRecipe = recipe.id }
            }
            .swipeActions { deleteButton(.recipe(recipe)) }
            .contextMenu {
                Button("Edit", systemImage: "pencil") { sheet = LibraryEditorSheet(.editRecipe(recipe)) }
                Button("Favorite", systemImage: "heart") { favorite(FoodPortion(recipe.snapshot)) }
                Button("Duplicate", systemImage: "plus.square.on.square") { sheet = LibraryEditorSheet(.newRecipe(RecipeDraft(recipe).duplicate())) }
                Button("Delete", systemImage: "trash", role: .destructive) { pendingDelete = .recipe(recipe) }
            }
        }
    }

    private var favoriteRows: some View {
        ForEach(LibraryFilter.favorites(favorites, matching: query)) { favorite in
            row(favorite.food, serving: favorite.serving) { onOpen?(.favorite(favorite)) }
                .swipeActions { deleteButton(.favorite(favorite), title: "Remove") }
                .contextMenu {
                    Button("Remove", systemImage: "heart.slash", role: .destructive) { pendingDelete = .favorite(favorite) }
                }
        }
    }

    private func row(_ food: FoodSnapshot, serving: Serving?, open: @escaping () -> Void) -> some View {
        let serving = serving ?? FoodPortion(food).serving
        return HStack {
            Button(action: open) { FoodRow(food: food, serving: serving) }
                .buttonStyle(.plain)
            if let onAdd {
                Button("Add \(food.name)", systemImage: "plus") { onAdd(FoodPortion(food, serving: serving)) }
                    .labelStyle(.iconOnly)
                    .buttonStyle(.glass)
                    .buttonBorderShape(.circle)
                    .controlSize(.small)
            }
        }
        .listRowBackground(Theme.surface)
    }

    private func deleteButton(_ item: Item, title: String = "Delete") -> some View {
        Button(title, systemImage: "trash") { pendingDelete = item }.tint(Theme.destructive)
    }

    private func favorite(_ portion: FoodPortion) {
        store.addFavorite(portion)
        favorited.toggle()
    }

    @ViewBuilder
    private var emptyState: some View {
        let isEmpty = switch tab {
        case .recipes: LibraryFilter.recipes(recipes, matching: query).isEmpty
        case .foods: LibraryFilter.foods(foods, matching: query).isEmpty
        case .favorites: LibraryFilter.favorites(favorites, matching: query).isEmpty
        }
        if isEmpty {
            if !query.isEmpty {
                ContentUnavailableView("No \(tab.rawValue.lowercased()) match this filter", systemImage: "magnifyingglass")
            } else {
                switch tab {
                case .recipes:
                    ContentUnavailableView("No recipes yet", systemImage: "frying.pan", description: Text("Use the + above to add recipes."))
                case .foods:
                    ContentUnavailableView("No custom foods yet", systemImage: "carrot", description: Text("Use the + above to create a food."))
                case .favorites:
                    ContentUnavailableView(
                        "No favorites yet", systemImage: "heart",
                        description: Text("A favorite saves a food at a serving. Long-press a food or recipe and choose Favorite.")
                    )
                }
            }
        }
    }

    private var deleteTitle: String {
        switch pendingDelete {
        case .food: "Delete Custom Food"
        case .recipe: "Delete Recipe"
        case .favorite: "Delete Favorite?"
        case nil: ""
        }
    }

    private var deleteMessage: String {
        switch pendingDelete {
        case let .food(food): "Are you sure you want to delete \(food.name)? Logged entries keep their copy. This action cannot be undone."
        case let .recipe(recipe): "Are you sure you want to delete \(recipe.name)? Logged entries keep their copy. This action cannot be undone."
        case let .favorite(favorite): "\(favorite.food.name) will be removed from your favorites."
        case nil: ""
        }
    }
}
