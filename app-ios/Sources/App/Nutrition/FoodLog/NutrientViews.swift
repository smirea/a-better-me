import Feedback
import SwiftUI

extension Nutrient {
    var color: Color { tint.color }
}

extension NutrientID {
    var color: Color { NutrientRegistry.nutrient(self)?.color ?? Theme.calories }

    /// A summary column's label in compact rows: the flame for calories, else its letters ("P", "Fb", "Nc").
    var columnLabel: Text { self == .energy ? Text(calorieGlyph) : Text(columnLetters) }
}

/// The calorie glyph that follows a number in compact rows, where MacroFactor writes "149ઠ".
let calorieGlyph = Image(systemName: "flame.fill")

/// The owner's targets on any day, read the one way every screen that measures against them does: the plan's
/// calories and macros, every other nutrient's goal, and net carbs derived (`NutrientTargets`). Their `summary` gives
/// the lines in the summary's columns.
struct OwnerTargets: DynamicProperty {
    @Observe(NutritionPlan.all) private var plans
    @Observe(NutrientGoal.all) private var goals
    @Observe(BodyWeight.latest) private var weight
    @Observe(AppSettings.current) var settings

    func on(_ day: CalendarDay) -> NutrientTargets {
        NutrientTargets.of(day, plans: plans, goals: goals, profile: settings.profile, latestWeightKg: weight?.weightKg)
    }
}

/// A summary column's progress against its target, the bar every target view draws: what was eaten, then the plate
/// after it. Inside the logger the plate is lit and what was eaten dims behind it.
struct TargetBar: View {
    let fill: MacroLine.Fill
    let color: Color
    var dimsEaten = false
    var height: CGFloat = 4

    var body: some View {
        GeometryReader { proxy in
            HStack(spacing: 0) {
                Rectangle().fill(color.opacity(dimsEaten ? 0.45 : 1)).frame(width: proxy.size.width * fill.eaten)
                Rectangle().fill(color).frame(width: proxy.size.width * fill.plate)
            }
        }
        .background(Theme.surfaceRaised)
        .clipShape(Capsule())
        .frame(height: height)
        .accessibilityHidden(true)
    }
}

extension EnvironmentValues {
    /// The owner's summary columns (`NutritionSettings.summaryNutrients`), which every compact row of four nutrients
    /// draws in their order. `RootView` sets it from the settings, so a change in Settings or on the summary moves
    /// every row at once.
    @Entry var summaryNutrients = NutrientID.macros
}

/// A nutrient's track: the goal range as a faint band, the amount as the fill, and a tick at the target.
struct NutrientBar: View {
    let value: Double
    let range: NutrientRange
    let maximum: Double
    let color: Color

    var body: some View {
        GeometryReader { proxy in
            let x = { (amount: Double) in proxy.size.width * min(1, max(0, amount / maximum)) }
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.surfaceRaised)
                if range.floor != nil || range.ceiling != nil {
                    let start = x(range.floor ?? 0)
                    Rectangle().fill(color.opacity(0.25))
                        .frame(width: max(0, x(range.ceiling ?? maximum) - start))
                        .offset(x: start)
                }
                Capsule().fill(color).frame(width: x(value))
                if let target = range.target {
                    Rectangle().fill(Theme.textSecondary).frame(width: 1.5, height: 8).offset(x: x(target) - 0.75)
                }
            }
            .clipShape(Capsule())
        }
        .frame(height: 6)
        .accessibilityHidden(true)
    }
}

/// A Nutrition Overview row: the name, the amount ("value / target"), how it stands against the target, and the bar.
/// The amount is right-aligned against a fixed last column, so amounts line up whatever a row's indent. Only a row
/// with a target has a bar; one with only a ceiling or floor says so in the last column instead.
struct NutrientRow: View {
    let nutrient: Nutrient
    let value: Double
    let range: NutrientRange
    var contributors: [Contributor]? = nil
    @ScaledMetric private var standingWidth: CGFloat = 70

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(nutrient.name).font(AppFont.rowTitle)
                Spacer(minLength: 0)
                Text(range.target.map { "\(NutritionFormat.amount(value)) / \(NutritionFormat.amount($0, nutrient.unit))" } ?? NutritionFormat.amount(value, nutrient.unit))
                    .font(AppFont.caption(14))
                    .monospacedDigit()
                Text(standing)
                    .font(AppFont.caption(13))
                    .foregroundStyle(Theme.textSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .frame(width: standingWidth, alignment: .trailing)
            }
            if let maximum = FoodLog.barMaximum(value: value, range: range) {
                NutrientBar(value: value, range: range, maximum: maximum, color: nutrient.color)
            }
            if let contributors {
                ForEach(contributors) { contributor in
                    LabeledContent(contributor.name, value: NutritionFormat.amount(contributor.amount, nutrient.unit))
                        .lineLimit(1)
                        .monospacedDigit()
                        .font(AppFont.rowDetail)
                        .foregroundStyle(Theme.textSecondary)
                }
                if contributors.isEmpty {
                    Text("No contributors").font(AppFont.caption(13)).foregroundStyle(Theme.textTertiary)
                }
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
        .feedback(self)
    }

    private var standing: String {
        if let target = range.target { return "\((value / max(target, 0.0001) * 100).wholeText)%" }
        if let ceiling = range.ceiling { return "Max \(NutritionFormat.amount(ceiling, nutrient.unit))" }
        if let floor = range.floor { return "Min \(NutritionFormat.amount(floor, nutrient.unit))" }
        return "No Target"
    }
}

/// Calories and the macros in even columns, each macro labeled with its share of the calories protein, fat, and carbs
/// supply (`macroShare`). A food's page shows calories, protein, fat, and carbs; a recipe's (`MacroSummary`) the
/// summary's columns, where fiber has no share.
struct MacroHeader: View {
    let amounts: NutrientAmounts
    var columns = NutrientID.macros

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            ForEach(columns, id: \.self) { id in
                VStack(alignment: .leading, spacing: 2) {
                    let unit = Text(id == .energy ? "" : " g").font(AppFont.caption(13)).foregroundStyle(Theme.textSecondary)
                    Text("\(Text(NutritionFormat.amount(amounts.amount(of: id) ?? 0, of: id)).font(AppFont.number(22)))\(unit)")
                    HStack(spacing: 4) {
                        Text(id.title).foregroundStyle(Theme.textSecondary)
                        if id != .energy, id != .fiber {
                            Text(amounts.macroShare(id).map { "\(($0 * 100).wholeText)%" } ?? "–").foregroundStyle(id.color)
                        }
                    }
                    .font(AppFont.rowDetail)
                }
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .monospacedDigit()
        .accessibilityElement(children: .combine)
        .feedback(self)
    }
}

/// "Impact on Targets": a ring per summary column, against the same targets as the Food Log's summary, with the rest
/// of the day dimmed and this food lit after it, and in the middle the share of the target the food takes. A column
/// with no target measures the day with the food instead, and when no column has one the section says what the food
/// adds to the day. `day` is the rest of the day the food lands on: its entries without the one being edited, plus
/// `adding` (the logger's plate). It reads the day once, so a caller whose day can change gives it `.id(day)`.
struct ImpactGauges: View {
    let amounts: NutrientAmounts
    let day: CalendarDay
    let adding: NutrientAmounts
    let excluding: UUID?
    private var targets = OwnerTargets()
    @Observe<[FoodEntry]> private var entries: [FoodEntry]
    @Observe<NutritionDay> private var row: NutritionDay

    init(amounts: NutrientAmounts, day: CalendarDay, adding: NutrientAmounts = [:], excluding: UUID? = nil) {
        self.amounts = amounts
        self.day = day
        self.adding = adding
        self.excluding = excluding
        _entries = Observe(FoodEntry.on(day))
        _row = Observe(NutritionDay.one(day))
    }

    var body: some View {
        let rest = row.totals(entries.filter { $0.id != excluding }) + adding
        let lines = targets.on(day).summary(rest, plate: amounts, settings: targets.settings)
        let targeted = lines.contains { $0.target != nil }
        ThemedSection(
            targeted ? "Impact on Targets" : "Share of the Day",
            subtitle: targeted ? nil : "No targets for this day"
        ) {
            HStack {
                ForEach(lines) { line in
                    VStack(spacing: 6) {
                        ImpactRing(fill: line.fill(.eaten) ?? MacroLine.Fill(eaten: 0, plate: 0), color: line.nutrient.color) {
                            Text(line.plateShare.map { "\(line.target == nil ? "" : "+")\(($0 * 100).wholeText)%" } ?? "–")
                                .font(AppFont.rowDetail)
                                .monospacedDigit()
                        }
                        Text(line.nutrient.title)
                            .font(AppFont.rowDetail)
                            .foregroundStyle(Theme.textSecondary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                    .frame(maxWidth: .infinity)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(line.spoken)
                }
            }
            .padding(.vertical, 4)
            .feedback(self)
        }
    }
}

private struct ImpactRing<Label: View>: View {
    let fill: MacroLine.Fill
    let color: Color
    @ViewBuilder let label: Label

    var body: some View {
        ZStack {
            Circle().stroke(Theme.surfaceRaised, lineWidth: 5)
            Circle().trim(from: 0, to: fill.eaten).stroke(color.opacity(0.45), style: StrokeStyle(lineWidth: 5))
            Circle().trim(from: fill.eaten, to: fill.eaten + fill.plate).stroke(color, style: StrokeStyle(lineWidth: 5))
        }
        .rotationEffect(.degrees(-90))
        .overlay { label }
        .frame(width: 52, height: 52)
        .animation(.snappy, value: fill)
    }
}

/// The nutrient sections every nutrient list shows, in MacroFactor's Food Detail order except that fiber and net carbs
/// follow carbs in the macros.
enum NutrientSection: String, CaseIterable, Identifiable {
    case macros = "Calories & Macros"
    case carbs = "Carb Breakdown"
    case fats = "Fat Breakdown"
    case protein = "Protein Breakdown"
    case vitamins = "Vitamins"
    case minerals = "Minerals"
    case other = "Other"

    var id: Self { self }

    var nutrients: [Nutrient] { Self.table[self] ?? [] }

    private static let macroSection: [NutrientID] = NutrientID.macros + [.fiber, .netCarbs]

    private static let table: [NutrientSection: [Nutrient]] = Dictionary(uniqueKeysWithValues: allCases.map { section in
        let group: NutrientGroup? = switch section {
        case .macros: nil
        case .carbs: .carbohydrates
        case .fats: .fats
        case .protein: .protein
        case .vitamins: .vitamins
        case .minerals: .minerals
        case .other: .general
        }
        guard let group else { return (section, macroSection.compactMap(NutrientRegistry.nutrient)) }
        return (section, NutrientRegistry.all.filter { $0.group == group && !macroSection.contains($0.id) })
    })
}

/// Every nutrient section in one card, as a compact Nutrition Facts label: no rules between nutrients, one under each
/// section, and a nested nutrient indented under what holds it. Given a food's `amounts`, it lists only the
/// significant ones (`Nutrient.isInsignificant`) and ends in a switch that shows the rest, remembered across foods;
/// `listsUnreported` counts the nutrients the food doesn't report among the rest, as a recipe's "–". Its rows are
/// derived once per input, never per render.
struct NutrientList<Row: View, Actions: View>: View {
    private enum Source {
        case rows([NutrientListRow])
        case food(NutrientAmounts, listsUnreported: Bool)
    }

    private struct FoodKey: Equatable {
        let amounts: NutrientAmounts
        let listsUnreported: Bool
        let all: Bool
    }

    var title: String?
    private let source: Source
    private let row: (Nutrient) -> Row
    private let actions: Actions
    @AppStorage("nutrients.showInsignificant") private var showsInsignificant = false
    @State private var table = ViewMemo<FoodKey, (rows: [NutrientListRow], hidden: Int)>()

    init(
        title: String? = nil, amounts: NutrientAmounts, listsUnreported: Bool = false,
        @ViewBuilder row: @escaping (Nutrient) -> Row, @ViewBuilder actions: () -> Actions
    ) {
        self.title = title
        source = .food(amounts, listsUnreported: listsUnreported)
        self.row = row
        self.actions = actions()
    }

    var body: some View {
        let (rows, hidden): ([NutrientListRow], Int) = switch source {
        case .rows(let rows): (rows, 0)
        case let .food(amounts, listsUnreported):
            table(FoodKey(amounts: amounts, listsUnreported: listsUnreported, all: showsInsignificant)) {
                NutrientListRow.rows(for: amounts, all: showsInsignificant, listsUnreported: listsUnreported)
            }
        }
        ThemedSection(title) {
            ForEach(rows) { item in
                NutrientListItem(item: item, row: row)
            }
            if hidden > 0 {
                InsignificantNutrientsToggle(isOn: $showsInsignificant, count: hidden)
            }
        } actions: {
            actions
        }
    }
}

extension NutrientList where Actions == EmptyView {
    /// A table of exactly `rows`, from `NutrientListRow.rows`, as the Nutrition Overview lists every nutrient against
    /// its target whatever the amount.
    init(title: String? = nil, rows: [NutrientListRow], @ViewBuilder row: @escaping (Nutrient) -> Row) {
        self.title = title
        source = .rows(rows)
        self.row = row
        actions = EmptyView()
    }

    init(title: String? = nil, amounts: NutrientAmounts, listsUnreported: Bool = false, @ViewBuilder row: @escaping (Nutrient) -> Row) {
        self.init(title: title, amounts: amounts, listsUnreported: listsUnreported, row: row) { EmptyView() }
    }
}

/// The switch closing a food's nutrient table, with how many nutrients it hides.
private struct InsignificantNutrientsToggle: View {
    @Binding var isOn: Bool
    let count: Int
    @Environment(\.flatSections) private var flat

    var body: some View {
        Toggle(isOn: $isOn.animation(.snappy)) {
            Text("Insignificant Nutrients \(Text("\(count)").foregroundStyle(Theme.textTertiary))")
                .font(AppFont.body(15))
        }
        .tint(Theme.accent)
        .listRowInsets(EdgeInsets(top: 10, leading: flat ? Theme.margin : 16, bottom: 5, trailing: flat ? Theme.margin : 16))
        .listRowSeparator(.hidden)
        .feedback("Insignificant Nutrients")
    }
}

extension View {
    /// The list a `NutrientList` sits in. Its compact rows are shorter than the 44-point floor a list gives every row,
    /// and only the list's own environment lowers that floor, not the section's.
    func nutrientTableList() -> some View {
        environment(\.defaultMinListRowHeight, 0)
    }
}

/// One `VStack` per element, so the `List` counts one row each without building them and lays out only those on
/// screen. A bare `switch` between a label and a row made it build every row on open and on each keypress.
private struct NutrientListItem<Row: View>: View {
    let item: NutrientListRow
    let row: (Nutrient) -> Row
    @Environment(\.flatSections) private var flat

    private static var indent: CGFloat { 16 }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            switch item {
            case .label(let section):
                Text(section.rawValue)
                    .font(AppFont.headline(14))
                    .foregroundStyle(Theme.textSecondary)
                    .padding(.top, 6)
                    .accessibilityAddTraits(.isHeader)
            case let .nutrient(nutrient, depth, _):
                row(nutrient).padding(.leading, CGFloat(depth) * Self.indent)
            }
        }
        .listRowInsets(EdgeInsets(top: 5, leading: flat ? Theme.margin : 16, bottom: 5, trailing: flat ? Theme.margin : 16))
        // No rule closes a group: it would sit right above the next group's label.
        .listRowSeparator(.hidden)
    }
}
