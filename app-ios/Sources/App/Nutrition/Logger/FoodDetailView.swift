import Feedback
import SwiftUI

/// The food detail (`log-03-food-detail.jpg`): a card with the name, Favorite, and the serving's calories and macros
/// with each macro's share of calories, the impact on the day's targets, every nutrient the food reports, and the
/// quantity keypad pinned under them. A recipe adds Prepare, Edit, and Duplicate, as the library's recipe page does. A
/// plate item opens here too, with Update and Remove. The logger's banner stays above it with its close button, so the
/// detail has no navigation bar of its own; a Ramble row's detail, which has no banner, keeps the back button.
struct FoodDetailView: View {
    let session: LoggerSession
    /// The plate item being edited, nil for a food not yet on the plate.
    let editing: UUID?
    let pick: LoggerPick
    /// A Ramble row: Update hands the serving back instead of touching the plate.
    var ramble: RambleEdit?
    @Environment(\.dismiss) private var dismiss
    @Observe(AppSettings.current) private var settings
    @State private var measure: Measure
    @State private var quantity: QuantityText
    @State private var favorited = 0
    /// The pick's food, until the owner edits the recipe it is from here.
    @State private var food: FoodSnapshot
    @State private var recipeSheet: LibraryEditorSheet?
    @State private var preparing: Recipe?

    init(session: LoggerSession, editing: UUID?, pick: LoggerPick, ramble: RambleEdit? = nil) {
        self.session = session
        self.editing = editing
        self.pick = pick
        self.ramble = ramble
        _measure = State(initialValue: pick.portion.serving.measure)
        _quantity = State(initialValue: QuantityText(pick.portion.serving.quantity))
        _food = State(initialValue: pick.portion.food)
    }

    private var serving: Serving { Serving(measure: measure, quantity: quantity.value ?? 0) }
    private var portion: FoodPortion { FoodPortion(food, serving: serving) }
    private var amounts: NutrientAmounts { portion.amounts }

    var body: some View {
        List {
            ThemedSection {
                header
            }
            let day = ramble?.day ?? session.time.day
            ImpactGauges(amounts: amounts, day: day, adding: ramble?.others ?? restOfPlate).id(day)
            ForEach(NutrientSection.allCases) { section in
                let rows = section.nutrients.filter { food.nutrition.nutrients.amount(of: $0.id) != nil }
                if !rows.isEmpty {
                    ThemedSection(section.rawValue) {
                        ForEach(rows) { nutrient in
                            LabeledContent(nutrient.name, value: NutritionFormat.amount(amounts.amount(of: nutrient.id) ?? 0, nutrient.unit))
                        }
                    }
                }
            }
        }
        .themedList()
        .contentMargins(.top, ramble == nil ? 8 : 0, for: .scrollContent)
        .contentMargins(.bottom, 12, for: .scrollContent)
        .toolbar(ramble == nil ? .hidden : .automatic, for: .navigationBar)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            QuantityKeypad(
                quantity: $quantity, measure: measure,
                detail: ServingChoices.detail(serving, food.nutrition),
                choices: ServingChoices(food.nutrition, favorites: settings.nutrition.favoriteMeasures, current: measure),
                confirmTitle: editing == nil && ramble == nil ? "Add" : "Update",
                choose: choose, confirm: confirm
            )
        }
        .onAppear(perform: preview)
        .onChange(of: portion, preview)
        .onDisappear { session.pending = nil }
        .sheet(item: $recipeSheet) { $0.editor }
        .navigationDestination(isPresented: .isPresent($preparing)) {
            if let preparing { RecipePrepareView(recipe: preparing) }
        }
        .feedback(self)
    }

    /// The same unit of the edited recipe, whose grams per serving may have changed, at the typed quantity.
    private func recipeEdited(_ snapshot: FoodSnapshot) {
        guard editing == nil else { return }
        food = snapshot
        measure = snapshot.nutrition.allMeasures.first { $0.name == measure.name } ?? snapshot.nutrition.measures[0]
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(food.name).font(AppFont.headline(18)).lineLimit(2)
                    if let brand = food.brand, !brand.isEmpty {
                        Text(brand).font(AppFont.caption()).foregroundStyle(Theme.textSecondary).lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityAddTraits(.isHeader)
                RoundIconButton(favorited > 0 ? "Saved" : "Favorite", systemImage: favorited > 0 ? "heart.fill" : "heart", size: .small) {
                    favorited += 1
                    Task { await session.favorite(portion, uncached: pick.uncached) }
                }
                .disabled(serving.quantity <= 0 || favorited > 0)
                .sensoryFeedback(.success, trigger: favorited)
            }
            MacroHeader(amounts: amounts)
            let recipeID = pick.portion.food.source == .recipe ? pick.portion.food.foodID.flatMap(UUID.init(uuidString:)) : nil
            if recipeID != nil || editing != nil {
                FlowLayout {
                    if let recipeID {
                        RecipeActions(recipeID: recipeID, session: session, prepare: { preparing = $0 }, present: { recipeSheet = $0 }, edited: recipeEdited)
                    }
                    if let editing {
                        Button("Remove", systemImage: "trash") {
                            session.plate.remove(editing)
                            dismiss()
                        }
                    }
                }
                .chipButton()
                .labelStyle(.titleAndIcon)
                .controlSize(.small)
            }
        }
        .padding(.vertical, 4)
    }

    /// The plate without the item being edited, which the gauges count as the food itself.
    private var restOfPlate: NutrientAmounts {
        var plate = session.plate
        if let editing { plate.remove(editing) }
        return plate.totals
    }

    private func choose(_ next: Measure) {
        let converted = serving.converted(to: next)
        measure = next
        quantity = QuantityText(converted.quantity)
    }

    private func confirm() {
        putOnPlate()
        dismiss()
    }

    /// A food not yet on the plate shows in the banner as if it were.
    private func preview() {
        if editing == nil, ramble == nil { session.pending = portion }
    }

    private func putOnPlate() {
        session.pending = nil
        if let ramble {
            _ = ramble.update(serving)
        } else if let editing {
            session.plate.setServing(serving, of: editing)
        } else {
            session.add(LoggerPick(portion, uncached: pick.uncached))
        }
    }
}

struct RambleEdit {
    /// False when the row's food changed since the detail opened, so the edit was dropped.
    let update: (Serving) -> Bool
    /// The row's day, and what the ramble's other rows log there, for the impact gauges.
    let day: CalendarDay
    let others: NutrientAmounts
}

/// A recipe's Prepare, Edit, and Duplicate in the logger. Duplicate offers Create & Add onto the plate, and an edit
/// hands the detail the recipe's new snapshot. The detail presents what they open, outside its list.
private struct RecipeActions: View {
    let session: LoggerSession
    let prepare: (Recipe) -> Void
    let present: (LibraryEditorSheet) -> Void
    let edited: (FoodSnapshot) -> Void
    @Observe private var recipe: Recipe?

    init(
        recipeID: UUID, session: LoggerSession, prepare: @escaping (Recipe) -> Void, present: @escaping (LibraryEditorSheet) -> Void,
        edited: @escaping (FoodSnapshot) -> Void
    ) {
        self.session = session
        self.prepare = prepare
        self.present = present
        self.edited = edited
        _recipe = Observe(Recipe.one(recipeID))
    }

    var body: some View {
        if let recipe {
            Button("Prepare", systemImage: "frying.pan") { prepare(recipe) }
            Button("Edit", systemImage: "pencil") { present(LibraryEditorSheet(.editRecipe(recipe))) }
                .onChange(of: recipe.updatedAt) { edited(recipe.snapshot) }
            Button("Duplicate", systemImage: "plus.square.on.square") {
                present(LibraryEditorSheet(.newRecipe(RecipeDraft(recipe).duplicate()), add: { session.add(LoggerPick($0)) }))
            }
        }
    }
}

/// MacroFactor's quantity keypad: the quantity and its unit, the unit chips, and keys for digits, a point, a fraction
/// slash, and the space of a mixed number, beside the hide key and Add. The system keyboard has no "/" or " 1/2". The
/// hide key folds it into a glass button with the quantity, which brings it back, so the nutrients under it can be read.
struct QuantityKeypad: View {
    @Binding var quantity: QuantityText
    let measure: Measure
    let detail: String
    let choices: ServingChoices
    let confirmTitle: String
    let choose: (Measure) -> Void
    let confirm: () -> Void
    @State private var hidden = false

    private static let keyHeight: CGFloat = 46

    var body: some View {
        Group {
            if hidden {
                Button { withAnimation(.snappy) { hidden = false } } label: {
                    Label("\(quantity.text.isEmpty ? "0" : quantity.text) \(measure.name)", systemImage: "keyboard")
                        .font(AppFont.headline(16))
                        .monospacedDigit()
                }
                .buttonStyle(.glass)
                .buttonBorderShape(.capsule)
                .controlSize(.large)
                .accessibilityLabel("Show keypad, \(quantity.text) \(measure.name)")
                .frame(maxWidth: .infinity, alignment: .trailing)
                .padding(.horizontal, Theme.margin)
                .padding(.bottom, 8)
                .transition(.scale(0.6, anchor: .bottomTrailing).combined(with: .opacity))
            } else {
                pad.transition(.move(edge: .bottom))
            }
        }
        .feedback(self)
    }

    private var pad: some View {
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
                    keyButton("Hide keypad", action: { withAnimation(.snappy) { hidden = true } }) {
                        Image(systemName: "keyboard.chevron.compact.down")
                    }
                    confirmButton
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
            Chip(title: option.name, isActive: selected)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func digit(_ value: Int) -> some View {
        key(.digit(value), "\(value)") { Text("\(value)") }
    }

    private func key(_ key: QuantityText.Key, _ label: String, @ViewBuilder content: () -> some View) -> some View {
        keyButton(label, action: { quantity.type(key) }, content: content)
    }

    private func keyButton(_ label: String, action: @escaping () -> Void, @ViewBuilder content: () -> some View) -> some View {
        Button(action: action) {
            content()
                .frame(maxWidth: .infinity)
                .frame(height: Self.keyHeight)
                .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: Theme.tinyCornerRadius))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private var confirmButton: some View {
        Button(action: confirm) {
            Text(confirmTitle)
                .font(AppFont.headline(15))
                .frame(maxWidth: .infinity)
                .frame(height: Self.keyHeight)
                .foregroundStyle(Theme.onPrimary)
                .background(Theme.textPrimary, in: RoundedRectangle(cornerRadius: Theme.tinyCornerRadius))
        }
        .buttonStyle(.plain)
        .disabled(quantity.value.map { $0 <= 0 } ?? true)
    }
}
