import SwiftUI

/// The pencil's sheet over the timeline: the entry's calories and macros, Remove, Favorite, and Duplicate, its amount
/// and time, the share of the day's targets it uses, and its nutrients. Done saves the amount and time.
struct EntryEditor: View {
    let entry: FoodEntry

    @Environment(LocalStore.self) private var store
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
        NutrientTargets(
            target: NutritionPlan.effective(on: entry.day, in: plans)?.target(on: entry.day), goals: goals, day: entry.day,
            sex: settings.profile.sex, weightKg: weight?.weightKg ?? settings.profile.bodyWeightKg
        )
    }

    var body: some View {
        NavigationStack {
            Form {
                Section { MacroHeader(amounts: amounts) }
                Section { actions }
                Section("Amount") {
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
                    DatePicker("Time", selection: $time, displayedComponents: .hourAndMinute)
                }
                if targets.target != nil {
                    Section("Impact on Targets") { ImpactRings(amounts: amounts, targets: targets) }
                }
                ForEach(NutrientSection.allCases) { section in
                    let shown = section.nutrients.filter { amounts.amount(of: $0.id) != nil }
                    if !shown.isEmpty {
                        Section(section.rawValue) {
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
                    Button(role: .confirm) { save() }
                        .disabled(!((Double(quantity.replacingOccurrences(of: ",", with: ".")) ?? 0) > 0))
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
                store.log([FoodPortion(entry.food, serving: serving)], on: entry.day, minute: minute)
                dismiss()
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
                Text(title).font(AppFont.caption(12))
            }
            .frame(maxWidth: .infinity)
        }
        .foregroundStyle(Theme.textPrimary)
    }

    private var minute: Int { time.minuteOfDay() }

    private func save() {
        let serving = serving
        let minute = minute
        store.editEntry(entry.id) {
            $0.serving = serving
            $0.minute = minute
        }
        dismiss()
    }
}

/// Big calories, then protein, fat, and carbs with each one's share of the calories.
private struct MacroHeader: View {
    let amounts: NutrientAmounts

    var body: some View {
        let kcal = amounts[.energy] ?? 0
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 0) {
                Text("\(Int(kcal.rounded()))").font(AppFont.number(30))
                Text("Calories").font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
            }
            Spacer()
            ForEach([(NutrientID.protein, 4.0), (.fat, 9.0), (.carbs, 4.0)], id: \.0) { id, kcalPerGram in
                let grams = amounts[id] ?? 0
                let nutrient = NutrientRegistry.nutrient(id)!
                VStack(spacing: 2) {
                    Text(kcal > 0 ? "\(Int((grams * kcalPerGram / kcal * 100).rounded()))%" : "–")
                        .font(AppFont.headline(11))
                        .foregroundStyle(.black)
                        .padding(.horizontal, 6)
                        .background(nutrient.color, in: Capsule())
                    Text(NutritionFormat.amount(grams)).font(AppFont.number(18))
                    Text(nutrient.name).font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
                }
                .frame(width: 64)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// Four rings: the percent of the day's calorie and macro targets this entry uses.
private struct ImpactRings: View {
    let amounts: NutrientAmounts
    let targets: NutrientTargets

    var body: some View {
        HStack {
            ForEach(NutrientID.macros, id: \.self) { id in
                let nutrient = NutrientRegistry.nutrient(id)!
                let target = targets.range(id).target ?? 0
                let share = target > 0 ? (amounts[id] ?? 0) / target : 0
                VStack(spacing: 6) {
                    Gauge(value: min(1, share)) {
                        EmptyView()
                    } currentValueLabel: {
                        Text("\(Int((share * 100).rounded()))%").font(AppFont.caption(12))
                    }
                    .gaugeStyle(.accessoryCircularCapacity)
                    .tint(nutrient.color)
                    Text(id == .energy ? "Calories" : nutrient.name).font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
                }
                .frame(maxWidth: .infinity)
            }
        }
    }
}
