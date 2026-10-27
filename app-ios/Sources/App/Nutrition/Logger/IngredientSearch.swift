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
                    ForEach(session.results.filter { $0.portion.food.foodID != excluding.map(Recipe.key) }) { result in
                        Button {
                            if let food = result.food { store.saveFood(food) }
                            add(result.portion)
                            dismiss()
                        } label: {
                            FoodRow(food: result.portion.food, serving: result.portion.serving)
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(Theme.surface)
                    }
                    if session.isSearchingBranded {
                        ProgressView().frame(maxWidth: .infinity)
                    }
                }
            }
            .themedList()
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search for a food")
            .onChange(of: query) { session?.setQuery(query, branded: settings.nutrition.searchBranded) }
            .navigationTitle("Add Ingredient")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", systemImage: "xmark") { dismiss() }
                }
            }
        }
        .task {
            guard session == nil, let search = try? await FoodSearch.load(store: store) else { return }
            session = LoggerSession(store: store, search: search, start: LoggerStart())
        }
    }
}
