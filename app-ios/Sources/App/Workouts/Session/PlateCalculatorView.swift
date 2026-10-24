import SwiftUI

/// The weight keypad's plate calculator: one sleeve of the bar with its plates, the legend, and MF's sentence. The
/// context key switches the expanded view, which draws the sleeve larger with each plate's weight on it.
struct PlateCalculatorView: View {
    let plan: PlatePlan
    let unit: WeightUnit
    let isExpanded: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 16) {
                sleeve
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(Array(plan.legend.enumerated()), id: \.offset) { _, line in
                        HStack(spacing: 6) {
                            RoundedRectangle(cornerRadius: 2).fill(Self.color(line.weight, unit: unit)).frame(width: 10, height: 10)
                            Text("\(line.count) x \(SetField.plain(line.weight))")
                        }
                    }
                }
                .font(AppFont.medium(isExpanded ? 15 : 13))
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
            Divider().overlay(Theme.separator)
            Text(plan.sentence(unit: unit.rawValue))
                .font(AppFont.caption(12))
                .foregroundStyle(Theme.textSecondary)
                .padding(.horizontal, 20)
                .padding(.vertical, 8)
        }
        .foregroundStyle(Theme.textPrimary)
        .background(Theme.header)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Plate calculator")
        .accessibilityValue(plan.sentence(unit: unit.rawValue))
    }

    private var sleeve: some View {
        let height: CGFloat = isExpanded ? 120 : 40
        let thickness: CGFloat = isExpanded ? 18 : 5
        let heaviest = plan.perSide.max() ?? 1
        return HStack(spacing: isExpanded ? 2 : 1) {
            Rectangle().fill(Theme.textTertiary).frame(width: isExpanded ? 28 : 16, height: isExpanded ? 6 : 3)
            RoundedRectangle(cornerRadius: 1).fill(Theme.textTertiary).frame(width: isExpanded ? 6 : 3, height: height * 0.3)
            ForEach(Array(plan.perSide.enumerated()), id: \.offset) { _, weight in
                RoundedRectangle(cornerRadius: isExpanded ? 3 : 1)
                    .fill(Self.color(weight, unit: unit))
                    .frame(width: thickness, height: height * (0.35 + 0.65 * weight / heaviest))
                    .overlay {
                        if isExpanded {
                            Text(SetField.plain(weight))
                                .font(AppFont.headline(10))
                                .foregroundStyle(.black)
                                .fixedSize()
                                .rotationEffect(.degrees(-90))
                        }
                    }
            }
            Rectangle().fill(Theme.textTertiary).frame(width: isExpanded ? 36 : 20, height: isExpanded ? 6 : 3)
        }
        .frame(height: height)
    }

    /// MF's default plate colors (`live-31`) by lb weight, and the competition colors for kg plates. Any other plate is
    /// gray.
    static func color(_ weight: Double, unit: WeightUnit) -> Color {
        let pounds = WeightUnit.lb.fromKg(unit.toKg(weight))
        let kilograms = unit.toKg(weight)
        let byPound: [(Double, Color)] = [
            (55, .red), (45, Theme.muscle), (35, .yellow), (25, Theme.green), (10, Color(white: 0.75)),
            (5, Theme.muscle), (2.5, Theme.green), (1.25, Color(white: 0.75)), (0.5, Color(white: 0.4)),
        ]
        let byKilogram: [(Double, Color)] = [
            (25, .red), (20, Theme.muscle), (15, .yellow), (10, Theme.green), (5, .white), (2.5, .red), (1.25, Color(white: 0.75)),
        ]
        if let match = byPound.first(where: { abs($0.0 - pounds) < 0.05 }) { return match.1 }
        if let match = byKilogram.first(where: { abs($0.0 - kilograms) < 0.05 }) { return match.1 }
        return Color(white: 0.55)
    }
}
