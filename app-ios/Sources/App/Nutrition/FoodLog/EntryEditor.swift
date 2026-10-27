import SwiftUI

/// The pencil's sheet over the timeline: the entry's calories and macros, Remove, Favorite, Duplicate, and for a
/// recipe Explode, its amount, day, and time, the share of the day's targets it uses, and its nutrients. Done saves the
/// amount, day, and time.
struct EntryEditor: View {
    let entry: FoodEntry

    @Environment(LocalStore.self) private var store
    @Environment(FoodLogState.self) private var state
    @Environment(\.dismiss) private var dismiss
    @Observe(NutritionPlan.all) private var plans
    @Observe(NutrientGoal.all) private var goals
    @Observe(AppSettings.current) private var settings
    @Observe(BodyWeight.latest) private var weight
    @State private var serving: Serving
    @State private var quantity: String
    @State private var time: Date
    @State private var favorited = false

    init(entry: FoodEntry) {
        self.entry = entry
        _serving = State(initialValue: entry.serving)
        _quantity = State(initialValue: NutritionFormat.quantity(entry.serving.quantity))
        _time = State(initialValue: entry.day.date(atMinute: entry.minute))
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
        return NutrientTargets(
            target: NutritionPlan.effective(on: day, in: plans)?.target(on: day), goals: goals, day: day,
            sex: settings.profile.sex, weightKg: weight?.weightKg ?? settings.profile.bodyWeightKg
        )
    }

    var body: some View {
        NavigationStack {
            Form {
                ThemedSection { MacroHeader(amounts: amounts) }
                ThemedSection { actions }
                ThemedSection("Amount") {
                    HStack {
                        TextField("Quantity", text: $quantity)
                            .keyboardType(.decimalPad)
                            .font(AppFont.number(20))
                            .onChange(of: quantity) { _, text in
                                // The unit picker writes the rounded label of an exact conversion; only typing replaces it.
                                guard text != NutritionFormat.quantity(serving.quantity) else { return }
                                if let value = Double(text.replacingOccurrences(of: ",", with: ".")) { serving.quantity = value }
                            }
                        Picker("Unit", selection: Binding(get: { serving.measure }, set: { measure in
                            serving = serving.converted(to: measure)
                            quantity = NutritionFormat.quantity(serving.quantity)
                        })) {
                            ForEach(measures, id: \.self) { Text($0.name).tag($0) }
                        }
                        .labelsHidden()
                    }
                    DatePicker(
                        "Date & Time", selection: $time,
                        in: CalendarDay.today.adding(days: -FoodLogState.daysBack).date...CalendarDay.today.adding(days: FoodLogState.daysAhead).date(atMinute: 24 * 60 - 1),
                        displayedComponents: [.date, .hourAndMinute]
                    )
                }
                ThemedSection("Impact on Targets") { ImpactGauges(amounts: amounts, target: targets.target) }
                ForEach(NutrientSection.allCases) { section in
                    let shown = section.nutrients.filter { amounts.amount(of: $0.id) != nil }
                    if !shown.isEmpty {
                        ThemedSection(section.rawValue) {
                            ForEach(shown) { nutrient in
                                NutrientRow(nutrient: nutrient, value: amounts.amount(of: nutrient.id) ?? 0, range: targets.range(nutrient.id))
                            }
                        }
                    }
                }
            }
            .themedList()
            .detailTitle(entry.food.displayName)
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
    }

    private var actions: some View {
        HStack {
            action("Remove", systemImage: "minus.circle") {
                store.deleteEntries([entry.id])
                dismiss()
            }
            action(favorited ? "Favorited" : "Favorite", systemImage: favorited ? "heart.fill" : "heart") {
                store.addFavorite(FoodPortion(entry.food, serving: serving))
                favorited = true
            }
            .disabled(favorited)
            action("Duplicate", systemImage: "plus.square.on.square") {
                state.expectAdditions()
                store.log([FoodPortion(entry.food, serving: serving)], on: CalendarDay(time), minute: minute)
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

    private func action(_ title: String, systemImage: String, run: @escaping () -> Void) -> some View {
        Button(action: run) {
            VStack(spacing: 6) {
                Image(systemName: systemImage)
                    .font(.system(size: 16, weight: .semibold))
                    .frame(width: 40, height: 40)
                    .background(Theme.surfaceRaised, in: Circle())
                Text(title).font(AppFont.rowDetail)
            }
            .frame(maxWidth: .infinity)
        }
        .foregroundStyle(Theme.textPrimary)
    }

    private var minute: Int { time.minuteOfDay() }

    private var isValid: Bool { (Double(quantity.replacingOccurrences(of: ",", with: ".")) ?? 0) > 0 }

    private func write() {
        let serving = serving
        let day = CalendarDay(time)
        let minute = minute
        store.editEntry(entry.id) {
            $0.serving = serving
            $0.day = day
            $0.minute = minute
        }
    }
}
