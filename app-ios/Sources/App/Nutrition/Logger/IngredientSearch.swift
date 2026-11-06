import Feedback
import SwiftUI

extension IngredientPicker {
    /// The recipe editor's Add Ingredient over the logger's search, so an ingredient can be any USDA or Open Food Facts
    /// food, as MacroFactor opens its logger there. The logger installs it for the library it embeds.
    static let search = IngredientPicker { excluding, add in
        AnyView(IngredientSearch(excluding: excluding, add: add))
    }
}

/// The logger's sections: Latest, the history at each food's last serving, while the field is empty, otherwise one
/// per group, so the owner's own foods read apart from the database's.
private struct IngredientSearch: View {
    let excluding: UUID?
    let add: @MainActor (FoodPortion) -> Void
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Observe(AppSettings.current) private var settings
    @State private var session: LoggerSession?
    @State private var query = ""
    @State private var added = 0

    var body: some View {
        NavigationStack {
            List {
                if let session {
                    let terms = FoodText.terms(session.query)
                    if session.query.isEmpty {
                        ThemedSection("Latest") { rows(choices(session), terms) }
                    } else {
                        ForEach(choices(session).grouped, id: \.0) { group, results in
                            ThemedSection(group.title) { rows(results, terms) }
                        }
                    }
                    if session.isSearchingBranded {
                        ThemedSection(FoodSearchGroup.branded.title) {
                            ProgressView().frame(maxWidth: .infinity)
                        }
                    }
                }
            }
            .themedList()
            .overlay {
                if let session, choices(session).isEmpty, !session.isSearchingBranded {
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
            .ingredientPickerToolbar(added: added)
        }
        .task {
            guard session == nil, let search = try? await FoodSearch.load(store: store) else { return }
            session = LoggerSession(store: store, search: search, start: LoggerStart())
        }
        .feedback(self)
    }

    private func rows(_ results: [FoodSearchResult], _ terms: [String]) -> some View {
        ForEach(results) { result in
            HStack(spacing: 12) {
                Button {
                    pick(result)
                    dismiss()
                } label: {
                    FoodRow(food: result.portion.food, serving: result.portion.serving, matching: terms)
                }
                .buttonStyle(.plain)
                AddIngredientButton(name: result.portion.food.name) {
                    pick(result)
                    added += 1
                }
            }
        }
    }

    private func pick(_ result: FoodSearchResult) {
        if let food = result.food { store.saveFood(food) }
        add(result.portion)
    }

    /// The results, without the recipe being edited, which cannot contain itself.
    private func choices(_ session: LoggerSession) -> [FoodSearchResult] {
        guard let excluding else { return session.results }
        return session.results.filter { $0.portion.food.foodID != Recipe.key(excluding) }
    }
}
