import Feedback
import SwiftUI

extension Nutrient {
    var tint: NutrientTint {
        switch (id, group) {
        case (.energy, _): .calories
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
        let hasMacros = NutrientID.macros.dropFirst().contains { (amounts[$0] ?? 0) > 0 }
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            ForEach(NutrientID.macros, id: \.self) { id in
                VStack(alignment: .leading, spacing: 2) {
                    let unit = Text(id == .energy ? "" : " g").font(AppFont.caption(13)).foregroundStyle(Theme.textSecondary)
                    Text("\(Text(NutritionFormat.amount(amounts[id] ?? 0, of: id)).font(AppFont.number(22)))\(unit)")
                    HStack(spacing: 4) {
                        Text(id == .energy ? "Calories" : NutrientRegistry.nutrient(id)?.name ?? "").foregroundStyle(Theme.textSecondary)
                        if id != .energy {
                            Text(hasMacros ? "\((amounts.macroShare(id) * 100).wholeText)%" : "–").foregroundStyle(id.color)
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
        let lines = FoodLog.summary(rest, plate: amounts, target: target, showOverages: true)
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
                        Text(line.nutrient == .energy ? "Calories" : NutrientRegistry.nutrient(line.nutrient)?.name ?? "")
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

/// The nutrient sections every nutrient list shows, in MacroFactor's Food Detail order.
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
        guard let group else { return (section, NutrientID.macros.compactMap(NutrientRegistry.nutrient)) }
        return (section, NutrientRegistry.all.filter { $0.group == group && !NutrientID.macros.contains($0.id) })
    })
}

/// The ranges a day's rows draw: calories and macros from the plan, every other nutrient from its goal.
struct NutrientTargets {
    let target: DayTarget?
    let goals: [NutrientGoal]
    let day: CalendarDay
    let sex: BodySex
    let weightKg: Double?

    func range(_ id: NutrientID) -> NutrientRange {
        switch id {
        case .energy: NutrientRange(target: target?.energy)
        case .protein: NutrientRange(target: target?.protein)
        case .fat: NutrientRange(target: target?.fat)
        case .carbs: NutrientRange(target: target?.carbs)
        default: NutrientGoal.range(id, on: day, goals: goals, sex: sex, weightKg: weightKg)
        }
    }
}
