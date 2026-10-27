import Charts
import SwiftUI

/// Chart series colors with no other meaning in the app.
extension Theme {
    static let weightTrend = Color(hex: 0xA99BF0)
    static let scaleOnTrend = Color(hex: 0x6E5BB8)
    static let exercise = Color(hex: 0x8EC9E8)
    static let records = Color(hex: 0xF5C842)
    static let goalTowards = Color(hex: 0x1F5A3A)
}

/// A number with its title and unit. Regular stats lead a detail screen's chart; compact ones flank a focus card's
/// ring or sum.
struct StatView: View {
    enum Size { case regular, compact }

    let title: String
    let value: String
    var unit: String?
    var size = Size.regular
    /// A compact stat's series symbol, tying it to its chart.
    var symbol: (name: String, color: Color)?

    var body: some View {
        Group {
            switch size {
            case .regular:
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text(value).font(AppFont.number())
                        if let unit { Text(unit).font(AppFont.caption()).foregroundStyle(Theme.textSecondary) }
                    }
                }
            case .compact:
                VStack(spacing: 2) {
                    Text(value).font(AppFont.number(19))
                    Group {
                        if let symbol {
                            Label { Text(title) } icon: { Image(systemName: symbol.name).foregroundStyle(symbol.color) }
                        } else {
                            Text(title)
                        }
                    }
                    .font(AppFont.rowDetail)
                    .foregroundStyle(Theme.textSecondary)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// The key under a chart: one symbol and title per series.
struct ChartLegend: View {
    struct Item {
        var title: String
        var symbol: String
        var color: Color
    }

    let items: [Item]

    var body: some View {
        HStack(spacing: 20) {
            ForEach(items, id: \.title) { item in
                Label { Text(item.title) } icon: { Image(systemName: item.symbol).foregroundStyle(item.color) }
            }
        }
        .font(AppFont.chip)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Theme.surface, in: .rect(cornerRadius: Theme.smallCornerRadius))
    }
}

/// A ring on a raised track, filled clockwise. An `arc` under 1 leaves the gap at the bottom, as the calorie gauge.
struct ProgressRing: View {
    let fraction: Double
    let color: Color
    var lineWidth: CGFloat = 5
    var arc = 1.0

    var body: some View {
        let style = StrokeStyle(lineWidth: lineWidth, lineCap: .round)
        ZStack {
            Circle().trim(from: 0, to: arc).stroke(Theme.surfaceRaised, style: style)
            Circle().trim(from: 0, to: arc * min(max(fraction, 0), 1)).stroke(color, style: style)
        }
        .rotationEffect(.degrees(arc < 1 ? 90 + 180 * (1 - arc) : -90))
    }
}

/// A focus card's segmented picker, capped so two or three options don't stretch across the card.
struct CardPicker<Value: Hashable, Options: View>: View {
    let title: String
    @Binding var selection: Value
    @ViewBuilder let options: Options

    init(_ title: String, selection: Binding<Value>, @ViewBuilder options: () -> Options) {
        self.title = title
        _selection = selection
        self.options = options()
    }

    var body: some View {
        Picker(title, selection: $selection) { options }
            .pickerStyle(.segmented)
            .frame(maxWidth: 260)
            .frame(maxWidth: .infinity)
    }
}

extension View {
    /// Values on the trailing edge over dashed grid lines.
    func themedYAxis() -> some View {
        chartYAxis {
            AxisMarks(position: .trailing) { _ in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [3, 3])).foregroundStyle(Theme.separator)
                AxisValueLabel().foregroundStyle(Theme.textSecondary)
            }
        }
    }
}
