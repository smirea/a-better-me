import Feedback
import GRDB
import SwiftUI

/// Alter's ingredients as the owner edits them: each typed quantity, whether it was removed, and what the recipe held.
struct AlterDraft: Equatable {
    struct Row: Identifiable, Equatable {
        var ingredient: RecipeDraft.Ingredient
        /// The recipe's amount at one serving; nil for a food the owner added.
        let original: Serving?
        var isRemoved = false

        var id: UUID { ingredient.id }

        var alteration: IngredientAlteration {
            let eaten = ingredient.value.serving
            let serving: Serving? = isRemoved ? nil : original.map { IngredientAlteration.same($0, eaten) ? $0 : eaten } ?? eaten
            return IngredientAlteration(id: id, food: ingredient.value.food, original: original, serving: serving)
        }
    }

    var rows: [Row]

    init(_ alterations: [IngredientAlteration]) {
        rows = alterations.compactMap { line in
            guard let serving = line.serving ?? line.original else { return nil }
            var ingredient = RecipeIngredient(FoodPortion(line.food, serving: serving))
            ingredient.id = line.id
            return Row(ingredient: RecipeDraft.Ingredient(ingredient), original: line.original, isRemoved: line.serving == nil)
        }
    }

    var alterations: [IngredientAlteration] { rows.map(\.alteration) }
    var isValid: Bool { rows.allSatisfy { $0.isRemoved || $0.ingredient.isValid } }

    /// An added food goes; one of the recipe's stays, struck through, so Restore can bring it back.
    mutating func remove(_ id: UUID) {
        guard let index = rows.firstIndex(where: { $0.id == id }) else { return }
        if rows[index].original == nil { rows.remove(at: index) } else { rows[index].isRemoved = true }
    }

    /// Back to what the recipe holds.
    mutating func restore(_ id: UUID) {
        guard let index = rows.firstIndex(where: { $0.id == id }), let original = rows[index].original else { return }
        var ingredient = rows[index].ingredient.value
        ingredient.serving = original
        rows[index] = Row(ingredient: RecipeDraft.Ingredient(ingredient), original: original)
    }

    mutating func add(_ portion: FoodPortion) {
        rows.append(Row(ingredient: RecipeDraft.Ingredient(RecipeIngredient(portion)), original: nil))
    }
}

/// Alter: one serving of a logged recipe with its ingredients out on the table, to change, remove, or add to. The top
/// holds the recipe's name and its macros as altered, and the day's bars with it counted in, as the logger's banner
/// counts a plate. Saving keeps the entry the recipe's, with the alterations on it (`LocalStore.alter`); the recipe
/// itself is never edited.
struct AlterEntry: View {
    let entry: FoodEntry

    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Observe private var recipe: Recipe?
    /// Nil until the starting list is known: the entry's own alterations, else its recipe's ingredients.
    @State private var opened: AlterDraft?
    @State private var draft = AlterDraft([])
    @State private var adding = false
    @FocusState private var focus: RecipeDraft.Field?

    init(entry: FoodEntry) {
        self.entry = entry
        let id = entry.food.foodID
        _recipe = Observe(DatabaseQuery(nil) { db in try id.flatMap { try Recipe.fetchOne(db, key: $0) } })
        if let alterations = entry.alterations {
            let draft = AlterDraft(alterations)
            _opened = State(initialValue: draft)
            _draft = State(initialValue: draft)
        }
    }

    var body: some View {
        let alterations = draft.alterations
        let perServing = Self.amounts(alterations.isAltered ? alterations.eaten : alterations.originals)
        NavigationStack {
            Form {
                summary(perServing, was: alterations.isAltered ? Self.amounts(alterations.originals) : nil)
                ingredients
            }
            .themedList()
            .scrollDismissesKeyboard(.interactively)
            .focusToolbar(FocusOrder(draft.rows.filter { !$0.isRemoved }.map { .ingredientQuantity($0.id) }), focus: $focus)
            .detailTitle("Alter")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(role: .confirm) {
                        store.alter(entry.id, to: draft.alterations)
                        dismiss()
                    }
                    .disabled(opened == nil || !draft.isValid)
                }
            }
            .sheet(isPresented: $adding) {
                IngredientSearch(recipeID: entry.food.foodID.flatMap(UUID.init(uuidString:))) { draft.add($0) }
            }
        }
        .interactiveDismissDisabled(opened != nil && draft != opened)
        .onChange(of: recipe, initial: true) {
            guard opened == nil, let recipe else { return }
            let draft = AlterDraft(.unaltered(recipe))
            opened = draft
            self.draft = draft
        }
        .feedback(self)
    }

    private static func amounts(_ portions: [FoodPortion]) -> NutrientAmounts {
        portions.reduce(into: NutrientAmounts()) { $0 = $0 + $1.amounts }
    }

    private func summary(_ perServing: NutrientAmounts, was: NutrientAmounts?) -> some View {
        ThemedSection {
            HStack(spacing: 12) {
                FoodIcon(food: entry.food, size: 36)
                VStack(alignment: .leading, spacing: 2) {
                    Text(entry.food.displayName).font(AppFont.rowTitle).foregroundStyle(Theme.textPrimary)
                    Text("1 serving").font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
                }
                Spacer(minLength: 8)
                MealRatingBadge(title: entry.food.displayName, amounts: perServing)
            }
            MacroSummary(amounts: perServing, caption: was.map { "Was \(($0[.energy] ?? 0).wholeText) kcal, \(($0[.protein] ?? 0).wholeText) g protein" })
            PlateDayTotals(day: entry.day, plate: perServing.scaled(by: entry.serving.servings), replacing: entry.id)
                .padding(.vertical, 4)
        }
    }

    private var ingredients: some View {
        ThemedSection("Ingredients", subtitle: "In one serving. Swipe to remove one.") {
            ForEach($draft.rows) { $row in
                Group {
                    if row.isRemoved {
                        RemovedIngredientRow(row: row)
                            .swipeActions {
                                Button("Restore", systemImage: "arrow.uturn.backward") { draft.restore(row.id) }
                                    .tint(Theme.surfaceRaised)
                            }
                    } else {
                        VStack(alignment: .leading, spacing: 4) {
                            IngredientRow(ingredient: $row.ingredient, focus: $focus)
                            change(row)
                        }
                        .swipeActions {
                            Button("Remove", systemImage: "trash") { draft.remove(row.id) }
                                .tint(Theme.destructive)
                            if row.alteration.change == .changed {
                                Button("Reset", systemImage: "arrow.uturn.backward") { draft.restore(row.id) }
                                    .tint(Theme.surfaceRaised)
                            }
                        }
                    }
                }
            }
            Button("Add Food", systemImage: "plus") { adding = true }
                .disabled(opened == nil)
        }
    }

    @ViewBuilder
    private func change(_ row: AlterDraft.Row) -> some View {
        switch (row.alteration.change, row.original) {
        case let (.changed, original?):
            Text("Was \(NutritionFormat.serving(original))").font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
                .padding(.leading, 38)
        case (.added, _):
            Text("Added").font(AppFont.rowDetail).foregroundStyle(Theme.ratingGreen)
                .padding(.leading, 38)
        default:
            EmptyView()
        }
    }
}

/// A recipe ingredient the owner took out: struck through at the recipe's amount, until Restore.
private struct RemovedIngredientRow: View {
    let row: AlterDraft.Row

    var body: some View {
        HStack(spacing: 10) {
            FoodIcon(food: row.ingredient.value.food).opacity(0.5)
            Text(row.ingredient.value.food.displayName).lineLimit(1)
            Spacer(minLength: 8)
            if let original = row.original {
                Text(NutritionFormat.serving(original)).monospacedDigit()
            }
        }
        .font(AppFont.rowTitle)
        .strikethrough()
        .foregroundStyle(Theme.textSecondary)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Removed \(row.ingredient.value.food.displayName)")
        .accessibilityHint("Swipe to restore")
        .feedback(self)
    }
}
