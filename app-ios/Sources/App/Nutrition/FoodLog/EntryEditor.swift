import Feedback
import SwiftUI

/// The sheet over the timeline: the entry's icon and full name and its calories and macros flat on the sheet, its amount,
/// then Remove, Favorite, Duplicate, and Update for a food or Explode for a recipe, its day, time, and in the Sections
/// display its section, the share of the day's targets it uses, a recipe's ingredients, and its nutrients. Done saves the
/// amount, day, time, and section; Update saves the food at once.
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
    /// The entry's food, which Update corrects and a tap on its icon re-icons on the food and everything logged of it
    /// at once (`LocalStore.setIcon`).
    @State private var food: FoodSnapshot
    @State private var choosingIcon = false
    @State private var updating: FoodUpdate?
    @State private var nutrientRows = ViewMemo<NutrientAmounts, [NutrientListRow]>()

    init(entry: FoodEntry) {
        self.entry = entry
        _serving = State(initialValue: entry.serving)
        _quantity = State(initialValue: NumberText.plain(entry.serving.quantity))
        _time = State(initialValue: entry.day.date(atMinute: entry.minute))
        _section = State(initialValue: entry.section)
        _food = State(initialValue: entry.food)
        // An altered recipe lists its own alterations, so it needs no recipe.
        let recipeID = entry.food.source == .recipe && entry.alterations == nil ? entry.food.foodID.flatMap(UUID.init(uuidString:)) : nil
        _recipe = Observe(recipeID.map(Recipe.one) ?? DatabaseQuery(nil) { _ in nil })
    }

    private var amounts: NutrientAmounts { food.amounts(serving) }

    /// The food's own measures, then the weights and volumes it allows, with the entry's measure kept when the
    /// food no longer lists it.
    private var measures: [Measure] {
        let all = food.nutrition.allMeasures
        return all.contains { $0.name == serving.measure.name } ? all : [serving.measure] + all
    }

    private var targets: NutrientTargets {
        let day = CalendarDay(time)
        return NutrientTargets.of(day, plans: plans, goals: goals, profile: settings.profile, latestWeightKg: weight?.weightKg)
    }

    var body: some View {
        let amounts = self.amounts
        let targets = self.targets
        let reported = food.nutrition.nutrients
        NavigationStack {
            Form {
                Section {
                    VStack(alignment: .leading, spacing: 14) {
                        identity
                        MacroHeader(amounts: amounts)
                    }
                }
                .listRowBackground(Color.clear.feedback("Header"))
                .listRowInsets(EdgeInsets(top: 0, leading: 8, bottom: 0, trailing: 8))
                ThemedSection {
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
                IngredientsSection(FoodLog.ingredients(serving, of: entry, recipe: recipe))
                NutrientList(title: "Nutrients", rows: nutrientRows(reported) { NutrientListRow.rows { reported.amount(of: $0.id) != nil } }) { nutrient in
                    NutrientRow(nutrient: nutrient, value: amounts.amount(of: nutrient.id) ?? 0, range: targets.range(nutrient.id))
                }
            }
            .themedList()
            .nutrientTableList()
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
            FoodIconPicker(selection: Binding(get: { food.icon }, set: { picked in
                food.icon = picked
                store.setIcon(picked, of: food)
            }))
        }
        .sheet(item: $updating) { update in
            FoodEditor(updating: update) { corrected in
                let snapshot = corrected.snapshot
                food = snapshot
                serving = serving.fitted(to: snapshot.nutrition)
                quantity = NumberText.plain(serving.quantity)
                store.edit(FoodEntry.self, id: entry.id) {
                    $0.food = snapshot
                    $0.serving = $0.serving.fitted(to: snapshot.nutrition)
                }
            }
        }
        .feedback(self)
    }

    /// The icon, which a tap re-icons, and the whole name, wrapped: the bar's inline title truncated long food names to
    /// one line. A quick add is no food, so it has no icon to edit.
    private var identity: some View {
        HStack(spacing: 12) {
            if food.source == .quickAdd {
                FoodIcon(food: food, size: 36)
            } else {
                FoodIcon(food: food, size: 36).editsIcon { choosingIcon = true }
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(food.name).font(AppFont.headline(18))
                if let brand = food.brand, !brand.isEmpty {
                    Text(brand).font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
                }
            }
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
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
            switch food.source {
            case .recipe:
                action("Explode", systemImage: "square.grid.3x3.square") {
                    if isValid { write() }
                    state.explode(entry.id, in: store)
                    dismiss()
                }
            case .custom, .usda, .openFoodFacts:
                action("Update", systemImage: "square.and.pencil") {
                    let food = food
                    Task { updating = try? await store.read { try FoodUpdate.of(food, in: $0) } }
                }
            case .quickAdd:
                EmptyView()
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
