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

    /// "1600 kcal", "22.4 g".
    func label(_ value: Double) -> String {
        "\(FoodLog.amountLabel(value < 10 ? value : value.rounded())) \(unit.rawValue)"
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
                Text(nutrient.name).font(AppFont.medium(15))
                Spacer()
                Text(range.target.map { "\(FoodLog.amountLabel(value.rounded())) / \(nutrient.label($0))" } ?? nutrient.label(value))
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
                    HStack {
                        Text(contributor.name).lineLimit(1)
                        Spacer()
                        Text(nutrient.label(contributor.amount)).monospacedDigit()
                    }
                    .font(AppFont.caption(13))
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

/// The nutrient groups in MacroFactor's Nutrition Overview order, from the registry.
enum NutrientSections {
    struct Section: Identifiable {
        let title: String
        let nutrients: [Nutrient]

        var id: String { title }
    }

    static let all: [Section] = {
        let lead = FoodLog.macros.compactMap(NutrientRegistry.nutrient)
        func rest(of group: NutrientGroup) -> [Nutrient] {
            NutrientRegistry.all.filter { $0.group == group && !FoodLog.macros.contains($0.id) }
        }
        return [
            Section(title: "Calories", nutrients: Array(lead.prefix(1))),
            Section(title: "Macros", nutrients: Array(lead.dropFirst())),
            Section(title: "Carb Breakdown", nutrients: rest(of: .carbohydrates)),
            Section(title: "Fat Breakdown", nutrients: rest(of: .fats)),
            Section(title: "Protein Breakdown", nutrients: rest(of: .protein)),
            Section(title: "Vitamins", nutrients: rest(of: .vitamins)),
            Section(title: "Minerals", nutrients: rest(of: .minerals)),
            Section(title: "Other", nutrients: rest(of: .general)),
        ]
    }()

    /// Calories and macros only, when the owner hides additional nutrients.
    static let lead = Array(all.prefix(2))
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
