import Feedback
import SwiftUI

/// The recipe editor's Add Ingredient and Swap: the logger's search, so an ingredient can be any USDA or Open Food Facts
/// food, as MacroFactor opens its logger there. Latest, the history at each food's last serving, while the field is
/// empty, otherwise one section per group, so the owner's own foods read apart from the database's. Adding, a tapped
/// row adds it and closes and a row's + adds it and stays, so one trip picks several ingredients. Swapping starts from
/// `RecipeDraft.Ingredient.swapQuery` and a tapped row replaces the ingredient.
struct IngredientSearch: View {
    /// The recipe being edited, which cannot contain itself.
    let recipeID: UUID?
    var swapping: FoodSnapshot?
    let pick: @MainActor (FoodPortion) -> Void
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Observe(AppSettings.current) private var settings
    @State private var session: LoggerSession?
    @State private var query: String
    @State private var added = 0

    init(recipeID: UUID?, swapping: FoodSnapshot? = nil, pick: @escaping @MainActor (FoodPortion) -> Void) {
        self.recipeID = recipeID
        self.swapping = swapping
        self.pick = pick
        _query = State(initialValue: swapping.map(RecipeDraft.Ingredient.swapQuery) ?? "")
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
            .detailTitle(swapping == nil ? "Add Ingredient" : "Swap Ingredient")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
                if added > 0 {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done (\(added))") { dismiss() }
                            .accessibilityLabel("Done, \(added) added")
                    }
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
            HStack(spacing: 12) {
                Button {
                    choose(result)
                    dismiss()
                } label: {
                    FoodRow(food: result.portion.food, serving: result.portion.serving, matching: terms)
                }
                .buttonStyle(.plain)
                if swapping == nil {
                    AddIngredientButton(name: result.portion.food.name) {
                        choose(result)
                        added += 1
                    }
                }
            }
        }
    }

    private func choose(_ result: FoodSearchResult) {
        if let food = result.food { store.saveFood(food) }
        pick(result.portion)
    }

    /// The results without the recipe being edited and the food being swapped out.
    private func choices(_ session: LoggerSession) -> [FoodSearchResult] {
        let excluded = Set([recipeID.map(Recipe.key), swapping.map(FoodSearchResult.key)].compactMap(\.self))
        guard !excluded.isEmpty else { return session.results }
        return session.results.filter { !excluded.contains($0.key) }
    }
}

/// A row's +: adds the ingredient and keeps the search open.
private struct AddIngredientButton: View {
    let name: String
    let add: () -> Void
    @State private var added = 0

    var body: some View {
        RoundIconButton("Add \(name) as an ingredient", systemImage: "plus", size: .small) {
            added += 1
            add()
        }
        .sensoryFeedback(.success, trigger: added)
    }
}
