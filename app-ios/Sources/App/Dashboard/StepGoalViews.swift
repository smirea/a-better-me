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

/// How much of the bars' labels a range shows. Pedometer++ labels a bar only where its text fits the bar's width, so a
/// denser range drops the flights and distance first, then shortens the counts, then drops them.
enum BarLabelStyle: Equatable {
    case detailed, full, compact, hidden

    /// The stairs glyph and its gap after the flights count.
    static let glyphWidth: CGFloat = 14
    /// The room a bar's foot leaves its flights and distance on either side.
    static let detailInset: CGFloat = 6

    /// What the typical bar's labels fit: its count in the bar's slot, the gap included, and its flights and distance
    /// inside the bar. The chart scrolls through every day of history, and measuring every bar let one long hike there
    /// shorten every count and hide every bar's details (Steps feedback, Nov 2026): DM Sans's digits are proportional,
    /// so "40,800" is wider than a 1W bar's slot on a 393pt phone while "14,012" fits. A bar whose own labels don't fit
    /// drops to what does (`count(_:slot:width:)`, `fitsInside`).
    static func fitting(_ bars: [StepBar], slot: CGFloat, barWidth: CGFloat, count: (String) -> CGFloat, detail: (String) -> CGFloat) -> BarLabelStyle {
        func typical(_ widths: [CGFloat]) -> CGFloat? { widths.isEmpty ? nil : widths.sorted()[widths.count / 2] }
        guard let counts = typical(bars.map { count(BarLabelStyle.full.text($0.steps)) }) else { return .hidden }
        guard counts <= slot else {
            return typical(bars.map { count(BarLabelStyle.compact.text($0.steps)) })! <= slot ? .compact : .hidden
        }
        guard let details = typical(bars.compactMap { detailWidth($0, detail: detail) }) else { return .full }
        return details <= barWidth - detailInset ? .detailed : .full
    }

    /// A bar's count in this style, shortened, then dropped, where it is wider than the slot.
    func count(_ steps: Double, slot: CGFloat, width: (String) -> CGFloat) -> String {
        [text(steps), BarLabelStyle.compact.text(steps)].first { width($0) <= slot } ?? ""
    }

    /// Whether this bar's flights and distance fit inside it.
    static func fitsInside(_ bar: StepBar, barWidth: CGFloat, detail: (String) -> CGFloat) -> Bool {
        (detailWidth(bar, detail: detail) ?? 0) <= barWidth - detailInset
    }

    /// The wider of the flights with their glyph and the distance, or nil for a bar with neither.
    private static func detailWidth(_ bar: StepBar, detail: (String) -> CGFloat) -> CGFloat? {
        guard !bar.flights.isEmpty || !bar.distance.isEmpty else { return nil }
        return max(bar.flights.isEmpty ? 0 : detail(bar.flights) + glyphWidth, bar.distance.isEmpty ? 0 : detail(bar.distance))
    }

    func text(_ value: Double) -> String {
        switch self {
        case .detailed, .full: value.wholeText
        case .compact: value.formatted(.number.notation(.compactName).precision(.significantDigits(2)))
        case .hidden: ""
        }
    }
}

/// The Steps bars' labels: each bar's count over it in its tier's color and, where they fit, its flights and distance
/// inside its foot. `MetricChart` hangs them on each bar as annotations, so they scroll with it.
enum StepBarLabels {
    static let countFont = UIFont(name: "DMSans-SemiBold", size: 15) ?? .systemFont(ofSize: 15, weight: .semibold)
    static let detailFont = UIFont(name: "DMSans-SemiBold", size: 13) ?? .systemFont(ofSize: 13, weight: .semibold)
    /// A bar's share of its slot; the rest is the gap between bars.
    static let barRatio = 0.88
    /// The plot's top share left free for the tallest bar's count.
    static let headroom = 0.1

    static func style(_ bars: [StepBar], slot: CGFloat) -> BarLabelStyle {
        BarLabelStyle.fitting(bars, slot: slot, barWidth: slot * barRatio, count: { width($0, countFont) }, detail: { width($0, detailFont) })
    }

    static func count(_ steps: Double, style: BarLabelStyle, slot: CGFloat) -> String {
        style.count(steps, slot: slot) { width($0, countFont) }
    }

    static func fitsInside(_ bar: StepBar, slot: CGFloat) -> Bool {
        BarLabelStyle.fitsInside(bar, barWidth: slot * barRatio, detail: { width($0, detailFont) })
    }

    /// A bar's distance: whole from 10 up, which keeps a long day's inside its bar.
    static func distance(meters: Double, unit: NutritionSettings.DistanceUnit) -> String {
        unit.text(meters: meters, separator: "", wholeFrom: 10)
    }

    /// Its background masks the goal line where the count crosses it.
    static func count(_ text: String, color: Color) -> some View {
        Text(text)
            .font(Font(countFont))
            .foregroundStyle(color)
            .lineLimit(1)
            .fixedSize()
            .padding(.horizontal, 1)
            .background(Theme.background, in: .rect(cornerRadius: 3))
    }

    static func detail(_ bar: StepBar) -> (view: some View, height: CGFloat) {
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
        .font(Font(detailFont))
        .foregroundStyle(.black.opacity(0.8))
        .lineLimit(1)
        .fixedSize()
        return (view, CGFloat(lines) * detailFont.lineHeight)
    }

    private static func width(_ text: String, _ font: UIFont) -> CGFloat {
        ceil((text as NSString).size(withAttributes: [.font: font]).width)
    }
}

/// Everything the Steps label style is measured from.
struct StepLabelKey: Equatable {
    var slot: CGFloat
    var unit: NutritionSettings.DistanceUnit
    var points: [DatedValue]
    var steps: StepsPlot
}

/// Under the Steps chart's days, Pedometer++'s bracket over the shown range: its steps, its distance, and the total as a
/// share of the goal over every day of the range, in that share's tier color. It follows the chart bar by bar as it
/// scrolls.
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

