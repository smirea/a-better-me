import Feedback
import SwiftUI

struct DashboardCard<Chart: View>: View {
    let title: String
    let period: String
    let value: String?
    let unit: String
    @ViewBuilder let chart: Chart

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title).font(AppFont.headline(16)).lineLimit(1)
            Text(period).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
            chart
                .frame(height: 50)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
            Divider().overlay(Theme.separator)
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(value ?? "--").font(AppFont.number(17))
                Text(unit).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
                Spacer(minLength: 0)
                Image(systemName: "chevron.forward").font(.footnote.weight(.semibold)).foregroundStyle(Theme.textTertiary)
            }
            .padding(.top, 10)
        }
        .card()
        .contentShape(.rect)
        .accessibilityElement(children: .combine)
        .feedback(self)
    }
}

/// Drawn rather than charted: a Swift Charts chart per card costs a layout pass of its own on every dashboard render.
struct MiniBars: View {
    let values: [Double]
    let color: Color
    /// One per value, overriding `color`.
    var colors: [Color]?
    /// Drawn as a dashed rule, and the scale reaches it.
    var goal: Double?
    /// The value a full-height bar stands for, when the scale is fixed instead of fitted, as a range ping's steps.
    var top: Double?

    var body: some View {
        Canvas { context, size in
            guard !values.isEmpty else { return }
            let top = top ?? max(values.max() ?? 0, goal ?? 0, 1)
            let band = size.width / CGFloat(values.count)
            for (index, value) in values.enumerated() {
                let height = size.height * value / top
                let bar = CGRect(x: band * (CGFloat(index) + 0.15), y: size.height - height, width: band * 0.7, height: height)
                context.fill(RoundedRectangle(cornerRadius: 2).path(in: bar), with: .color(colors?[index] ?? color))
            }
            if let goal {
                let y = size.height * (1 - goal / top)
                var rule = Path()
                rule.move(to: CGPoint(x: 0, y: y))
                rule.addLine(to: CGPoint(x: size.width, y: y))
                context.stroke(rule, with: .color(Theme.textTertiary), style: StrokeStyle(lineWidth: 1, dash: [2, 3]))
            }
        }
    }
}

struct MiniLine: View {
    let values: [Double]
    let color: Color
    var rightAlignedSlots = 7
    var showsPoints = true

    var body: some View {
        Canvas { context, size in
            let offset = max(rightAlignedSlots - values.count, 0)
            let low = values.min() ?? 0
            let high = values.max() ?? 1
            let pad = max((high - low) * 0.15, 0.5)
            let x = (low: -0.3, high: Double(rightAlignedSlots - 1) + 0.3)
            let y = (low: low - pad, high: high + pad)
            let points = values.enumerated().map { index, value in
                CGPoint(
                    x: size.width * (Double(index + offset) - x.low) / (x.high - x.low),
                    y: size.height * (1 - (value - y.low) / (y.high - y.low))
                )
            }
            var line = Path()
            line.addLines(points)
            context.stroke(line, with: .color(color), style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
            // Swift Charts' symbol size 30 is an area: a 5.5 pt circle with its 1.5 pt border inside it.
            let radius = 30.squareRoot() / 2 - 0.75
            for point in points where showsPoints {
                let dot = Path(ellipseIn: CGRect(x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2))
                context.stroke(dot, with: .color(color), lineWidth: 1.5)
            }
        }
    }
}

/// Thirty days as dots, oldest first. A level is how strongly a day draws, from 0 for an empty day to 1, so a habit is
/// on or off and a count shades by how much.
struct DotGrid: View {
    let levels: [Double]
    let color: Color

    init(levels: [Double], color: Color) {
        self.levels = levels
        self.color = color
    }

    init(days: [Bool], color: Color) {
        self.init(levels: days.map { $0 ? 1 : 0 }, color: color)
    }

    var body: some View {
        // Each dot centers in a flexible column, so ten fit a half-width card at any screen size.
        Grid(horizontalSpacing: 0, verticalSpacing: 6) {
            ForEach(0..<3, id: \.self) { row in
                GridRow {
                    ForEach(0..<10, id: \.self) { column in
                        let index = row * 10 + column
                        let level = levels.indices.contains(index) ? levels[index] : 0
                        RoundedRectangle(cornerRadius: 2)
                            .fill(level > 0 ? color.opacity(0.3 + 0.7 * level) : Theme.surfaceRaised)
                            .frame(width: 9, height: 9)
                            .frame(maxWidth: .infinity)
                    }
                }
            }
        }
    }
}
