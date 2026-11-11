import Charts
import Feedback
import SwiftUI

/// What one Steps bar can show: its count over it, its flights and distance inside it.
struct StepBar: Equatable {
    var steps: Double
    /// Empty when the day has none, which hides that line.
    var flights: String
    var distance: String
}

/// How much of each bar's labels fit, the same for every bar of a range. Pedometer++ labels a bar only where its text
/// fits the bar's width, so a denser range drops the flights and distance first, then shortens the counts, then drops
/// them.
enum BarLabelStyle: Equatable {
    case detailed, full, compact, hidden

    /// The stairs glyph and its gap after the flights count.
    static let glyphWidth: CGFloat = 14

    /// A count must fit the bar's slot, the gap included; the flights and distance must fit inside the bar itself.
    static func fitting(_ bars: [StepBar], slot: CGFloat, barWidth: CGFloat, count: (String) -> CGFloat, detail: (String) -> CGFloat) -> BarLabelStyle {
        let inside = barWidth - 6
        func fits(_ style: BarLabelStyle) -> Bool { bars.allSatisfy { count(style.text($0.steps)) <= slot } }
        if fits(.full), bars.allSatisfy({ bar in
            (bar.flights.isEmpty || detail(bar.flights) + glyphWidth <= inside) && (bar.distance.isEmpty || detail(bar.distance) <= inside)
        }) {
            return .detailed
        }
        return fits(.full) ? .full : fits(.compact) ? .compact : .hidden
    }

    func text(_ value: Double) -> String {
        switch self {
        case .detailed, .full: value.wholeText
        case .compact: value.formatted(.number.notation(.compactName).precision(.significantDigits(2)))
        case .hidden: ""
        }
    }
}

/// Each Steps bar's count over it in its tier's color and, where they fit, its flights and distance inside its foot,
/// placed from the chart's own positions so the labels sit on their bars at any range. A count masks the goal line
/// where it crosses it.
struct StepBarLabels: View {
    static let countFont = UIFont(name: "DMSans-SemiBold", size: 15) ?? .systemFont(ofSize: 15, weight: .semibold)
    static let detailFont = UIFont(name: "DMSans-SemiBold", size: 13) ?? .systemFont(ofSize: 13, weight: .semibold)
    /// A bar's share of its slot; the rest is the gap between bars.
    static let barRatio = 0.88
    /// The plot's top share left free for the tallest bar's count.
    static let headroom = 0.1

    let proxy: ChartProxy
    let points: [DatedValue]
    /// Each bar's middle, so the narrowest gap between two is the room a label has.
    let centers: [Date]
    let goal: Int
    let bars: [StepBar]

    /// Measures every bar's text, so it runs once per bar width rather than on every frame of a scroll.
    @State private var styles = ViewMemo<StyleKey, BarLabelStyle>()

    var body: some View {
        GeometryReader { geometry in
            if let frame = proxy.plotFrame, let baseline = proxy.position(forY: 0.0) {
                let plot = geometry[frame]
                // A scrolled chart positions every bar, so only the ones on screen get labels.
                let shown = shown(width: plot.width)
                let xs = shown.map { (index: $0, x: proxy.position(forX: centers[$0])) }
                let slot = zip(xs.dropFirst(), xs).compactMap { next, x in next.x.flatMap { a in x.x.map { a - $0 } } }.min() ?? plot.width
                let style = styles(StyleKey(slot: slot.rounded(), bars: bars)) {
                    BarLabelStyle.fitting(bars, slot: slot, barWidth: slot * Self.barRatio, count: { Self.width($0, Self.countFont) }, detail: { Self.width($0, Self.detailFont) })
                }
                if style != .hidden {
                    ForEach(xs, id: \.index) { index, x in
                        let point = points[index]
                        if let x, let top = proxy.position(forY: point.value) {
                            Text(style.text(point.value))
                                .font(Font(Self.countFont))
                                .foregroundStyle(StepGoal.tier(point.value, goal: goal).color)
                                .lineLimit(1)
                                .fixedSize()
                                .padding(.horizontal, 1)
                                .background(Theme.background, in: .rect(cornerRadius: 3))
                                .position(x: plot.minX + x, y: plot.minY + top - 11)
                            if style == .detailed {
                                let inside = detail(bars[index])
                                if baseline - top >= inside.height + 10 {
                                    inside.view.position(x: plot.minX + x, y: plot.minY + baseline - inside.height / 2 - 5)
                                }
                            }
                        }
                    }
                }
            }
        }
        .clipped()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    /// The bars whose middles fall on the plot or one bar beyond either edge, found by bisection.
    private func shown(width: CGFloat) -> Range<Int> {
        guard centers.count > 1 else { return centers.indices }
        func x(_ index: Int) -> CGFloat { proxy.position(forX: centers[index]) ?? 0 }
        func first(after edge: CGFloat) -> Int {
            var low = 0
            var high = centers.count
            while low < high {
                let middle = (low + high) / 2
                if x(middle) < edge { low = middle + 1 } else { high = middle }
            }
            return low
        }
        return max(first(after: 0) - 1, 0)..<min(first(after: width) + 1, centers.count)
    }

    private func detail(_ bar: StepBar) -> (view: some View, height: CGFloat) {
        let lines = (bar.flights.isEmpty ? 0 : 1) + (bar.distance.isEmpty ? 0 : 1)
        let view = VStack(spacing: 0) {
            if !bar.flights.isEmpty {
                HStack(spacing: 2) {
                    Text(bar.flights)
                    StairsGlyph().frame(width: 10, height: 10)
                }
            }
            if !bar.distance.isEmpty { Text(bar.distance) }
        }
        .font(Font(Self.detailFont))
        .foregroundStyle(.black.opacity(0.8))
        .lineLimit(1)
        .fixedSize()
        return (view, CGFloat(lines) * Self.detailFont.lineHeight)
    }

    private static func width(_ text: String, _ font: UIFont) -> CGFloat {
        ceil((text as NSString).size(withAttributes: [.font: font]).width)
    }
}

/// Under the Steps chart's days, Pedometer++'s bracket over the whole range: its steps, its distance, and the total as a
/// share of the goal over every day of the range, in that share's tier color.
struct StepsRangeSummary: View {
    let steps: StepsSummary
    let unit: NutritionSettings.DistanceUnit

    var body: some View {
        let color = steps.tier.color
        let parts = [steps.total.wholeText] + (steps.distance > 0 ? [unit.text(meters: steps.distance)] : [])
            + ["\(Int((steps.goalShare * 100).rounded()))% of Goal"]
        HStack(spacing: 8) {
            BracketArm(leading: true).stroke(color, style: StrokeStyle(lineWidth: 2, lineCap: .round))
            Text(parts.joined(separator: " · "))
                .font(AppFont.medium(17))
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .layoutPriority(1)
            BracketArm(leading: false).stroke(color, style: StrokeStyle(lineWidth: 2, lineCap: .round))
        }
        .frame(height: 24)
        .feedback("Steps Range Summary", data: steps)
    }
}

/// Pedometer++'s filled three-step stairs, which no SF Symbol draws.
private struct StairsGlyph: Shape {
    func path(in rect: CGRect) -> Path {
        let step = rect.width / 3
        let rise = rect.height / 3
        return Path { path in
            path.move(to: CGPoint(x: rect.minX, y: rect.maxY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
            for index in 1...2 {
                path.addLine(to: CGPoint(x: rect.maxX - step * CGFloat(index), y: rect.minY + rise * CGFloat(index - 1)))
                path.addLine(to: CGPoint(x: rect.maxX - step * CGFloat(index), y: rect.minY + rise * CGFloat(index)))
            }
            path.addLine(to: CGPoint(x: rect.minX, y: rect.minY + rise * 2))
            path.closeSubpath()
        }
    }
}

/// One half of the bracket: a rule at the text's middle that curves up at the range's outer edge.
private struct BracketArm: Shape {
    let leading: Bool

    func path(in rect: CGRect) -> Path {
        let outer = leading ? rect.minX + 1 : rect.maxX - 1
        let inner = leading ? rect.maxX : rect.minX
        let turn = leading ? outer + 8 : outer - 8
        var path = Path()
        path.move(to: CGPoint(x: inner, y: rect.midY))
        path.addLine(to: CGPoint(x: turn, y: rect.midY))
        path.addQuadCurve(to: CGPoint(x: outer, y: rect.minY + 2), control: CGPoint(x: outer, y: rect.midY))
        return path
    }
}

struct StepGoalSheet: View {
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var goal: Int

    init(goal: Int) { _goal = State(initialValue: goal) }

    var body: some View {
        NavigationStack {
            Picker("Daily Step Goal", selection: $goal) {
                ForEach(StepGoal.choices, id: \.self) { Text("\(Double($0).wholeText) steps").tag($0) }
            }
            .pickerStyle(.wheel)
            .padding(.horizontal, Theme.margin)
            .detailTitle("Daily Step Goal")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save", role: .confirm) {
                        store.updateSettings { $0.profile.dailyStepGoal = goal }
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.height(320)])
        .feedback(self)
    }
}

private struct StyleKey: Equatable {
    var slot: CGFloat
    var bars: [StepBar]
}
