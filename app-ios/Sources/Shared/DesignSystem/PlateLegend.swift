import SwiftUI

/// A plan's legend as the phone's calculator draws it, one entry per plate with its marker, then the base (struck
/// through when the calculator leaves it out), then the miss. It has no container, so the phone wraps it in a flow
/// layout and the watch and the Live Activity keep it on one line.
struct PlateLegendItems<Base: View>: View {
    let plan: PlatePlan
    let unit: WeightUnit
    var markerHeight: CGFloat = 13
    var spacing: CGFloat = 4
    @ViewBuilder var base: (_ label: String, _ isIgnored: Bool) -> Base

    var body: some View {
        let heaviest = plan.perSide.max() ?? 1
        ForEach(Array(plan.loaded.enumerated()), id: \.offset) { _, plate in
            HStack(spacing: spacing) {
                PlateMarker(plate: plate, heaviest: heaviest, unit: unit, height: markerHeight)
                Text(NumberText.plain(plate.weight))
            }
        }
        if let label = plan.baseLabel ?? plan.ignoredBaseLabel {
            if !plan.loaded.isEmpty { Text("+").foregroundStyle(Theme.textSecondary) }
            base(label, plan.baseLabel == nil)
        } else if plan.loaded.isEmpty {
            Text("No plates").foregroundStyle(Theme.textSecondary)
        }
        if let miss = plan.miss(unit: unit.rawValue) { Text(miss).foregroundStyle(Theme.amber) }
    }
}

extension PlateLegendItems where Base == PlateBaseLabel {
    init(plan: PlatePlan, unit: WeightUnit, markerHeight: CGFloat = 13, spacing: CGFloat = 4) {
        self.init(plan: plan, unit: unit, markerHeight: markerHeight, spacing: spacing) { PlateBaseLabel(label: $0, isIgnored: $1) }
    }
}

struct PlateBaseLabel: View {
    let label: String
    let isIgnored: Bool

    var body: some View {
        Text(label).strikethrough(isIgnored).foregroundStyle(isIgnored ? Theme.textTertiary : Theme.textPrimary)
    }
}

/// The legend on one line, shrinking to fit: the watch's set screen and the Live Activity.
struct PlateLine: View {
    let plan: PlatePlan
    let unit: WeightUnit
    var size: CGFloat = 14

    var body: some View {
        // Shrinking text per entry left the markers full size and truncated only the last entry, so the whole line
        // steps down together.
        ViewThatFits(in: .horizontal) {
            line(size)
            line(size * 0.85)
            line(size * 0.7)
            line(size * 0.7).minimumScaleFactor(0.6)
        }
        .foregroundStyle(Theme.textPrimary)
        .lineLimit(1)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Plates \([plan.text, plan.miss(unit: unit.rawValue)].compactMap(\.self).joined(separator: ", "))")
    }

    private func line(_ size: CGFloat) -> some View {
        HStack(spacing: size * 0.35) {
            PlateLegendItems(plan: plan, unit: unit, markerHeight: size * 0.95, spacing: size * 0.2)
        }
        .font(AppFont.number(size))
    }
}

/// A plate as the sleeve draws it, scaled to the legend's text: as tall relative to the heaviest plate, and a bumper
/// full height, wider, and rimmed.
struct PlateMarker: View {
    let plate: PlateLoading.Plate
    let heaviest: Double
    let unit: WeightUnit
    let height: CGFloat

    var body: some View {
        let width = 4 * height / 13
        let shape = RoundedRectangle(cornerRadius: 1.5)
        shape.fill(Theme.plate(plate.weight, unit: unit))
            .overlay { if plate.isBumper { shape.strokeBorder(.black.opacity(0.5), lineWidth: 1) } }
            .frame(
                width: plate.isBumper ? width * 1.6 : width,
                height: plate.isBumper ? height : height * (0.45 + 0.55 * plate.weight / heaviest)
            )
            .frame(height: height)
    }
}

extension Theme {
    /// MF's default plate colors (`live-31`) by lb weight, and the competition colors for kg plates. Any other plate is
    /// gray.
    static func plate(_ weight: Double, unit: WeightUnit) -> Color {
        let pounds = WeightUnit.lb.fromKg(unit.toKg(weight))
        let kilograms = unit.toKg(weight)
        let byPound: [(Double, Color)] = [
            (55, .red), (45, muscle), (35, .yellow), (25, green), (10, Color(white: 0.75)),
            (5, muscle), (2.5, green), (1.25, Color(white: 0.75)), (0.5, Color(white: 0.4)),
        ]
        let byKilogram: [(Double, Color)] = [
            (25, .red), (20, muscle), (15, .yellow), (10, green), (5, .white), (2.5, .red), (1.25, Color(white: 0.75)),
        ]
        if let match = byPound.first(where: { abs($0.0 - pounds) < 0.05 }) { return match.1 }
        if let match = byKilogram.first(where: { abs($0.0 - kilograms) < 0.05 }) { return match.1 }
        return Color(white: 0.55)
    }
}
