import Feedback
import SwiftUI

/// The recipe editor's Swap: the logger's search, starting from `RecipeDraft.Ingredient.swapQuery`, so the results are
/// alternatives to the food. A tapped row replaces the ingredient at its amount. Latest, the history at each food's last
/// serving, while the field is empty, otherwise one section per group. Add Ingredient is the logger itself.
struct IngredientSwap: View {
    /// The recipe being edited, which cannot contain itself.
    let recipeID: UUID?
    let swapping: FoodSnapshot
    let pick: @MainActor (FoodPortion) -> Void
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Observe(AppSettings.current) private var settings
    @State private var session: LoggerSession?
    @State private var query: String

    init(recipeID: UUID?, swapping: FoodSnapshot, pick: @escaping @MainActor (FoodPortion) -> Void) {
        self.recipeID = recipeID
        self.swapping = swapping
        self.pick = pick
        _query = State(initialValue: RecipeDraft.Ingredient.swapQuery(swapping))
    }

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
            .flatList()
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
            .detailTitle("Swap Ingredient")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
            }
        }
        .task {
            guard session == nil, let search = try? await FoodSearch.load(store: store) else { return }
            let session = LoggerSession(store: store, search: search, start: LoggerStart())
            if !query.isEmpty { session.setQuery(query, branded: settings.nutrition.searchBranded) }
            self.session = session
        }
        .feedback(self)
    }

    private func rows(_ results: [FoodSearchResult], _ terms: [String]) -> some View {
        ForEach(results) { result in
            Button {
                if let food = result.food { store.saveFood(food) }
                pick(result.portion)
                dismiss()
            } label: {
                FoodRow(food: result.portion.food, serving: result.portion.serving, matching: terms)
            }
            .buttonStyle(.plain)
        }
    }

    /// The results without the recipe being edited and the food being swapped out.
    private func choices(_ session: LoggerSession) -> [FoodSearchResult] {
        let excluded = Set([recipeID.map(Recipe.key), FoodSearchResult.key(swapping)].compactMap(\.self))
        return session.results.filter { !excluded.contains($0.key) }
    }
}
