import SwiftUI

/// What the recipe editor's Add Ingredient opens. MacroFactor opens its logger there, so the logger replaces this
/// with its search through `.environment(\.ingredientPicker, …)`. The default lists the owner's own foods and
/// recipes. `excluding` is the recipe being edited, which cannot contain itself; `add` takes each chosen portion.
struct IngredientPicker: Sendable {
    let content: @MainActor @Sendable (_ excluding: UUID?, _ add: @escaping @MainActor (FoodPortion) -> Void) -> AnyView

    static let library = IngredientPicker { excluding, add in
        AnyView(LibraryIngredientPicker(excluding: excluding, add: add))
    }
}

extension EnvironmentValues {
    @Entry var ingredientPicker = IngredientPicker.library
}

private struct LibraryIngredientPicker: View {
    let excluding: UUID?
    let add: @MainActor (FoodPortion) -> Void
    @Environment(\.dismiss) private var dismiss
    @Observe(Food.library) private var foods
    @Observe(Recipe.library) private var recipes
    @State private var query = ""

    var body: some View {
        let foods = LibraryFilter.foods(foods, matching: query)
        let recipes = LibraryFilter.recipes(recipes.filter { $0.id != excluding }, matching: query)
        NavigationStack {
            List {
                if !foods.isEmpty {
                    ThemedSection("Foods") {
                        ForEach(foods) { food in
                            pickRow(food.snapshot)
                        }
                    }
                }
                if !recipes.isEmpty {
                    ThemedSection("Recipes") {
                        ForEach(recipes) { recipe in
                            pickRow(recipe.snapshot)
                        }
                    }
                }
            }
            .themedList()
            .overlay {
                if foods.isEmpty, recipes.isEmpty {
                    if query.isEmpty {
                        ContentUnavailableView("No foods yet", systemImage: "fork.knife", description: Text("Create a custom food to use it as an ingredient."))
                    } else {
                        ContentUnavailableView.search(text: query)
                    }
                }
            }
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Filter foods and recipes")
            .detailTitle("Add Ingredient")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
            }
        }
    }

    private func pickRow(_ food: FoodSnapshot) -> some View {
        let portion = FoodPortion(food)
        return Button {
            add(portion)
            dismiss()
        } label: {
            FoodRow(food: food, serving: portion.serving)
        }
        .buttonStyle(.plain)
    }
}
