import SwiftUI

extension IngredientPicker {
    /// The recipe editor's Add Ingredient over the logger's search, so an ingredient can be any USDA or Open Food Facts
    /// food, as MacroFactor opens its logger there. The logger installs it for the library it embeds.
    static let search = IngredientPicker { excluding, add in
        AnyView(IngredientSearch(excluding: excluding, add: add))
    }
}

private struct IngredientSearch: View {
    let excluding: UUID?
    let add: @MainActor (FoodPortion) -> Void
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Observe(AppSettings.current) private var settings
    @State private var session: LoggerSession?
    @State private var query = ""

    var body: some View {
        NavigationStack {
            List {
                if let session {
                    ThemedSection {
                        ForEach(session.results.filter { $0.portion.food.foodID != excluding.map(Recipe.key) }) { result in
                            Button {
                                if let food = result.food { store.saveFood(food) }
                                add(result.portion)
                                dismiss()
                            } label: {
                                FoodRow(food: result.portion.food, serving: result.portion.serving)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    if session.isSearchingBranded {
                        ProgressView().frame(maxWidth: .infinity)
                    }
                }
            }
            .themedList()
            .overlay {
                if let session, session.results.isEmpty, !session.isSearchingBranded {
                    if query.isEmpty {
                        ContentUnavailableView("Search for a food", systemImage: "magnifyingglass", description: Text("Any food can be an ingredient."))
                    } else {
                        ContentUnavailableView.search(text: query)
                    }
                }
            }
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search for a food")
            .onChange(of: query) { session?.setQuery(query, branded: settings.nutrition.searchBranded) }
            .detailTitle("Add Ingredient")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
            }
        }
        .task {
            guard session == nil, let search = try? await FoodSearch.load(store: store) else { return }
            session = LoggerSession(store: store, search: search, start: LoggerStart())
        }
    }
}
