import Feedback
import SwiftUI

extension Nutrient {
    var tint: NutrientTint {
        switch (id, group) {
        case (.energy, _): .calories
        case (.fiber, _): .fiber
        case (.netCarbs, _): .netCarbs
        case (_, .protein): .protein
        case (_, .fats): .fat
        case (_, .carbohydrates): .carbs
        case (_, .vitamins): .vitamins
        case (_, .minerals): .minerals
        case (_, .general): .calories
        }
    }

    var color: Color { tint.color }
}

extension NutrientID {
    var color: Color { NutrientRegistry.nutrient(self)?.color ?? Theme.calories }
}

/// The calorie glyph that follows a number in compact rows, where MacroFactor writes "149ઠ".
let calorieGlyph = Image(systemName: "flame.fill")

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

/// A Nutrition Overview row: the name, "value / target", the percent of the target or "No Target", and the bar.
struct NutrientRow: View {
    let nutrient: Nutrient
    let value: Double
    let range: NutrientRange
    var contributors: [Contributor]? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(nutrient.name).font(AppFont.rowTitle)
                Spacer()
                Text(range.target.map { "\(NutritionFormat.amount(value)) / \(NutritionFormat.amount($0, nutrient.unit))" } ?? NutritionFormat.amount(value, nutrient.unit))
                    .font(AppFont.caption(14))
                    .monospacedDigit()
                Spacer()
                Text(range.target.map { "\((value / max($0, 0.0001) * 100).wholeText)%" } ?? "No Target")
                    .font(AppFont.caption(13))
                    .foregroundStyle(Theme.textSecondary)
                    .frame(width: 70, alignment: .trailing)
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
}

/// Calories, protein, fat, and carbs in four even columns, each macro labeled with its share of the calories the three
/// supply (`macroShare`).
struct MacroHeader: View {
    let amounts: NutrientAmounts

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            ForEach(NutrientID.macros, id: \.self) { id in
                VStack(alignment: .leading, spacing: 2) {
                    let unit = Text(id == .energy ? "" : " g").font(AppFont.caption(13)).foregroundStyle(Theme.textSecondary)
                    Text("\(Text(NutritionFormat.amount(amounts[id] ?? 0, of: id)).font(AppFont.number(22)))\(unit)")
                    HStack(spacing: 4) {
                        Text(id.title).foregroundStyle(Theme.textSecondary)
                        if id != .energy {
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

/// "Impact on Targets": a ring per macro with the rest of the day dimmed and this food lit after it, and in the middle
/// the share of the target the food takes. A day no plan covers has no target to fill, so the rings measure the day
/// with the food instead and the section says what the food adds to it. `day` is the rest of the day the food lands
/// on: its entries without the one being edited, plus `adding` (the logger's plate). It reads the day once, so a caller
/// whose day can change gives it `.id(day)`.
struct ImpactGauges: View {
    let amounts: NutrientAmounts
    let day: CalendarDay
    let adding: NutrientAmounts
    let excluding: UUID?
    @Observe(NutritionPlan.all) private var plans
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
        let target = NutritionPlan.effective(on: day, in: plans)?.target(on: day)
        let rest = row.totals(entries.filter { $0.id != excluding }) + adding
        let lines = FoodLog.summary(rest, plate: amounts, targets: target?.amounts ?? [:], showOverages: true)
        ThemedSection(
            target == nil ? "Share of the Day" : "Impact on Targets",
            subtitle: target == nil ? "No targets for this day" : nil
        ) {
            HStack {
                ForEach(lines) { line in
                    VStack(spacing: 6) {
                        ImpactRing(fill: line.fill(.eaten) ?? MacroLine.Fill(eaten: 0, plate: 0), color: line.nutrient.color) {
                            Text(line.plateShare.map { "\(target == nil ? "" : "+")\(($0 * 100).wholeText)%" } ?? "–")
                                .font(AppFont.rowDetail)
                                .monospacedDigit()
                        }
                        Text(line.nutrient.title)
                            .font(AppFont.rowDetail)
                            .foregroundStyle(Theme.textSecondary)
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

/// A nutrient table's sections, read like a Nutrition Facts label: calories and the macros with what they contain,
/// then vitamins, minerals, and the rest, each section ruled off from the next.
enum NutrientTableSection: String, CaseIterable, Hashable {
    case facts = "Calories & Macros"
    case vitamins = "Vitamins"
    case minerals = "Minerals"
    case other = "Other"

    /// Each nutrient with how deep it nests: the US label's order (fat, cholesterol, sodium, carbs, protein; vitamins
    /// and minerals in the FDA's listing order), with the registry's extras placed under what holds them.
    fileprivate var lines: [(id: NutrientID, depth: Int)] {
        switch self {
        case .facts:
            [
                (.energy, 0),
                (.fat, 0), ("606", 1), ("693", 1), ("646", 1), ("645", 1), ("901", 1), ("851", 2), ("629", 2), ("621", 2), ("902", 1),
                ("601", 0),
                ("307", 0),
                (.carbs, 0), (.fiber, 1), ("269", 1), ("539", 2), ("209", 1), (.netCarbs, 1),
                (.protein, 0), ("507", 1), ("512", 1), ("503", 1), ("504", 1), ("505", 1), ("506", 1), ("508", 1), ("502", 1), ("501", 1), ("509", 1), ("510", 1),
            ]
        case .vitamins:
            ["320", "401", "328", "323", "430", "404", "405", "406", "415", "417", "418", "410", "421"].map { ($0, 0) }
        case .minerals:
            ["301", "303", "306", "305", "304", "309", "317", "312", "315"].map { ($0, 0) }
        case .other:
            [(.alcohol, 0), ("262", 0), ("255", 0)]
        }
    }
}

/// One row of a nutrient table: a section's label, or a nutrient with how deep it nests and whether it is the last
/// of its section, which draws the rule under it.
enum NutrientListRow: Hashable, Identifiable {
    case label(NutrientTableSection)
    case nutrient(Nutrient, depth: Int, endsSection: Bool)

    var id: Self { self }

    /// The table's nutrients that `shows` keeps, each section's label before its own. The first section reads as the
    /// label's top, so it has none, and a section that keeps nothing is left out.
    static func rows(shows: (Nutrient) -> Bool) -> [NutrientListRow] {
        NutrientTableSection.allCases.flatMap { section -> [NutrientListRow] in
            let lines = section.lines.compactMap { line in NutrientRegistry.nutrient(line.id).map { ($0, line.depth) } }.filter { shows($0.0) }
            guard !lines.isEmpty else { return [] }
            let rows = lines.enumerated().map { index, line in
                NutrientListRow.nutrient(line.0, depth: line.1, endsSection: index == lines.count - 1)
            }
            return (section == .facts ? [] : [.label(section)]) + rows
        }
    }

    /// Every nutrient, for a list that shows each whether or not it was reported.
    static let all = rows { _ in true }
    static let macros = rows { NutrientID.summaryChoices.contains($0.id) }
}

/// Every nutrient section in one card, as a compact Nutrition Facts label: no rules between nutrients, one under each
/// section, and a nested nutrient indented under what holds it. `rows` comes from `NutrientListRow.rows`, derived once
/// per input, never per render.
struct NutrientList<Row: View>: View {
    var title: String?
    let rows: [NutrientListRow]
    @ViewBuilder let row: (Nutrient) -> Row

    var body: some View {
        ThemedSection(title) {
            ForEach(rows) { item in
                NutrientListItem(item: item, row: row)
            }
        }
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
        .listRowInsets(EdgeInsets(top: 5, leading: 16, bottom: 5, trailing: 16))
        .listRowSeparator(endsSection ? .visible : .hidden, edges: .bottom)
        .listRowSeparator(.hidden, edges: .top)
        // The rule spans the card whatever the last row's indent, as a label's section rules do.
        .alignmentGuide(.listRowSeparatorLeading) { $0[.leading] }
    }

    private var endsSection: Bool {
        if case .nutrient(_, _, true) = item { true } else { false }
    }
}
