import SwiftUI

/// The food detail (`log-03-food-detail.jpg`): the serving's calories and macros with each macro's share of calories,
/// Favorite, the impact on the day's targets, every nutrient the food reports, and the quantity keypad pinned under
/// them. A plate item opens here too, with Update and Remove.
struct FoodDetailView: View {
    let session: LoggerSession
    /// The plate item being edited, nil for a food not yet on the plate.
    let editing: UUID?
    let pick: LoggerPick
    @Environment(\.dismiss) private var dismiss
    @Observe(AppSettings.current) private var settings
    @Observe(NutritionPlan.all) private var plans
    @State private var measure: Measure
    @State private var quantity: QuantityText
    @State private var favorited = 0

    init(session: LoggerSession, editing: UUID?, pick: LoggerPick) {
        self.session = session
        self.editing = editing
        self.pick = pick
        _measure = State(initialValue: pick.portion.serving.measure)
        _quantity = State(initialValue: QuantityText(pick.portion.serving.quantity))
    }

    private var food: FoodSnapshot { pick.portion.food }
    private var serving: Serving { Serving(measure: measure, quantity: quantity.value ?? 0) }
    private var portion: FoodPortion { FoodPortion(food, serving: serving) }
    private var amounts: NutrientAmounts { portion.amounts }

    var body: some View {
        List {
            Section {
                header
            }
            Section("Impact on Targets") {
                impact
            }
            ForEach(NutrientGroup.allCases, id: \.self) { group in
                let rows = NutrientRegistry.all.filter { $0.group == group && food.nutrition.nutrients.amount(of: $0.id) != nil }
                if !rows.isEmpty {
                    Section(group.title) {
                        ForEach(rows) { nutrient in
                            LabeledContent(nutrient.name, value: Self.amount(amounts.amount(of: nutrient.id) ?? 0, nutrient.unit))
                        }
                    }
                }
            }
        }
        .themedList()
        .contentMargins(.bottom, 12, for: .scrollContent)
        .navigationTitle(food.name)
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            QuantityKeypad(
                quantity: $quantity, measure: measure,
                detail: ServingChoices.detail(serving, food.nutrition),
                choices: ServingChoices(food.nutrition, favorites: settings.nutrition.favoriteMeasures, current: measure),
                confirmTitle: editing == nil ? "Add" : "Update",
                choose: choose, logFoods: logFoods, confirm: confirm
            )
        }
        .onChange(of: serving, initial: true) {
            if editing == nil { session.pending = portion }
        }
        .onDisappear { session.pending = nil }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 14) {
            if let brand = food.brand, !brand.isEmpty {
                Text(brand).font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
            }
            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 0) {
                    Text("\(Int((amounts[.energy] ?? 0).rounded()))").font(AppFont.number(34))
                    Text("Calories").font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                ForEach([NutrientID.protein, .fat, .carbs], id: \.self) { id in
                    macro(id)
                }
            }
            HStack(spacing: 10) {
                Button {
                    session.favorite(portion, uncached: pick.uncached)
                    favorited += 1
                } label: {
                    Label(favorited > 0 ? "Saved" : "Favorite", systemImage: favorited > 0 ? "heart.fill" : "heart")
                }
                .buttonStyle(.glass)
                .disabled(serving.quantity <= 0)
                .sensoryFeedback(.success, trigger: favorited)
                if let editing {
                    Button("Remove", systemImage: "trash", role: .destructive) {
                        session.plate.remove(editing)
                        dismiss()
                    }
                    .buttonStyle(.glass)
                }
            }
            .font(AppFont.medium(14))
        }
        .padding(.vertical, 6)
    }

    private func macro(_ id: NutrientID) -> some View {
        let kcal = amounts[.energy] ?? 0
        let perGram = id == .fat ? 9.0 : 4
        let share = kcal > 0 ? Int(((amounts[id] ?? 0) * perGram / kcal * 100).rounded()) : 0
        return VStack(spacing: 2) {
            Text("\(share)%")
                .font(AppFont.caption(11))
                .padding(.horizontal, 6)
                .padding(.vertical, 1)
                .background(MacroColor.of(id).opacity(0.35), in: .capsule)
            Text(QuantityText.format(((amounts[id] ?? 0) * 10).rounded() / 10)).font(AppFont.headline(17))
            Text(NutrientRegistry.nutrient(id)?.name ?? id.rawValue).font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
        }
        .frame(width: 64)
    }

    /// Each macro's share of the day's target this serving uses, as MacroFactor's four rings.
    private var impact: some View {
        let target = NutritionPlan.effective(on: session.time.day, in: plans)?.target(on: session.time.day)
        return HStack {
            ForEach([NutrientID.energy, .protein, .fat, .carbs], id: \.self) { id in
                let goal = target?.amount(id) ?? 0
                let share = goal > 0 ? (amounts[id] ?? 0) / goal : 0
                VStack(spacing: 6) {
                    Gauge(value: min(share, 1)) {
                        EmptyView()
                    } currentValueLabel: {
                        Text(goal > 0 ? "\(Int((share * 100).rounded()))%" : "–").font(AppFont.caption(12))
                    }
                    .gaugeStyle(.accessoryCircularCapacity)
                    .tint(MacroColor.of(id))
                    Text(id == .energy ? "Calories" : NutrientRegistry.nutrient(id)?.name ?? "").font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.vertical, 4)
    }

    private func choose(_ next: Measure) {
        let converted = ServingChoices.convert(serving, to: next)
        measure = next
        quantity = QuantityText(converted.quantity)
    }

    private func confirm() {
        putOnPlate()
        dismiss()
    }

    private func logFoods() {
        putOnPlate()
        session.logPlate()
    }

    private func putOnPlate() {
        if let editing {
            session.plate.setServing(serving, of: editing)
        } else {
            session.add(LoggerPick(portion, uncached: pick.uncached))
        }
    }

    static func amount(_ value: Double, _ unit: NutrientUnit) -> String {
        let rounded = value >= 10 ? value.rounded() : (value * 10).rounded() / 10
        return "\(QuantityText.format(rounded)) \(unit.rawValue)"
    }
}

extension NutrientGroup {
    var title: String {
        switch self {
        case .general: "General"
        case .protein: "Protein Breakdown"
        case .carbohydrates: "Carb Breakdown"
        case .fats: "Fat Breakdown"
        case .vitamins: "Vitamins"
        case .minerals: "Minerals"
        }
    }
}

/// MacroFactor's quantity keypad: the quantity and its unit, the unit chips, and keys for digits, a point, a fraction
/// slash, and the space of a mixed number, beside Log Foods and Add. The system keyboard has no "/" or " 1/2".
struct QuantityKeypad: View {
    @Binding var quantity: QuantityText
    let measure: Measure
    let detail: String
    let choices: ServingChoices
    let confirmTitle: String
    let choose: (Measure) -> Void
    let logFoods: () -> Void
    let confirm: () -> Void

    private static let keyHeight: CGFloat = 46

    var body: some View {
        VStack(spacing: 10) {
            HStack {
                Text(quantity.text.isEmpty ? " " : quantity.text)
                    .font(AppFont.number(20))
                    .foregroundStyle(quantity.value == nil ? Theme.textSecondary : Theme.textPrimary)
                    .accessibilityLabel("Quantity")
                    .accessibilityValue(quantity.text)
                Spacer()
                Text(detail).font(AppFont.caption()).foregroundStyle(Theme.textSecondary).lineLimit(1)
            }
            .padding(.horizontal, 14)
            .frame(height: 44)
            .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
            .overlay { RoundedRectangle(cornerRadius: Theme.smallCornerRadius).strokeBorder(Theme.textSecondary.opacity(0.6)) }
            ScrollView(.horizontal) {
                HStack(spacing: 6) {
                    ForEach(choices.units, id: \.self) { chip($0) }
                    if !choices.units.isEmpty, !choices.servings.isEmpty {
                        Divider().frame(height: 24).overlay(Theme.separator)
                    }
                    ForEach(choices.servings, id: \.self) { chip($0) }
                }
            }
            .scrollIndicators(.hidden)
            Grid(horizontalSpacing: 6, verticalSpacing: 6) {
                GridRow { digit(1); digit(2); digit(3); key(.slash, "Fraction") { Text("/") } }
                GridRow { digit(4); digit(5); digit(6); key(.space, "Space") { Image(systemName: "space") } }
                GridRow { digit(7); digit(8); digit(9); key(.backspace, "Delete") { Image(systemName: "delete.left") } }
                GridRow {
                    key(.point, "Point") { Text(".") }
                    digit(0)
                    action("Log Foods", prominent: false, perform: logFoods)
                    action(confirmTitle, prominent: true, perform: confirm)
                }
            }
            .font(AppFont.title(20))
        }
        .padding(.horizontal, 12)
        .padding(.top, 10)
        .padding(.bottom, 4)
        .background(Theme.header)
    }

    private func chip(_ option: Measure) -> some View {
        let selected = option == measure
        return Button { choose(option) } label: {
            Text(option.name)
                .font(AppFont.medium(13))
                .lineLimit(1)
                .padding(.horizontal, 12)
                .frame(height: 32)
                .foregroundStyle(selected ? .black : Theme.textPrimary)
                .background(selected ? Theme.textPrimary : Theme.surfaceRaised, in: .capsule)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func digit(_ value: Int) -> some View {
        key(.digit(value), "\(value)") { Text("\(value)") }
    }

    private func key(_ key: QuantityText.Key, _ label: String, @ViewBuilder content: () -> some View) -> some View {
        Button { quantity.type(key) } label: {
            content()
                .frame(maxWidth: .infinity)
                .frame(height: Self.keyHeight)
                .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 8))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private func action(_ title: String, prominent: Bool, perform: @escaping () -> Void) -> some View {
        Button(action: perform) {
            Text(title)
                .font(AppFont.headline(15))
                .frame(maxWidth: .infinity)
                .frame(height: Self.keyHeight)
                .foregroundStyle(prominent ? .black : Theme.textPrimary)
                .background(prominent ? Theme.textPrimary : Theme.surface, in: RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
        .disabled(quantity.value.map { $0 <= 0 } ?? true)
    }
}
