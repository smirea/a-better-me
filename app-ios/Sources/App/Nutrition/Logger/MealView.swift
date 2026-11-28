import Feedback
import SwiftUI

/// The meal the logger adds to (`log-04-your-plate.jpg`): every food already logged in this day's section, or the
/// recipe's ingredients, each with its quantity chip, their nutrition alone or with the day's as four tiles, and every
/// nutrient on request. A row opens its food detail; its chip edits the amount in place with the quantity keypad, as
/// MacroFactor's does; a swipe removes it.
struct MealView: View {
    let session: LoggerSession
    let open: (IngredientList.Item) -> Void
    private var targets = OwnerTargets()
    @Observe<[FoodEntry]> private var entries: [FoodEntry]
    @Observe<NutritionDay> private var dayRow: NutritionDay
    @AppStorage("plate.withDay") private var withDay = false
    @AppStorage("plate.allNutrients") private var allNutrients = false
    @State private var editing: UUID?
    @Environment(\.summaryNutrients) private var columns
    private var settings: AppSettings { targets.settings }
    /// A recipe's ingredients are never logged, so they never count with the day.
    private var showsDay: Bool { withDay && !session.addsIngredients }

    init(session: LoggerSession, open: @escaping (IngredientList.Item) -> Void) {
        self.session = session
        self.open = open
        _entries = Observe(FoodEntry.on(session.time.day))
        _dayRow = Observe(NutritionDay.one(session.time.day))
    }

    /// The meal's foods: the section's entries in the order they were eaten, or the ingredients.
    private var items: [IngredientList.Item] {
        if session.addsIngredients { return session.ingredients.items }
        let section = session.section.id
        return entries.filter { $0.section == section }.sorted { $0.minute < $1.minute }.map { entry in
            IngredientList.Item(id: entry.id, pick: LoggerPick(FoodPortion(entry.food, serving: entry.serving), alterations: entry.alterations))
        }
    }

    var body: some View {
        let items = self.items
        let meal = items.reduce(into: NutrientAmounts()) { $0 = $0 + $1.pick.portion.amounts }
        let ids = Set(items.map(\.id))
        let rest = dayRow.totals(entries.filter { !ids.contains($0.id) })
        let lines = targets.on(session.time.day).summary(
            showsDay ? rest : [:], plate: meal, columns: columns, showOverages: settings.nutrition.showOverages
        )
        List {
            Section {
                ForEach(items) { item in
                    row(item)
                }
                .onDelete { offsets in
                    let removed = offsets.map { items[$0].id }
                    if let editing, removed.contains(editing) { self.editing = nil }
                    session.remove(removed)
                }
            } header: {
                HStack {
                    Spacer()
                    MealRatingBadge(title: session.mealName, amounts: meal)
                }
                .listRowInsets(EdgeInsets(top: 8, leading: Theme.margin, bottom: 4, trailing: Theme.margin))
            }
            .listRowBackground(Theme.background.feedback("Meal Row"))
            .listRowInsets(EdgeInsets(top: 8, leading: Theme.margin, bottom: 8, trailing: Theme.margin))
            Section {
                Grid(horizontalSpacing: 8, verticalSpacing: 8) {
                    ForEach(Array(stride(from: 0, to: lines.count, by: 2)), id: \.self) { start in
                        GridRow {
                            ForEach(lines[start..<min(start + 2, lines.count)]) { tile($0) }
                        }
                    }
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 0, leading: Theme.margin, bottom: 0, trailing: Theme.margin))
            } header: {
                HStack {
                    SectionTitle("Nutrition")
                    Spacer()
                    if !session.addsIngredients {
                        Picker("Nutrition", selection: $withDay) {
                            Text("Meal").tag(false)
                            Text("Day").tag(true)
                        }
                        .pickerStyle(.segmented)
                        .fixedSize()
                    }
                }
                .textCase(nil)
                .listRowInsets(EdgeInsets(top: 16, leading: Theme.margin, bottom: 8, trailing: Theme.margin))
            }
            ThemedSection {
                Toggle("All Nutrients", isOn: $allNutrients).tint(Theme.accent)
                if allNutrients {
                    let total = showsDay ? rest + meal : meal
                    ForEach(NutrientSection.allCases.flatMap(\.nutrients).filter { !columns.contains($0.id) && total.amount(of: $0.id) != nil }) { nutrient in
                        LabeledContent(nutrient.name, value: NutritionFormat.amount(total.amount(of: nutrient.id) ?? 0, nutrient.unit))
                    }
                }
            }
        }
        .flatList()
        .overlay {
            if items.isEmpty {
                if session.addsIngredients {
                    ContentUnavailableView("No ingredients yet", systemImage: "fork.knife", description: Text("Add foods from any tab."))
                } else {
                    ContentUnavailableView("Nothing in \(session.mealName) yet", systemImage: "fork.knife", description: Text("Foods you add from any tab are logged here."))
                }
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if let editing, let item = items.first(where: { $0.id == editing }) {
                MealServingEditor(session: session, item: item, done: { self.editing = nil })
                    .id(editing)
            }
        }
        .animation(.snappy, value: editing)
        .detailTitle(session.mealName)
        .feedback(self)
    }

    private func row(_ item: IngredientList.Item) -> some View {
        let portion = item.pick.portion
        return HStack(spacing: 12) {
            Button {
                editing = nil
                open(item)
            } label: {
                HStack(spacing: 12) {
                    FoodIcon(food: portion.food)
                    RowLabel(title: portion.food.displayName, detail: Text(macroLine: portion.amounts, columns: columns))
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

    private func tile(_ line: MacroLine) -> some View {
        let unit = line.nutrient == .energy ? "cal" : "g"
        let caption = showsDay ? "\(line.text(.eaten)) \(unit) with the day" : "\(line.total.wholeText) \(unit)"
        return VStack(alignment: .leading, spacing: 6) {
            Text(line.nutrient.title).font(AppFont.rowTitle)
            Text(caption).font(AppFont.caption()).foregroundStyle(Theme.textSecondary).lineLimit(1).minimumScaleFactor(0.8)
            // The meal alone against no target would fill the whole track, so the track stays empty, as it did.
            TargetBar(fill: (showsDay || line.target != nil ? line.fill(.eaten) : nil) ?? MacroLine.Fill(eaten: 0, plate: 0), color: line.nutrient.color, dimsEaten: showsDay)
                .padding(.top, 6)
        }
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

/// A meal row's amount, "100" over "g", which edits it.
private struct QuantityChip: View {
    let serving: Serving
    let isActive: Bool

    var body: some View {
        VStack(spacing: 0) {
            Text(NumberText.plain(serving.quantity)).font(AppFont.headline(14)).monospacedDigit()
            Text(serving.measure.name).font(AppFont.caption(11)).lineLimit(1)
        }
        .foregroundStyle(isActive ? Theme.onPrimary : Theme.textPrimary)
        .padding(.horizontal, 10)
        .frame(minWidth: 62, maxWidth: 96, minHeight: 40)
        .background(isActive ? Theme.textPrimary : Theme.surfaceRaised, in: .rect(cornerRadius: Theme.smallCornerRadius))
    }
}

/// The quantity keypad over the meal for one food: Update sets its amount.
private struct MealServingEditor: View {
    let session: LoggerSession
    let item: IngredientList.Item
    let done: () -> Void
    @Observe(AppSettings.current) private var settings
    @State private var measure: Measure
    @State private var quantity: QuantityText

    init(session: LoggerSession, item: IngredientList.Item, done: @escaping () -> Void) {
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
            choose: { measure = $0 },
            confirm: {
                session.setServing(serving, of: item.id)
                done()
            }
        )
        .feedback(self)
    }
}
