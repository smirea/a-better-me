import SwiftUI

/// Your Plate (`log-04-your-plate.jpg`): each food with its quantity chip, the plate's nutrition alone or with the
/// day's as four tiles, every nutrient on request, and Log Foods. A row opens its food detail; its chip edits the
/// amount in place with the quantity keypad, as MacroFactor's does.
struct PlateView: View {
    let session: LoggerSession
    let open: (UUID) -> Void
    @Observe(NutritionPlan.all) private var plans
    @Observe<[FoodEntry]> private var entries: [FoodEntry]
    @Observe<NutritionDay> private var dayRow: NutritionDay
    @State private var withDay = false
    @State private var allNutrients = false
    @State private var editing: UUID?

    init(session: LoggerSession, open: @escaping (UUID) -> Void) {
        self.session = session
        self.open = open
        _entries = Observe(FoodEntry.on(session.time.day))
        _dayRow = Observe(NutritionDay.one(session.time.day))
    }

    var body: some View {
        let plate = session.plate.totals
        let day = dayRow.totals(entries)
        let target = NutritionPlan.effective(on: session.time.day, in: plans)?.target(on: session.time.day)
        List {
            ThemedSection("Your Plate") {
                ForEach(session.plate.items) { item in
                    row(item)
                }
                .onDelete { offsets in
                    for id in offsets.map({ session.plate.items[$0].id }) {
                        session.plate.remove(id)
                        if editing == id { editing = nil }
                    }
                }
            }
            Section {
                Grid(horizontalSpacing: 8, verticalSpacing: 8) {
                    GridRow {
                        tile(.energy, plate: plate, day: day, target: target)
                        tile(.protein, plate: plate, day: day, target: target)
                    }
                    GridRow {
                        tile(.fat, plate: plate, day: day, target: target)
                        tile(.carbs, plate: plate, day: day, target: target)
                    }
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
            } header: {
                HStack {
                    SectionTitle("Nutrition")
                    Spacer()
                    Picker("Nutrition", selection: $withDay) {
                        Text("Plate").tag(false)
                        Text("Day").tag(true)
                    }
                    .pickerStyle(.segmented)
                    .fixedSize()
                }
            }
            ThemedSection {
                Toggle("Show all nutrients", isOn: $allNutrients).tint(Theme.accent)
                if allNutrients {
                    let total = withDay ? day + plate : plate
                    ForEach(NutrientSection.allCases.dropFirst().flatMap(\.nutrients).filter { total.amount(of: $0.id) != nil }) { nutrient in
                        LabeledContent(nutrient.name, value: NutritionFormat.amount(total.amount(of: nutrient.id) ?? 0, nutrient.unit))
                    }
                }
            }
        }
        .themedList()
        .overlay {
            if session.plate.isEmpty {
                ContentUnavailableView("Your plate is empty", systemImage: "fork.knife", description: Text("Add foods from Search, Scan, Quick Add, or Library."))
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if let editing, let item = session.plate.item(editing) {
                PlateServingEditor(session: session, item: item, done: { self.editing = nil })
                    .id(editing)
            } else {
                HStack {
                    Spacer()
                    LogFoodsButton(session: session).controlSize(.large)
                }
                .padding(.horizontal, Theme.margin)
                .padding(.bottom, 8)
            }
        }
        .animation(.snappy, value: editing)
        .detailTitle("Your Plate")
    }

    private func row(_ item: Plate.Item) -> some View {
        let portion = item.pick.portion
        return HStack(spacing: 12) {
            Button {
                editing = nil
                open(item.id)
            } label: {
                HStack(spacing: 12) {
                    FoodIcon(food: portion.food)
                    RowLabel(title: portion.food.displayName, detail: Text(macroLine: portion.amounts))
                        .lineLimit(2)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            Button { editing = editing == item.id ? nil : item.id } label: {
                QuantityChip(serving: portion.serving, isActive: editing == item.id)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(portion.food.name) amount")
            .accessibilityValue(NutritionFormat.serving(portion.serving))
        }
    }

    private func tile(_ id: NutrientID, plate: NutrientAmounts, day: NutrientAmounts, target: DayTarget?) -> some View {
        let goal = target?.amount(id)
        let unit = id == .energy ? "kcal" : "g"
        let amount = (withDay ? day[id] ?? 0 : 0) + (plate[id] ?? 0)
        let caption = withDay ? "\(Int(amount.rounded()))\(goal.map { " / \(Int($0.rounded()))" } ?? "") \(unit) with plate" : "\(NutritionFormat.amount(amount)) \(unit) in plate"
        return VStack(alignment: .leading, spacing: 6) {
            Text(id == .energy ? "Calories" : NutrientRegistry.nutrient(id)?.name ?? id.rawValue).font(AppFont.rowTitle)
            Text(caption).font(AppFont.caption()).foregroundStyle(Theme.textSecondary).lineLimit(1).minimumScaleFactor(0.8)
            ProgressView(value: goal.map { min(1, amount / max($0, 1)) } ?? 0)
                .progressViewStyle(.bar(id.color))
                .padding(.top, 6)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: .rect(cornerRadius: Theme.smallCornerRadius))
        .accessibilityElement(children: .combine)
    }
}

/// A plate row's amount, "100" over "g", which edits it.
private struct QuantityChip: View {
    let serving: Serving
    let isActive: Bool

    var body: some View {
        VStack(spacing: 0) {
            Text(NutritionFormat.quantity(serving.quantity)).font(AppFont.headline(14)).monospacedDigit()
            Text(serving.measure.name).font(AppFont.caption(11)).lineLimit(1)
        }
        .foregroundStyle(isActive ? Theme.onPrimary : Theme.textPrimary)
        .padding(.horizontal, 10)
        .frame(minWidth: 62, maxWidth: 96, minHeight: 40)
        .background(isActive ? Theme.textPrimary : Theme.surfaceRaised, in: .rect(cornerRadius: Theme.smallCornerRadius))
    }
}

/// The quantity keypad over the plate for one item: Update sets its amount, Log Foods sets it and logs the plate.
private struct PlateServingEditor: View {
    let session: LoggerSession
    let item: Plate.Item
    let done: () -> Void
    @Observe(AppSettings.current) private var settings
    @State private var measure: Measure
    @State private var quantity: QuantityText

    init(session: LoggerSession, item: Plate.Item, done: @escaping () -> Void) {
        self.session = session
        self.item = item
        self.done = done
        _measure = State(initialValue: item.pick.portion.serving.measure)
        _quantity = State(initialValue: QuantityText(item.pick.portion.serving.quantity))
    }

    private var nutrition: FoodNutrition { item.pick.portion.food.nutrition }
    private var serving: Serving { Serving(measure: measure, quantity: quantity.value ?? 0) }

    var body: some View {
        QuantityKeypad(
            quantity: $quantity, measure: measure,
            detail: ServingChoices.detail(serving, nutrition),
            choices: ServingChoices(nutrition, favorites: settings.nutrition.favoriteMeasures, current: measure),
            confirmTitle: "Update",
            choose: { next in
                quantity = QuantityText(serving.converted(to: next).quantity)
                measure = next
            },
            logFoods: {
                session.plate.setServing(serving, of: item.id)
                session.logPlate()
            },
            confirm: {
                session.plate.setServing(serving, of: item.id)
                done()
            }
        )
    }
}
