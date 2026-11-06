import Charts
import Feedback
import SwiftUI

/// Chart series colors with no other meaning in the app.
extension Theme {
    static let weightTrend = Color(hex: 0xA99BF0)
    static let scaleOnTrend = Color(hex: 0x6E5BB8)
    static let exercise = Color(hex: 0x8EC9E8)
    static let records = Color(hex: 0xF5C842)
    static let goalTowards = Color(hex: 0x1F5A3A)
}

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
        .feedback(self)
    }
}

/// An `arc` under 1 leaves the gap at the bottom, as the calorie gauge.
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
    func themedYAxis() -> some View {
        chartYAxis {
            AxisMarks(position: .trailing) { _ in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [3, 3])).foregroundStyle(Theme.separator)
                AxisValueLabel().foregroundStyle(Theme.textSecondary)
            }
        }
    }
}
