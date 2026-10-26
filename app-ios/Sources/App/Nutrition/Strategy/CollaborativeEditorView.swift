import SwiftUI

/// MacroFactor's Collaborative editor: the week's chart with day buttons, then the selected day's calories, protein,
/// and carb-to-fat ratio. A calorie change rebalances the other unlocked days so the weekly budget holds.
struct CollaborativeEditorView: View {
    @Binding var week: CollaborativeWeek
    let weightLb: Double
    let expenditureKcal: Double?

    @State private var weekday = 1

    private var day: DayTarget { week[weekday] }
    private var maxKcal: Int { Int(((expenditureKcal ?? 2500) * CollaborativeWeek.maxKcalPerExpenditure).rounded()) }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            WeekTargetsChart(targets: week.targets, selection: $weekday, locked: week.locked, height: 120)
            Divider().overlay(Theme.separator)
            HStack {
                Text(StrategyFormat.weekdayNames[weekday - 1]).font(AppFont.title(20))
                Spacer()
                Button("Reset All Days") { week.resetAll(like: weekday) }
                    .buttonStyle(.glass)
                Button {
                    if week.locked.contains(weekday) { week.locked.remove(weekday) } else { week.locked.insert(weekday) }
                } label: {
                    Image(systemName: week.locked.contains(weekday) ? "lock.fill" : "lock.open")
                }
                .buttonStyle(.glass)
                .accessibilityLabel(week.locked.contains(weekday) ? "Unlock \(StrategyFormat.weekdayNames[weekday - 1])" : "Lock \(StrategyFormat.weekdayNames[weekday - 1])")
            }
            calories
            protein
            ratio
            Text("Weekly budget: \(week.weeklyKcal.formatted()) kcal").font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
        }
    }

    private var calories: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Calorie targets: set between 0 and \(maxKcal.formatted()) kcal").font(AppFont.medium(14))
            HStack {
                TextField("Calories", value: Binding(get: { Int(day.energy) }, set: { week.setCalories(min(maxKcal, max(0, $0)), on: weekday) }), format: .number)
                    .keyboardType(.numberPad)
                    .font(AppFont.number(18))
                    .accessibilityLabel("Calorie target")
                Text("kcal").foregroundStyle(Theme.textSecondary)
                Stepper("Calories", onIncrement: { step(25) }, onDecrement: { step(-25) }).labelsHidden()
            }
            .padding(12)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
        }
    }

    private func step(_ delta: Int) {
        week.setCalories(min(maxKcal, max(0, Int(day.energy) + delta)), on: weekday)
    }

    private var protein: some View {
        let perLb = day.protein / weightLb
        return VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Protein").font(AppFont.medium(14))
                Spacer()
                Text("\(Int(day.protein)) g · \(perLb.formatted(.number.precision(.fractionLength(2)))) g/lb").font(AppFont.medium(14)).monospacedDigit()
            }
            Slider(
                value: Binding(get: { min(perLb, CollaborativeWeek.maxProteinPerLb) }, set: { week.setProtein(Int(($0 * weightLb).rounded()), on: weekday) }),
                in: 0...CollaborativeWeek.maxProteinPerLb, step: 0.01
            ) { Text("Protein") }
                .tint(StrategyPalette.protein)
            Text("Set between 0.0 and \(CollaborativeWeek.maxProteinPerLb.formatted()) g per lb of body weight.").font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
        }
    }

    private var ratio: some View {
        let target = day
        return VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Carb to Fat Ratio").font(AppFont.medium(14))
                Spacer()
                Text("\(Int((week.carbShare(weekday) * 100).rounded())) %").font(AppFont.medium(14)).monospacedDigit()
            }
            Slider(value: Binding(get: { week.carbShare(weekday) }, set: { week.setCarbShare($0, on: weekday) }), in: 0...1, step: 0.01) { Text("Carb to Fat Ratio") }
                .tint(StrategyPalette.carbs)
            HStack {
                Text("\((target.carbs / weightLb).formatted(.number.precision(.fractionLength(2)))) C/lb BW")
                Spacer()
                Text("\((target.fat / weightLb).formatted(.number.precision(.fractionLength(2)))) F/lb BW")
            }
            .font(AppFont.caption(12))
            .foregroundStyle(Theme.textSecondary)
            Text("Set carbs as portion of remaining calories.").font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
        }
    }
}
