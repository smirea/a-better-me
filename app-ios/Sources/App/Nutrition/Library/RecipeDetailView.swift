import GRDB
import Feedback
import SwiftUI

extension Recipe {
    static func one(_ id: UUID) -> DatabaseQuery<Recipe?> {
        DatabaseQuery(nil) { try Recipe.fetchOne($0, key: Recipe.key(id)) }
    }
}

/// A recipe's page in the library: per-serving nutrition, the ingredients, and the steps, flat. Favorite is the toolbar's
/// heart, and Prepare, Add to Shopping List, Edit, Duplicate, and Delete sit in its Recipe Options menu.
struct RecipeDetailView: View {
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.summaryNutrients) private var columns
    @Observe private var recipe: Recipe?
    @State private var sheet: LibraryEditorSheet?
    @State private var confirmingDelete = false
    /// The favorite this page saved, which a second tap removes.
    @State private var favorite: UUID?
    @State private var preparing = false
    @AppStorage(RecipeNutrientsScope.storageKey) private var nutrientsScope = RecipeNutrientsScope.serving
    @State private var shopping = false

    init(recipeID: UUID) {
        _recipe = Observe(Recipe.one(recipeID))
    }

    var body: some View {
        if let recipe {
            content(recipe).feedback(self)
        } else {
            // Deleting from the editor sheet leaves this page behind; it pops once its recipe is gone.
            ContentUnavailableView("Recipe deleted", systemImage: "trash")
                .onAppear { dismiss() }
        }
    }

    private func content(_ recipe: Recipe) -> some View {
        let portion = FoodPortion(recipe.snapshot)
        return Form {
            ThemedSection {
                HStack(spacing: 12) {
                    FoodIcon(food: recipe.snapshot, size: 44)
                    Spacer(minLength: 0)
                    MealRatingBadge(title: recipe.name, amounts: portion.amounts)
                }
                MacroSummary(amounts: portion.amounts, caption: "Per \(NutritionFormat.serving(portion.serving, of: portion.food))")
            }
            ThemedSection("Details") {
                LabeledContent("Makes", value: "\(NumberText.plain(recipe.servings)) \(recipe.servings == 1 ? "serving" : "servings")")
                if let cookedGrams = recipe.cookedGrams {
                    LabeledContent("Total Weight", value: "\(NutritionFormat.amount(cookedGrams)) g")
                }
                if let perGram = RecipeMath.perGram(recipe) {
                    LabeledContent("Per 100 g") { Text(macroLine: perGram.scaled(by: 100), columns: columns) }
                }
                if let prep = recipe.prepMinutes { LabeledContent("Preparation Time", value: "\(prep) min") }
                if let cook = recipe.cookMinutes { LabeledContent("Cooking Time", value: "\(cook) min") }
                if let link = recipe.link, let url = URL(string: link) {
                    Link(destination: url) { Label(url.host() ?? link, systemImage: "link") }
                }
                if !recipe.notes.isEmpty { Text(recipe.notes).font(AppFont.body(15)) }
            }
            IngredientsSection(recipe.ingredients)
            if !recipe.steps.isEmpty {
                StepsSection(steps: recipe.steps)
            }
            NutrientBreakdown(amounts: nutrientsScope == .serving ? recipe.nutrition.nutrients : RecipeMath.total(recipe.ingredients)) {
                RecipeNutrientsScopePicker(scope: $nutrientsScope)
            }
        }
        .flatList()
        .nutrientTableList()
        .listSectionSpacing(.compact)
        .contentMargins(.top, 0, for: .scrollContent)
        .detailTitle(recipe.name)
        .toolbar { toolbar(recipe, portion: portion) }
        .sheet(item: $sheet) { $0.editor }
        .navigationDestination(isPresented: $preparing) { RecipePrepareView(recipe: recipe) }
        .sheet(isPresented: $shopping) { AddToShoppingListSheet(recipe: recipe, ingredients: recipe.ingredients) }
        .sensoryFeedback(.success, trigger: favorite) { _, new in new != nil }
        .alert("Delete Recipe", isPresented: $confirmingDelete) {
            Button("Delete", role: .destructive) {
                store.deleteRecipe(recipe.id)
                dismiss()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Logged entries keep their copy.")
        }
    }

    @ToolbarContentBuilder
    private func toolbar(_ recipe: Recipe, portion: FoodPortion) -> some ToolbarContent {
        ToolbarItemGroup(placement: .primaryAction) {
            Button(favorite != nil ? "Remove Favorite" : "Favorite", systemImage: favorite != nil ? "heart.fill" : "heart") {
                if let favorite {
                    store.deleteFavorite(favorite)
                    self.favorite = nil
                } else {
                    let id = UUID()
                    store.addFavorite(portion, id: id)
                    favorite = id
                }
            }
            .foregroundStyle(favorite != nil ? Theme.favorite : Theme.textPrimary)
            Menu("Recipe Options", systemImage: "ellipsis") {
                Button("Prepare", systemImage: "frying.pan") { preparing = true }
                if !recipe.ingredients.isEmpty {
                    Button("Add to Shopping List", systemImage: "cart.badge.plus") { shopping = true }
                }
                Button("Edit", systemImage: "pencil") { sheet = LibraryEditorSheet(.editRecipe(recipe)) }
                Button("Duplicate", systemImage: "plus.square.on.square") {
                    sheet = LibraryEditorSheet(.newRecipe(RecipeDraft(recipe).duplicate()))
                }
                Button("Delete", systemImage: "trash", role: .destructive) { confirmingDelete = true }
            }
        }
    }
}

private struct StepsSection: View {
    let steps: [String]

    var body: some View {
        ThemedSection("Steps") {
            ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    Text("\(index + 1)").font(AppFont.headline(15)).foregroundStyle(Theme.textSecondary)
                    Text(step).font(AppFont.body(15))
                }
            }
        }
    }
}

/// Prepare: MacroFactor's cooking view. The recipe summary per serving, then the ingredients scaled to the servings
/// being cooked, the numbered steps, and the nutrients per serving or for everything being cooked.
struct RecipePrepareView: View {
    let recipe: Recipe
    @State private var servings: Double
    @AppStorage(RecipeNutrientsScope.storageKey) private var nutrientsScope = RecipeNutrientsScope.serving
    @State private var shopping = false

    init(recipe: Recipe) {
        self.recipe = recipe
        _servings = State(initialValue: recipe.servings)
    }

    var body: some View {
        let perServing = recipe.nutrition.nutrients
        let scaled = RecipeMath.scaled(recipe.ingredients, from: recipe.servings, to: servings)
        Form {
            ThemedSection {
                MacroSummary(amounts: perServing, caption: "Per serving")
            }
            IngredientsSection(scaled) {
                Stepper(value: $servings, in: 0.5...100, step: 0.5) {
                    Text("\(NumberText.plain(servings)) \(servings == 1 ? "serving" : "servings")")
                        .font(AppFont.rowTitle)
                }
                .accessibilityValue("\(NumberText.plain(servings)) servings")
            }
            if !recipe.steps.isEmpty {
                StepsSection(steps: recipe.steps)
            }
            NutrientBreakdown(amounts: nutrientsScope == .serving ? perServing : RecipeMath.total(scaled)) {
                RecipeNutrientsScopePicker(scope: $nutrientsScope)
            }
        }
        .flatList()
        .nutrientTableList()
        .listSectionSpacing(.compact)
        .contentMargins(.top, 0, for: .scrollContent)
        .detailTitle(recipe.name)
        .toolbar {
            if !recipe.ingredients.isEmpty {
                ToolbarItem(placement: .primaryAction) {
                    Button("Add to Shopping List", systemImage: "cart.badge.plus") { shopping = true }
                }
            }
        }
        .sheet(isPresented: $shopping) {
            AddToShoppingListSheet(recipe: recipe, ingredients: RecipeMath.scaled(recipe.ingredients, from: recipe.servings, to: servings))
        }
        .feedback(self)
    }
}
