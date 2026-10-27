import SwiftUI

/// What the recipe editor's Add Ingredient opens. MacroFactor opens its logger there, so the logger replaces this
/// with its search through `.environment(\.ingredientPicker, …)`. The default lists the owner's own foods and
/// recipes. `excluding` is the recipe being edited, which cannot contain itself; `add` takes each chosen portion. A
/// tapped row adds it and closes; a row's + adds it and stays, so one trip picks several ingredients.
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
    @State private var added = 0

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
            .ingredientPickerToolbar(added: added)
        }
    }

    private func pickRow(_ food: FoodSnapshot) -> some View {
        let portion = FoodPortion(food)
        return HStack(spacing: 12) {
            Button {
                add(portion)
                dismiss()
            } label: {
                FoodRow(food: food, serving: portion.serving)
            }
            .buttonStyle(.plain)
            AddIngredientButton(name: food.name) {
                add(portion)
                added += 1
            }
        }
    }
}

/// A row's +: adds the ingredient and keeps the picker open.
struct AddIngredientButton: View {
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

extension View {
    /// Close, and once a row's + added something, Done with the count.
    func ingredientPickerToolbar(added: Int) -> some View {
        modifier(IngredientPickerToolbar(added: added))
    }
}

private struct IngredientPickerToolbar: ViewModifier {
    let added: Int
    @Environment(\.dismiss) private var dismiss

    func body(content: Content) -> some View {
        content.toolbar {
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
}
