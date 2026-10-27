import SwiftUI

extension Nutrient {
    var color: Color {
        switch (id, group) {
        case (.energy, _): Theme.calories
        case (_, .protein): Theme.protein
        case (_, .fats): Theme.fat
        case (_, .carbohydrates): Theme.carbs
        case (_, .vitamins): Theme.vitamins
        case (_, .minerals): Theme.minerals
        case (_, .general): Theme.calories
        }
    }
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
                Text(range.target.map { "\(Int((value / max($0, 0.0001) * 100).rounded()))%" } ?? "No Target")
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
    }
}

/// Big calories, then protein, fat, and carbs, each with its share of the calories the three supply (`macroShare`).
struct MacroHeader: View {
    let amounts: NutrientAmounts

    var body: some View {
        let hasMacros = NutrientID.macros.dropFirst().contains { (amounts[$0] ?? 0) > 0 }
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 0) {
                Text("\(Int((amounts[.energy] ?? 0).rounded()))").font(AppFont.number(32))
                Text("Calories").font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
            }
            Spacer()
            ForEach(NutrientID.macros.dropFirst(), id: \.self) { id in
                VStack(spacing: 2) {
                    Text(hasMacros ? "\(Int((amounts.macroShare(id) * 100).rounded()))%" : "–")
                        .font(AppFont.badge)
                        .foregroundStyle(Theme.onPrimary)
                        .padding(.horizontal, 6)
                        .background(Theme.macro(id), in: .capsule)
                    Text(NutritionFormat.amount(amounts[id] ?? 0)).font(AppFont.number(18))
                    Text(NutrientRegistry.nutrient(id)?.name ?? "").font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
                }
                .frame(width: 64)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// Four rings: the share of the day's calorie and macro targets the amounts use, "–" where no plan sets one.
struct ImpactGauges: View {
    let amounts: NutrientAmounts
    let target: DayTarget?

    var body: some View {
        HStack {
            ForEach(NutrientID.macros, id: \.self) { id in
                let goal = target?.amount(id) ?? 0
                let share = goal > 0 ? (amounts[id] ?? 0) / goal : 0
                VStack(spacing: 6) {
                    Gauge(value: min(1, share)) {
                        EmptyView()
                    } currentValueLabel: {
                        Text(goal > 0 ? "\(Int((share * 100).rounded()))%" : "–").font(AppFont.rowDetail)
                    }
                    .gaugeStyle(.accessoryCircularCapacity)
                    .tint(Theme.macro(id))
                    Text(id == .energy ? "Calories" : NutrientRegistry.nutrient(id)?.name ?? "").font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.vertical, 4)
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
