import SwiftUI

/// The weight keypad's plate calculator: one sleeve of the bar with its plates, the legend, and MF's sentence. The
/// context key switches the expanded view, which draws the sleeve larger with each plate's weight on it. Bumper plates
/// are drawn full height and wider, as they are on a bar. A bar the gym lists in several weights gets a menu, and a
/// gym with Offset Weight on gets the offset chip.
struct PlateCalculatorView: View {
    let plan: PlatePlan
    let unit: WeightUnit
    let isExpanded: Bool
    /// The typed weight, named in the sentence when an offset moved it.
    var requested: Double? = nil
    var offset: PlateOffset? = nil
    var showsOffset = false
    var onBar: ((Double) -> Void)? = nil
    var onOffset: (() -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 16) {
                    sleeve
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(Array(plan.legend.enumerated()), id: \.offset) { _, line in
                            HStack(spacing: 6) {
                                swatch(line.weight, isBumper: line.isBumper)
                                Text("\(line.count) x \(SetField.plain(line.weight))\(line.isBumper ? " bumper" : "")")
                            }
                        }
                    }
                    .font(AppFont.medium(isExpanded ? 15 : 13))
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel("Plate calculator")
                    .accessibilityValue(sentence)
                    Spacer(minLength: 0)
                    // The expanded sleeve leaves no room beside the legend, so the chips go under it.
                    if !isExpanded { controls }
                }
                if isExpanded { controls }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
            Divider().overlay(Theme.separator)
            Text(sentence)
                .font(AppFont.caption(12))
                .foregroundStyle(Theme.textSecondary)
                .padding(.horizontal, 20)
                .padding(.vertical, 8)
        }
        .foregroundStyle(Theme.textPrimary)
        .background(Theme.header)
    }

    @ViewBuilder
    private var controls: some View {
        let layout = isExpanded ? AnyLayout(HStackLayout(spacing: 8)) : AnyLayout(VStackLayout(alignment: .trailing, spacing: 6))
        layout {
            if plan.loading.baseWeights.count > 1, let onBar { barMenu(onBar) }
            if showsOffset, let onOffset {
                Button(action: onOffset) { Chip(title: offset?.label(unit: unit) ?? "Offset", systemImage: "plusminus") }
                    .accessibilityLabel(offset.map { "Offset weight, \($0.label(unit: unit))" } ?? "Offset weight, none")
            }
        }
        .fixedSize()
    }

    private var sentence: String {
        let base = plan.sentence(unit: unit.rawValue)
        guard let offset, let requested else { return base }
        return "\(base) (\(SetField.plain(requested)) \(unit.rawValue) \(offset.label(unit: unit)))"
    }

    private func barMenu(_ onBar: @escaping (Double) -> Void) -> some View {
        Menu {
            Picker("Bar Weight", selection: Binding(get: { plan.loading.baseWeight }, set: onBar)) {
                ForEach(plan.loading.baseWeights, id: \.self) { Text("\(SetField.plain($0)) \(unit.rawValue)").tag($0) }
            }
        } label: {
            Chip(title: "\(SetField.plain(plan.loading.baseWeight)) \(unit.rawValue) bar", systemImage: "chevron.up.chevron.down")
        }
        .accessibilityLabel("Bar weight, \(SetField.plain(plan.loading.baseWeight)) \(unit.rawValue)")
    }

    @ViewBuilder
    private func swatch(_ weight: Double, isBumper: Bool) -> some View {
        if isBumper {
            Circle().fill(Self.color(weight, unit: unit)).frame(width: 10, height: 10)
                .overlay { Circle().strokeBorder(.black.opacity(0.6), lineWidth: 2).padding(2) }
        } else {
            RoundedRectangle(cornerRadius: 2).fill(Self.color(weight, unit: unit)).frame(width: 10, height: 10)
        }
    }

    private var sleeve: some View {
        let height: CGFloat = isExpanded ? 120 : 40
        let thickness: CGFloat = isExpanded ? 18 : 5
        let heaviest = plan.perSide.max() ?? 1
        return HStack(spacing: isExpanded ? 2 : 1) {
            Rectangle().fill(Theme.textTertiary).frame(width: isExpanded ? 28 : 16, height: isExpanded ? 6 : 3)
            RoundedRectangle(cornerRadius: 1).fill(Theme.textTertiary).frame(width: isExpanded ? 6 : 3, height: height * 0.3)
            ForEach(Array(plan.loaded.enumerated()), id: \.offset) { _, plate in
                RoundedRectangle(cornerRadius: isExpanded ? 3 : 1)
                    .fill(Self.color(plate.weight, unit: unit))
                    .frame(
                        width: plate.isBumper ? thickness * 1.6 : thickness,
                        height: plate.isBumper ? height : height * (0.35 + 0.65 * plate.weight / heaviest)
                    )
                    .overlay {
                        if plate.isBumper {
                            RoundedRectangle(cornerRadius: isExpanded ? 3 : 1).strokeBorder(.black.opacity(0.5), lineWidth: isExpanded ? 2 : 1)
                        }
                        if isExpanded {
                            Text(SetField.plain(plate.weight))
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
