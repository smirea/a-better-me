import Charts
import Feedback
import SwiftUI

/// Chart series colors with no other meaning in the app.
extension Theme {
    static let weightTrend = Color(hex: 0xA99BF0)
    static let scaleOnTrend = Color(hex: 0x6E5BB8)
    static let exercise = Color(hex: 0x8EC9E8)
    static let goalTowards = Color(hex: 0x1F5A3A)
}

/// Names a chart's series. One series needs no legend, so it draws nothing below two.
struct ChartLegend: View {
    struct Item {
        var title: String
        var symbol: String
        var color: Color
    }

    let items: [Item]

    var body: some View {
        if items.count > 1 {
            HStack(spacing: 16) {
                ForEach(items, id: \.title) { item in
                    Label { Text(item.title) } icon: { Image(systemName: item.symbol).foregroundStyle(item.color) }
                }
            }
            .font(AppFont.chip)
            .foregroundStyle(Theme.textSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .feedback(self)
        }
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
