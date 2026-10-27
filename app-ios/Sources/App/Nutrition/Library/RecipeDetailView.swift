import GRDB
import SwiftUI

extension Recipe {
    static func one(_ id: UUID) -> DatabaseQuery<Recipe?> {
        DatabaseQuery(nil) { try Recipe.fetchOne($0, key: Recipe.key(id)) }
    }
}

/// A recipe's page in the library: per-serving nutrition, MacroFactor's Prepare, Edit, Favorite, Duplicate, and
/// Delete actions, the ingredients, and the steps.
struct RecipeDetailView: View {
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Observe private var recipe: Recipe?
    @State private var sheet: LibraryEditorSheet?
    @State private var confirmingDelete = false
    @State private var showAllNutrients = false
    @State private var favorited = false
    @State private var preparing = false

    init(recipeID: UUID) {
        _recipe = Observe(Recipe.one(recipeID))
    }

    var body: some View {
        if let recipe {
            content(recipe)
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
                    Text(recipe.name).font(AppFont.title(20))
                }
                MacroSummary(amounts: portion.amounts, caption: "Per \(NutritionFormat.serving(portion.serving, of: portion.food))")
                actions(recipe, portion: portion)
            }
            ThemedSection("Details") {
                LabeledContent("Makes", value: "\(NutritionFormat.quantity(recipe.servings)) \(recipe.servings == 1 ? "serving" : "servings")")
                if let cookedGrams = recipe.cookedGrams {
                    LabeledContent("Total Weight", value: "\(NutritionFormat.amount(cookedGrams)) g")
                }
                if let perGram = RecipeMath.perGram(recipe) {
                    LabeledContent("Per 100 g", value: NutritionFormat.macroLine(perGram.scaled(by: 100)))
                }
                if let prep = recipe.prepMinutes { LabeledContent("Preparation Time", value: "\(prep) min") }
                if let cook = recipe.cookMinutes { LabeledContent("Cooking Time", value: "\(cook) min") }
                if let link = recipe.link, let url = URL(string: link) {
                    Link(destination: url) { Label(url.host() ?? link, systemImage: "link") }
                }
                if !recipe.notes.isEmpty { Text(recipe.notes).font(AppFont.body(15)) }
            }
            ThemedSection("Ingredients") {
                ForEach(recipe.ingredients) { ingredient in
                    FoodRow(food: ingredient.food, serving: ingredient.serving)
                }
            }
            if !recipe.steps.isEmpty {
                StepsSection(steps: recipe.steps)
            }
            ThemedSection {
                Toggle("Show all nutrients", isOn: $showAllNutrients).tint(Theme.accent)
            }
            NutrientBreakdown(amounts: portion.amounts, showAll: showAllNutrients)
        }
        .themedList()
        .detailTitle(recipe.name)
        .sheet(item: $sheet) { $0.editor }
        .navigationDestination(isPresented: $preparing) { RecipePrepareView(recipe: recipe) }
        .sensoryFeedback(.success, trigger: favorited)
        .confirmationDialog("Delete Recipe", isPresented: $confirmingDelete, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                store.deleteRecipe(recipe.id)
                dismiss()
            }
        } message: {
            Text("Are you sure you want to delete \(recipe.name)? Logged entries keep their copy. This action cannot be undone.")
        }
    }

    private func actions(_ recipe: Recipe, portion: FoodPortion) -> some View {
        HStack {
            Button { preparing = true } label: { ActionLabel(title: "Prepare", systemImage: "frying.pan") }
            Button { sheet = LibraryEditorSheet(.editRecipe(recipe)) } label: { ActionLabel(title: "Edit", systemImage: "pencil") }
            Button {
                store.addFavorite(portion)
                favorited.toggle()
            } label: {
                ActionLabel(title: "Favorite", systemImage: "heart")
            }
            Button { sheet = LibraryEditorSheet(.newRecipe(RecipeDraft(recipe).duplicate())) } label: { ActionLabel(title: "Duplicate", systemImage: "plus.square.on.square") }
            Button { confirmingDelete = true } label: { ActionLabel(title: "Delete", systemImage: "trash") }
        }
        .buttonStyle(.borderless)
    }
}

private struct ActionLabel: View {
    let title: String
    let systemImage: String

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: systemImage)
                .font(.system(size: 16, weight: .semibold))
                .frame(width: 40, height: 40)
                .glassEffect(.regular.interactive(), in: .circle)
            Text(title).font(AppFont.caption(11))
        }
        .foregroundStyle(Theme.textPrimary)
        .frame(maxWidth: .infinity)
    }
}

/// The numbered steps.
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

/// Prepare: MacroFactor's cooking view. The recipe summary per serving and in total, then the ingredients scaled to
/// the servings being cooked and the numbered steps.
struct RecipePrepareView: View {
    let recipe: Recipe
    @State private var servings: Double

    init(recipe: Recipe) {
        self.recipe = recipe
        _servings = State(initialValue: recipe.servings)
    }

    var body: some View {
        let perServing = recipe.nutrition.nutrients
        let total = RecipeMath.total(recipe.ingredients)
        Form {
            ThemedSection("Recipe summary") {
                Text(recipe.steps.count == 1 ? "1 step" : "\(recipe.steps.count) steps")
                    .font(AppFont.rowDetail)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Theme.surfaceRaised, in: .capsule)
                Grid(horizontalSpacing: 10, verticalSpacing: 10) {
                    GridRow {
                        summaryTile(.energy, perServing: perServing, total: total)
                        summaryTile(.protein, perServing: perServing, total: total)
                    }
                    GridRow {
                        summaryTile(.fat, perServing: perServing, total: total)
                        summaryTile(.carbs, perServing: perServing, total: total)
                    }
                }
            }
            ThemedSection("Ingredients") {
                Stepper(value: $servings, in: 0.5...100, step: 0.5) {
                    Text("Instructions for \(NutritionFormat.quantity(servings)) \(servings == 1 ? "serving" : "servings")")
                        .font(AppFont.rowTitle)
                }
                .accessibilityValue("\(NutritionFormat.quantity(servings)) servings")
                ForEach(RecipeMath.scaled(recipe.ingredients, from: recipe.servings, to: servings)) { ingredient in
                    FoodRow(food: ingredient.food, serving: ingredient.serving)
                }
            }
            if recipe.steps.isEmpty {
                ThemedSection {
                    Text("No preparation steps are available for this recipe").foregroundStyle(Theme.textSecondary)
                }
            } else {
                StepsSection(steps: recipe.steps)
            }
            ThemedSection {
                Text("The following nutrition is displayed per serving.").font(AppFont.caption(13)).foregroundStyle(Theme.textSecondary)
            }
            .listRowBackground(Color.clear)
            NutrientBreakdown(amounts: perServing)
        }
        .themedList()
        .detailTitle(recipe.name)
    }

    private func summaryTile(_ id: NutrientID, perServing: NutrientAmounts, total: NutrientAmounts) -> some View {
        let unit = id == .energy ? "kcal" : "g"
        return HStack(spacing: 8) {
            Capsule().fill(Theme.macro(id)).frame(width: 4)
            RowLabel(
                title: NutrientRegistry.nutrient(id)?.name ?? "",
                detail: "\(NutritionFormat.amount(perServing[id] ?? 0)) \(unit)/serv, \(NutritionFormat.amount(total[id] ?? 0)) total"
            )
            .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(8)
        .frame(maxWidth: .infinity)
        .background(Theme.surfaceRaised, in: .rect(cornerRadius: Theme.smallCornerRadius))
        .accessibilityElement(children: .combine)
    }
}
