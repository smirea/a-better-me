import Feedback
import SwiftUI

/// The sheet over the timeline: the entry's icon, full name, and meal rating and its calories and macros flat on the
/// sheet, then one card with its amount, day and time, its section in the Sections display, and Remove, Favorite,
/// Duplicate, and Update for a food or Explode for a recipe, then the share of the day's targets it uses, a recipe's
/// ingredients, and its nutrients. A quick add's name is a field and it has no amount, since its one "serving" is all
/// it is. Done saves the amount, a quick add's name, the day, time, and section; Update saves the food at once.
struct EntryEditor: View {
    let entry: FoodEntry

    @Environment(LocalStore.self) private var store
    @Environment(FoodLogState.self) private var state
    @Environment(\.dismiss) private var dismiss
    private var owner = OwnerTargets()
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
    /// A quick add's name as typed, empty for the default so the field shows "Quick Add" as its prompt.
    @State private var title: String
    @FocusState private var naming: Bool
    @State private var choosingIcon = false
    @State private var updating: FoodUpdate?

    init(entry: FoodEntry) {
        self.entry = entry
        _serving = State(initialValue: entry.serving)
        _quantity = State(initialValue: NumberText.plain(entry.serving.quantity))
        _time = State(initialValue: entry.day.date(atMinute: entry.minute))
        _section = State(initialValue: entry.section)
        _food = State(initialValue: entry.food)
        _title = State(initialValue: entry.food.name == FoodSnapshot.quickAddName ? "" : entry.food.name)
        // An altered recipe lists its own alterations, so it needs no recipe.
        let recipeID = entry.food.source == .recipe && entry.alterations == nil ? entry.food.foodID.flatMap(UUID.init(uuidString:)) : nil
        _recipe = Observe(recipeID.map(Recipe.one) ?? DatabaseQuery(nil) { _ in nil })
    }

    private var amounts: NutrientAmounts { food.amounts(serving) }

    /// The food with a quick add's typed name, which Done, Favorite, and Duplicate keep.
    private var named: FoodSnapshot {
        guard food.source == .quickAdd else { return food }
        var named = food
        named.name = FoodSnapshot.quickAddName(title)
        return named
    }

    /// The food's own measures, then the weights and volumes it allows, with the entry's measure kept when the
    /// food no longer lists it.
    private var measures: [Measure] {
        let all = food.nutrition.allMeasures
        return all.contains { $0.name == serving.measure.name } ? all : [serving.measure] + all
    }

    private var settings: AppSettings { owner.settings }

    var body: some View {
        let amounts = self.amounts
        let targets = owner.on(CalendarDay(time))
        NavigationStack {
            Form {
                Section {
                    VStack(alignment: .leading, spacing: 14) {
                        identity(amounts)
                        MacroHeader(amounts: amounts)
                    }
                }
                .listRowBackground(Color.clear.feedback("Header"))
                .listRowInsets(EdgeInsets(top: 0, leading: Theme.margin, bottom: 0, trailing: Theme.margin))
                .listSectionSeparator(.hidden)
                ThemedSection {
                    if food.source != .quickAdd {
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
                    if settings.nutrition.timeline.display == .sections {
                        // The day, time, and section share a row while they fit, since each says which it is.
                        ViewThatFits(in: .horizontal) {
                            HStack {
                                when.labelsHidden()
                                Spacer(minLength: 8)
                                sectionPicker.labelsHidden()
                            }
                            VStack(spacing: 12) {
                                when
                                sectionPicker
                            }
                        }
                    } else {
                        when
                    }
                    actions.listRowInsets(EdgeInsets(top: 10, leading: Theme.margin, bottom: 8, trailing: Theme.margin))
                }
                ImpactGauges(amounts: amounts, day: CalendarDay(time), excluding: entry.id).id(CalendarDay(time))
                IngredientsSection(FoodLog.ingredients(serving, of: entry, recipe: recipe))
                NutrientList(title: "Nutrients", amounts: amounts) { nutrient in
                    NutrientRow(nutrient: nutrient, value: amounts.amount(of: nutrient.id) ?? 0, range: targets.range(nutrient.id))
                }
            }
            .flatList()
            .nutrientTableList()
            .onChange(of: minute) { _, minute in section = sections.section(at: minute).id }
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
    /// one line. A quick add is no food, so it has no icon to edit, and its name belongs to the entry alone, so it is
    /// typed in place.
    @ViewBuilder private func identity(_ amounts: NutrientAmounts) -> some View {
        if food.source == .quickAdd {
            HStack(spacing: 12) {
                FoodIcon(food: food, size: 36)
                TextField(FoodSnapshot.quickAddName, text: $title)
                    .font(AppFont.headline(18))
                    .submitLabel(.done)
                    .focused($naming)
                    .accessibilityLabel("Name")
                MealRatingBadge(title: named.name, amounts: amounts)
            }
        } else {
            HStack(spacing: 12) {
                FoodIcon(food: food, size: 36).editsIcon { choosingIcon = true }
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
                MealRatingBadge(title: food.name, amounts: amounts)
            }
        }
    }

    private var when: some View {
        DatePicker(
            "Date & Time", selection: $time,
            in: CalendarDay.today.adding(days: DayPaging.offsets.lowerBound).date...CalendarDay.today.adding(days: DayPaging.offsets.upperBound).date(atMinute: 24 * 60 - 1),
            displayedComponents: [.date, .hourAndMinute]
        )
    }

    private var sectionPicker: some View {
        Picker("Section", selection: Binding(get: { sections.section(of: section, minute: minute).id }, set: { section = $0 })) {
            ForEach(sections) { Text($0.name).tag($0.id) }
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
                    store.addFavorite(FoodPortion(named, serving: serving), alterations: entry.alterations, id: id)
                    favorite = id
                }
            }
            action("Duplicate", systemImage: "plus.square.on.square") {
                state.expectAdditions()
                var copy = entry.copy(day: CalendarDay(time), minute: minute, section: section)
                copy.food = named
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
        let food = named
        let serving = serving
        let day = CalendarDay(time)
        let minute = minute
        let section = section
        store.edit(FoodEntry.self, id: entry.id) {
            if food.source == .quickAdd { $0.food.name = food.name }
            $0.serving = serving
            $0.day = day
            $0.minute = minute
            $0.section = section
        }
    }
}
