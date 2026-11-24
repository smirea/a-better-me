import Feedback
import SwiftUI

/// The weight keypad's plate calculator: one sleeve of the bar with its plates beside a legend that reads it out, "45 10
/// 5 + 13 bar". The context key switches the expanded view, which draws the sleeve larger with each plate's weight on it.
/// Bumper plates are drawn full height and wider, as they are on a bar. Tapping the bar in the legend leaves it out of
/// the math, struck through, and back. A bar the gym lists in several weights gets a menu, and a gym with Offset Weight
/// on gets the offset chip.
struct PlateCalculatorView: View {
    let plan: PlatePlan
    let unit: WeightUnit
    let isExpanded: Bool
    var offset: PlateOffset? = nil
    var showsOffset = false
    var onBar: ((Double) -> Void)? = nil
    var onOffset: (() -> Void)? = nil
    var onBase: (() -> Void)? = nil
    @ScaledMetric(relativeTo: .body) private var markerHeight: CGFloat = 13

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 16) {
                sleeve
                legend
                Spacer(minLength: 0)
                // The expanded sleeve leaves no room beside the legend, so the chips go under it.
                if !isExpanded { controls }
            }
            if isExpanded { controls }
        }
        .padding(.horizontal, Theme.margin)
        .padding(.vertical, 10)
        .foregroundStyle(Theme.textPrimary)
        .background(Theme.header)
        .feedback(self)
    }

    /// One entry per plate as on the sleeve, then the base, wrapping to more rows when a heavy load doesn't fit.
    private var legend: some View {
        FlowLayout(spacing: isExpanded ? 8 : 6) {
            PlateLegendItems(plan: plan, unit: unit, markerHeight: markerHeight * (isExpanded ? 15 : 13) / 13, spacing: isExpanded ? 5 : 4) { label, isIgnored in
                baseButton(label, isIgnored: isIgnored)
            }
        }
        .font(AppFont.medium(isExpanded ? 15 : 13))
        .monospacedDigit()
        .layoutPriority(1)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Plate calculator")
        .accessibilityValue([plan.text.isEmpty ? "No plates" : plan.text, plan.miss(unit: unit.rawValue)].compactMap(\.self).joined(separator: ", "))
    }

    @ViewBuilder
    private func baseButton(_ label: String, isIgnored: Bool) -> some View {
        let text = PlateBaseLabel(label: label, isIgnored: isIgnored)
        if let onBase {
            Button(action: onBase) { text.contentShape(.rect) }
                .buttonStyle(.plain)
                .accessibilityLabel(isIgnored ? "\(label), left out" : label)
                .accessibilityHint(isIgnored ? "Counts the \(plan.loading.base == .bar ? "bar" : "base") again" : "Leaves it out so the plates make the weight")
        } else {
            text
        }
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

    private func barMenu(_ onBar: @escaping (Double) -> Void) -> some View {
        Menu {
            Picker("Bar Weight", selection: Binding(get: { plan.loading.ownBaseWeight }, set: onBar)) {
                ForEach(plan.loading.baseWeights, id: \.self) { Text("\(NumberText.plain($0)) \(unit.rawValue)").tag($0) }
            }
        } label: {
            Chip(title: "\(NumberText.plain(plan.loading.ownBaseWeight)) \(unit.rawValue) bar", systemImage: "chevron.up.chevron.down")
        }
        .accessibilityLabel("Bar weight, \(NumberText.plain(plan.loading.ownBaseWeight)) \(unit.rawValue)")
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
                    .fill(Theme.plate(plate.weight, unit: unit))
                    .frame(
                        width: plate.isBumper ? thickness * 1.6 : thickness,
                        height: plate.isBumper ? height : height * (0.35 + 0.65 * plate.weight / heaviest)
                    )
                    .overlay {
                        if plate.isBumper {
                            RoundedRectangle(cornerRadius: isExpanded ? 3 : 1).strokeBorder(.black.opacity(0.5), lineWidth: isExpanded ? 2 : 1)
                        }
                        if isExpanded {
                            Text(NumberText.plain(plate.weight))
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
}
