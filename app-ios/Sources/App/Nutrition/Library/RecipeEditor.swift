import SwiftUI

/// Create Recipe and Edit Recipe: MacroFactor's "Build your recipe" and "Preparation" steps (§6.2) in one Form,
/// with the derived nutrition per serving or for the whole recipe as the ingredients change. `onCreate` hears about a
/// new recipe, and `onCreateAndAdd` adds the logger's "Create & Add".
struct RecipeEditor: View {
    private let recipeID: UUID?
    private let onCreate: ((Recipe) -> Void)?
    private let onCreateAndAdd: ((Recipe) -> Void)?
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.ingredientPicker) private var ingredientPicker
    @State private var draft: RecipeDraft
    @State private var showErrors = false
    @State private var choosingIcon = false
    @State private var addingIngredient = false
    @State private var confirmingDelete = false
    @State private var perServing = true
    @State private var showAllNutrients = false
    @FocusState private var focus: RecipeDraft.Field?

    init(recipe: Recipe? = nil, draft: RecipeDraft? = nil, onCreate: ((Recipe) -> Void)? = nil, onCreateAndAdd: ((Recipe) -> Void)? = nil) {
        recipeID = recipe?.id
        self.onCreate = onCreate
        self.onCreateAndAdd = onCreateAndAdd
        _draft = State(initialValue: draft ?? recipe.map(RecipeDraft.init) ?? RecipeDraft())
    }

    var body: some View {
        let issues = showErrors ? draft.issues : [:]
        let preview = draft.preview
        NavigationStack {
            Form {
                build(issues, preview: preview)
                ingredients(issues)
                nutrition(preview)
                if showAllNutrients {
                    NutrientBreakdown(amounts: perServing ? preview.nutrition.nutrients : RecipeMath.total(preview.ingredients), showAll: true)
                }
                preparation(issues)
                steps
                if recipeID != nil {
                    ThemedSection {
                        Button("Delete Recipe", systemImage: "trash", role: .destructive) { confirmingDelete = true }
                            .foregroundStyle(Theme.destructive)
                    }
                }
            }
            .themedList()
            .scrollDismissesKeyboard(.interactively)
            .focusToolbar(draft.focusOrder, focus: $focus)
            .detailTitle(recipeID == nil ? "Create Recipe" : "Edit Recipe")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(role: .confirm) { save(adding: false) }
                }
                if onCreateAndAdd != nil {
                    ToolbarItem(placement: .bottomBar) {
                        Button("Create & Add") { save(adding: true) }
                    }
                }
            }
            .sheet(isPresented: $choosingIcon) { FoodIconPicker(selection: $draft.icon) }
            .sheet(isPresented: $addingIngredient) {
                ingredientPicker.content(recipeID) { draft.ingredients.append(RecipeDraft.Ingredient(RecipeIngredient($0))) }
            }
            .confirmationDialog("Delete Recipe", isPresented: $confirmingDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) {
                    if let recipeID { store.deleteRecipe(recipeID) }
                    dismiss()
                }
            } message: {
                Text("Are you sure you want to delete \(draft.name)? Logged entries keep their copy. This action cannot be undone.")
            }
        }
    }

    private func build(_ issues: [RecipeDraft.Field: String], preview: Recipe) -> some View {
        ThemedSection(
            "Recipe",
            footer: preview.cookedGrams.map { "Per serving weight will be \(NutritionFormat.amount($0 / preview.servings)) g. Total Weight is the weight of all servings combined, after cooking; blank uses the ingredients' weight." }
                ?? "Weight for all servings this recipe makes combined."
        ) {
            HStack(spacing: 12) {
                FoodIcon(icon: draft.icon, source: .recipe, size: 36)
                RowLabel(
                    title: draft.name.isEmpty ? "Your New Recipe" : draft.name,
                    detail: Text("\(Text(macroLine: preview.nutrition.nutrients)) · \(servingLabel(preview))")
                )
                Spacer()
                Button("Edit Icon") { choosingIcon = true }
                    .buttonStyle(.bordered)
                    .buttonBorderShape(.capsule)
                    .controlSize(.small)
            }
            TextField("Recipe Name", text: $draft.name)
                .focused($focus, equals: .name)
                .accessibilityLabel("Recipe Name")
            FieldIssue(issues[.name])
            LabeledContent("Serving Quantity") {
                TextField("1", text: $draft.servings)
                    .keyboardType(.decimalPad)
                    .focused($focus, equals: .servings)
                    .multilineTextAlignment(.trailing)
                    .accessibilityLabel("Serving Quantity")
            }
            FieldIssue(issues[.servings])
            LabeledContent("Total Weight") {
                HStack(spacing: 4) {
                    TextField(draft.ingredientGrams > 0 ? NutritionFormat.amount(draft.ingredientGrams) : "Weight after cooking", text: $draft.totalWeight)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                        .focused($focus, equals: .totalWeight)
                        .accessibilityLabel("Total Weight in grams")
                    Text("g").foregroundStyle(Theme.textSecondary)
                }
            }
            FieldIssue(issues[.totalWeight])
        }
    }

    private func ingredients(_ issues: [RecipeDraft.Field: String]) -> some View {
        ThemedSection("Ingredients", subtitle: "Weight of ingredients is \(NutritionFormat.amount(draft.ingredientGrams)) g") {
            ForEach($draft.ingredients) { $ingredient in
                IngredientRow(ingredient: $ingredient, focus: $focus)
                FieldIssue(issues[.ingredientQuantity(ingredient.id)])
            }
            .onDelete { draft.ingredients.remove(atOffsets: $0) }
            .onMove { draft.ingredients.move(fromOffsets: $0, toOffset: $1) }
            Button("Add Ingredient", systemImage: "plus") { addingIngredient = true }
            FieldIssue(issues[.ingredients])
        }
    }

    private func nutrition(_ preview: Recipe) -> some View {
        ThemedSection("Nutrition") {
            Picker("Nutrition Per", selection: $perServing) {
                Text("Serving").tag(true)
                Text("Recipe").tag(false)
            }
            .pickerStyle(.segmented)
            MacroSummary(
                amounts: perServing ? preview.nutrition.nutrients : RecipeMath.total(preview.ingredients),
                caption: perServing ? "Per \(servingLabel(preview))" : "For \(NutritionFormat.quantity(preview.servings)) servings"
            )
            Toggle("Show all nutrients", isOn: $showAllNutrients).tint(Theme.accent)
        }
    }

    private func preparation(_ issues: [RecipeDraft.Field: String]) -> some View {
        ThemedSection("Preparation") {
            minutesField("Preparation Time", text: $draft.prepMinutes, field: .prepMinutes)
            FieldIssue(issues[.prepMinutes])
            minutesField("Cooking Time", text: $draft.cookMinutes, field: .cookMinutes)
            FieldIssue(issues[.cookMinutes])
            TextField("Link to the recipe", text: $draft.link)
                .keyboardType(.URL)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .focused($focus, equals: .link)
                .accessibilityLabel("Link")
            FieldIssue(issues[.link])
            VStack(alignment: .trailing, spacing: 4) {
                TextField("Describe the recipe", text: limited($draft.notes, to: RecipeDraft.notesLimit), axis: .vertical)
                    .lineLimit(3...10)
                    .accessibilityLabel("Description")
                Text("\(draft.notes.count)/\(RecipeDraft.notesLimit)").font(AppFont.caption(11)).foregroundStyle(Theme.textTertiary)
            }
        }
    }

    private var steps: some View {
        ThemedSection("Steps") {
            ForEach(Array($draft.steps.enumerated()), id: \.element.id) { index, $step in
                VStack(alignment: .leading, spacing: 4) {
                    Text("Step \(index + 1)").font(AppFont.headline(13)).foregroundStyle(Theme.textSecondary)
                    TextField("Describe this step", text: limited($step.text, to: RecipeDraft.stepLimit), axis: .vertical)
                        .lineLimit(1...8)
                        .accessibilityLabel("Step \(index + 1)")
                }
            }
            .onDelete { draft.steps.remove(atOffsets: $0) }
            .onMove { draft.steps.move(fromOffsets: $0, toOffset: $1) }
            Button("Add Step", systemImage: "plus") { draft.steps.append(RecipeDraft.Step()) }
        }
    }

    private func minutesField(_ title: String, text: Binding<String>, field: RecipeDraft.Field) -> some View {
        LabeledContent(title) {
            HStack(spacing: 4) {
                TextField("0", text: text)
                    .keyboardType(.numberPad)
                    .focused($focus, equals: field)
                    .multilineTextAlignment(.trailing)
                    .accessibilityLabel(title)
                Text("min").foregroundStyle(Theme.textSecondary)
            }
        }
    }

    private func limited(_ text: Binding<String>, to limit: Int) -> Binding<String> {
        Binding { text.wrappedValue } set: { text.wrappedValue = String($0.prefix(limit)) }
    }

    private func servingLabel(_ recipe: Recipe) -> String {
        NutritionFormat.serving(FoodPortion(recipe.snapshot).serving, of: recipe.snapshot)
    }

    private func save(adding: Bool) {
        showErrors = true
        guard let valid = draft.valid else { return }
        if let recipeID {
            store.editRecipe(recipeID) { valid.write(into: &$0) }
        } else {
            let recipe = valid.newRecipe()
            store.saveRecipe(recipe)
            onCreate?(recipe)
            if adding { onCreateAndAdd?(recipe) }
        }
        dismiss()
    }
}

extension RecipeDraft {
    /// The fields top to bottom, through each ingredient's quantity; the description and steps take returns, so the
    /// keyboard bar stops before them.
    var focusOrder: FocusOrder<Field> {
        FocusOrder([.name, .servings, .totalWeight] + ingredients.map { .ingredientQuantity($0.id) } + [.prepMinutes, .cookMinutes, .link])
    }
}

/// An ingredient with its quantity typed in place and its measure picked from the food's measures. Switching the
/// measure converts the quantity, so the amount stays the same.
private struct IngredientRow: View {
    @Binding var ingredient: RecipeDraft.Ingredient
    let focus: FocusState<RecipeDraft.Field?>.Binding

    var body: some View {
        let food = ingredient.value.food
        HStack(spacing: 10) {
            FoodIcon(food: food)
            RowLabel(title: food.displayName, detail: Text(macroLine: food.amounts(ingredient.value.serving)))
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
            TextField("1", text: Binding { ingredient.quantity } set: { ingredient.type($0) })
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .frame(width: 56)
                .focused(focus, equals: .ingredientQuantity(ingredient.id))
                .accessibilityLabel("\(food.name) quantity")
            Picker("\(food.name) measure", selection: measure) {
                ForEach(food.nutrition.allMeasures, id: \.name) { Text($0.name).tag($0.name) }
            }
            .labelsHidden()
            .fixedSize()
        }
    }

    private var measure: Binding<String> {
        Binding { ingredient.value.serving.measure.name } set: { name in
            guard let target = ingredient.value.food.nutrition.allMeasures.first(where: { $0.name == name }) else { return }
            ingredient.switchMeasure(to: target)
        }
    }
}
