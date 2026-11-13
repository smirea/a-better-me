import Feedback
import SwiftUI

/// The sheet over the timeline: the entry's icon and full name, calories and macros, and amount in one card, then Remove,
/// Favorite, Duplicate, and for a recipe Explode, its day, time, and in the Sections display its section, the share of
/// the day's targets it uses, a recipe's ingredients, and its nutrients. Done saves the amount, day, time, and section.
struct EntryEditor: View {
    let entry: FoodEntry

    @Environment(LocalStore.self) private var store
    @Environment(FoodLogState.self) private var state
    @Environment(\.dismiss) private var dismiss
    @Observe(NutritionPlan.all) private var plans
    @Observe(NutrientGoal.all) private var goals
    @Observe(AppSettings.current) private var settings
    @Observe(BodyWeight.latest) private var weight
    /// A logged recipe's recipe as it is now, which lists the ingredients, as Explode reads them; nil once deleted.
    @Observe private var recipe: Recipe?
    @State private var serving: Serving
    @State private var quantity: String
    @State private var time: Date
    /// The section it is in; changing the time moves it to the section the new minute falls in.
    @State private var section: String?
    /// The favorite this sheet saved, which a second tap removes.
    @State private var favorite: UUID?
    /// The food's icon, which Edit Icon changes on the food and everything logged of it at once (`LocalStore.setIcon`).
    @State private var icon: String?
    @State private var choosingIcon = false
    @State private var nutrientRows = ViewMemo<NutrientAmounts, [NutrientListRow]>()

    init(entry: FoodEntry) {
        self.entry = entry
        _serving = State(initialValue: entry.serving)
        _quantity = State(initialValue: NumberText.plain(entry.serving.quantity))
        _time = State(initialValue: entry.day.date(atMinute: entry.minute))
        _section = State(initialValue: entry.section)
        _icon = State(initialValue: entry.food.icon)
        // An altered recipe lists its own alterations, so it needs no recipe.
        let recipeID = entry.food.source == .recipe && entry.alterations == nil ? entry.food.foodID.flatMap(UUID.init(uuidString:)) : nil
        _recipe = Observe(recipeID.map(Recipe.one) ?? DatabaseQuery(nil) { _ in nil })
    }

    private var food: FoodSnapshot {
        var food = entry.food
        food.icon = icon
        return food
    }

    private var amounts: NutrientAmounts { entry.food.amounts(serving) }

    /// The food's own measures, then the weights and volumes it allows, with the entry's measure kept when the
    /// food no longer lists it.
    private var measures: [Measure] {
        let all = entry.food.nutrition.allMeasures
        return all.contains { $0.name == entry.serving.measure.name } ? all : [entry.serving.measure] + all
    }

    private var targets: NutrientTargets {
        let day = CalendarDay(time)
        return NutrientTargets.of(day, plans: plans, goals: goals, profile: settings.profile, latestWeightKg: weight?.weightKg)
    }

    var body: some View {
        let amounts = self.amounts
        let targets = self.targets
        let reported = entry.food.nutrition.nutrients
        NavigationStack {
            Form {
                ThemedSection {
                    VStack(alignment: .leading, spacing: 14) {
                        identity
                        MacroHeader(amounts: amounts)
                    }
                    .padding(.vertical, 4)
                    HStack {
                        TextField("Quantity", text: $quantity)
                            .keyboardType(.decimalPad)
                            .font(AppFont.number(20))
                            .onChange(of: quantity) { _, text in
                                if let value = Double(text.replacingOccurrences(of: ",", with: ".")) { serving.quantity = value }
                            }
                        Picker("Unit", selection: $serving.measure) {
                            ForEach(measures, id: \.self) { Text($0.name).tag($0) }
                        }
                        .labelsHidden()
                    }
                }
                ThemedSection { actions }
                ThemedSection {
                    DatePicker(
                        "Date & Time", selection: $time,
                        in: CalendarDay.today.adding(days: -FoodLogState.daysBack).date...CalendarDay.today.adding(days: FoodLogState.daysAhead).date(atMinute: 24 * 60 - 1),
                        displayedComponents: [.date, .hourAndMinute]
                    )
                    .onChange(of: minute) { _, minute in section = sections.section(at: minute).id }
                    if settings.nutrition.timeline.display == .sections {
                        Picker("Section", selection: Binding(get: { sections.section(of: section, minute: minute).id }, set: { section = $0 })) {
                            ForEach(sections) { Text($0.name).tag($0.id) }
                        }
                    }
                }
                ImpactGauges(amounts: amounts, day: CalendarDay(time), excluding: entry.id).id(CalendarDay(time))
                EntryIngredients(ingredients: FoodLog.ingredients(serving, of: entry, recipe: recipe))
                NutrientList(title: "Nutrients", rows: nutrientRows(reported) { NutrientListRow.rows { reported.amount(of: $0.id) != nil } }) { nutrient in
                    NutrientRow(nutrient: nutrient, value: amounts.amount(of: nutrient.id) ?? 0, range: targets.range(nutrient.id))
                }
            }
            .themedList()
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(role: .close) { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(role: .confirm) {
                        write()
                        dismiss()
                    }
                    .disabled(!isValid)
                }
            }
        }
        .presentationDetents([.large])
        .sheet(isPresented: $choosingIcon) {
            FoodIconPicker(selection: Binding(get: { icon }, set: { picked in
                icon = picked
                store.setIcon(picked, of: food)
            }))
        }
        .feedback(self)
    }

    /// The icon and the whole name, wrapped: the bar's inline title truncated long food names to one line. A quick add
    /// is no food, so it has no icon to edit.
    private var identity: some View {
        HStack(spacing: 12) {
            let editable = entry.food.source != .quickAdd
            FoodIcon(food: food, size: 36)
                .onTapGesture { if editable { choosingIcon = true } }
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.food.name).font(AppFont.headline(18))
                if let brand = entry.food.brand, !brand.isEmpty {
                    Text(brand).font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
                }
            }
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
            if editable {
                Button("Edit Icon") { choosingIcon = true }
                    .chipButton()
                    .controlSize(.small)
            }
        }
    }

    private var actions: some View {
        HStack {
            action("Remove", systemImage: "minus.circle") {
                store.deleteEntries([entry.id])
                dismiss()
            }
            action(favorite != nil ? "Favorited" : "Favorite", systemImage: favorite != nil ? "heart.fill" : "heart", tint: favorite != nil ? Theme.favorite : nil) {
                if let favorite {
                    store.deleteFavorite(favorite)
                    self.favorite = nil
                } else {
                    let id = UUID()
                    store.addFavorite(FoodPortion(food, serving: serving), id: id)
                    favorite = id
                }
            }
            action("Duplicate", systemImage: "plus.square.on.square") {
                state.expectAdditions()
                var copy = entry.copy(day: CalendarDay(time), minute: minute, section: section)
                copy.food = food
                copy.serving = serving
                store.log([copy])
                dismiss()
            }
            if entry.food.source == .recipe {
                action("Explode", systemImage: "square.grid.3x3.square") {
                    if isValid { write() }
                    state.explode(entry.id, in: store)
                    dismiss()
                }
            }
        }
        .buttonStyle(.borderless)
    }

    private func action(_ title: String, systemImage: String, tint: Color? = nil, run: @escaping () -> Void) -> some View {
        Button(action: run) { ActionLabel(title: title, systemImage: systemImage, tint: tint) }
    }

    private var minute: Int { time.minuteOfDay() }
    private var sections: [MealSection] { settings.nutrition.mealSections }

    private var isValid: Bool { (Double(quantity.replacingOccurrences(of: ",", with: ".")) ?? 0) > 0 }

    private func write() {
        let serving = serving
        let day = CalendarDay(time)
        let minute = minute
        let section = section
        store.edit(FoodEntry.self, id: entry.id) {
            $0.serving = serving
            $0.day = day
            $0.minute = minute
            $0.section = section
        }
    }
}

/// A logged recipe's ingredients at the amount in the editor, drawn as the recipe page draws them. An altered recipe's
/// changed ingredient adds the recipe's amount under it, a removed one is struck through, and an added one is green, as
/// its tile draws them. A recipe with none shows no section.
private struct EntryIngredients: View {
    let ingredients: [IngredientAlteration]

    var body: some View {
        if !ingredients.isEmpty {
            ThemedSection(ingredients.isAltered ? "Ingredients, Altered" : "Ingredients") {
                ForEach(ingredients) { line in
                    switch (line.change, line.original, line.serving) {
                    case let (.removed, original?, _):
                        FoodRow(food: line.food, serving: original)
                            .strikethrough()
                            .opacity(0.5)
                            .accessibilityLabel("Removed \(line.food.displayName), \(NutritionFormat.serving(original))")
                    case let (.changed, original?, eaten?):
                        VStack(alignment: .leading, spacing: 2) {
                            FoodRow(food: line.food, serving: eaten)
                            Text("Was \(NutritionFormat.serving(original))")
                                .font(AppFont.rowDetail)
                                .foregroundStyle(Theme.textSecondary)
                                .padding(.leading, 40)
                        }
                        .accessibilityElement(children: .combine)
                    case let (.added, _, eaten?):
                        FoodRow(food: line.food, serving: eaten, titleColor: Theme.ratingGreen)
                            .accessibilityLabel("Added \(line.food.displayName), \(NutritionFormat.serving(eaten))")
                    case let (_, _, eaten?):
                        FoodRow(food: line.food, serving: eaten)
                    default:
                        EmptyView()
                    }
                }
            }
        }
    }
}
