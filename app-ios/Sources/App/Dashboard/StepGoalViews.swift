import Charts
import Feedback
import SwiftUI

/// Above the Steps chart, as Pedometer++ leads with it: the current streak with the best one and the last 30 days
/// under it, and the flights climbed over the chart's range.
struct StepsHeader: View {
    let summary: StepGoal.Summary
    let flights: Double
    let rangeLabel: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Current Streak").font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Image(systemName: "flame.fill").font(AppFont.headline(17)).foregroundStyle(summary.streak > 0 ? Theme.goal : Theme.textTertiary)
                        Text("\(summary.streak)").font(AppFont.number())
                        Text(summary.streak == 1 ? "day" : "days").font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
                    }
                }
                .accessibilityElement(children: .combine)
                .feedback("Current Streak", data: summary.streakDays)
                Spacer(minLength: 12)
                VStack(alignment: .trailing, spacing: 2) {
                    Text("Flights Climbed").font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Image(systemName: "figure.stairs").font(AppFont.headline(15)).foregroundStyle(Theme.textSecondary)
                        Text(flights.wholeText).font(AppFont.number())
                        Text(flights == 1 ? "flight" : "flights").font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
                    }
                    Text(rangeLabel).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
                }
                .accessibilityElement(children: .combine)
                .feedback("Flights Climbed", data: (flights: flights, range: rangeLabel))
            }
            Text("Best streak \(summary.best) \(summary.best == 1 ? "day" : "days") · Goal met \(summary.metLast30) of the last 30 days")
                .font(AppFont.rowDetail)
                .foregroundStyle(Theme.textSecondary)
                .feedback("Best Streak and Goal Days", data: (best: summary.best, metLast30: summary.metLast30))
        }
        .feedback(self)
    }
}

/// How much of a count fits over a bar. Pedometer++ labels a bar only when its count fits the bar's width, so a dense
/// range shortens the counts and then drops them.
enum BarLabelStyle: Equatable {
    case full, compact, hidden

    /// The longest label of the style must fit a bar's slot, so every bar of a range reads the same way.
    static func fitting(_ values: [Double], slot: CGFloat, width: (String) -> CGFloat) -> BarLabelStyle {
        for style in [BarLabelStyle.full, .compact] where values.allSatisfy({ width(style.text($0)) <= slot }) {
            return style
        }
        return .hidden
    }

    func text(_ value: Double) -> String {
        switch self {
        case .full: value.wholeText
        case .compact: value.formatted(.number.notation(.compactName).precision(.significantDigits(2)))
        case .hidden: ""
        }
    }
}

/// The Steps chart's counts over each bar, with the flights climbed under them, and the bracket over the current
/// streak, placed from the chart's own positions so a label sits on its bar at any range. Each label masks the goal
/// line where it crosses it.
struct StepBarLabels: View {
    static let countFont = UIFont(name: "DMSans-SemiBold", size: 11) ?? .systemFont(ofSize: 11, weight: .semibold)
    static let flightsFont = UIFont(name: "DMSans-Regular", size: 10) ?? .systemFont(ofSize: 10)
    static let bracketFont = UIFont(name: "DMSans-SemiBold", size: 12) ?? .systemFont(ofSize: 12, weight: .semibold)
    /// The plot's top share left free for the labels and the bracket.
    static let headroom = 0.2

    let proxy: ChartProxy
    let points: [DatedValue]
    /// Each bar's middle, so the narrowest gap between two is the room a label has.
    let centers: [Date]
    /// Flights per drawn bar, keyed like `points`.
    let flights: [Date: Double]
    /// Days of the current streak inside the range, when the bars are days.
    let streak: (first: Date, last: Date)?
    let streakLength: Int

    var body: some View {
        GeometryReader { geometry in
            if let frame = proxy.plotFrame {
                let plot = geometry[frame]
                let xs = centers.map { proxy.position(forX: $0) }
                let slot = zip(xs.dropFirst(), xs).compactMap { next, x in next.flatMap { a in x.map { a - $0 } } }.min() ?? plot.width
                let style = BarLabelStyle.fitting(points.map(\.value), slot: slot) { Self.width($0, Self.countFont) }
                if style != .hidden {
                    ForEach(Array(points.enumerated()), id: \.element.date) { index, point in
                        if let x = xs[index], let y = proxy.position(forY: point.value) {
                            label(style.text(point.value), flights: flights[point.date] ?? 0, slot: slot)
                                .frame(width: max(slot, 1), height: 40, alignment: .bottom)
                                .position(x: plot.minX + x, y: plot.minY + y - 22)
                        }
                    }
                }
                if let streak, let first = proxy.position(forX: streak.first), let last = proxy.position(forX: streak.last) {
                    let left = plot.minX + first - slot * 0.4
                    let right = plot.minX + last + slot * 0.4
                    if right - left >= Self.width(streakText, Self.bracketFont) + 28 {
                        bracket(from: left, to: right, y: plot.minY + 10)
                    }
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private var streakText: String { streakLength == 1 ? "1 day" : "\(streakLength) days" }

    private func label(_ count: String, flights: Double, slot: CGFloat) -> some View {
        let flightsText = flights.wholeText
        return VStack(spacing: 1) {
            Text(count).font(Font(Self.countFont)).foregroundStyle(Theme.textPrimary)
            if flights > 0, Self.width(flightsText, Self.flightsFont) + 11 <= slot {
                HStack(spacing: 1) {
                    Image(systemName: "figure.stairs").font(.system(size: 8, weight: .semibold))
                    Text(flightsText).font(Font(Self.flightsFont))
                }
                .foregroundStyle(Theme.textSecondary)
            }
        }
        .lineLimit(1)
        .fixedSize()
        .padding(.horizontal, 1)
        .background(Theme.background, in: .rect(cornerRadius: 3))
    }

    private func bracket(from left: CGFloat, to right: CGFloat, y: CGFloat) -> some View {
        ZStack {
            Path { path in
                path.move(to: CGPoint(x: left, y: y + 8))
                path.addQuadCurve(to: CGPoint(x: left + 6, y: y), control: CGPoint(x: left, y: y))
                path.addLine(to: CGPoint(x: max(right - 6, left + 6), y: y))
                path.addQuadCurve(to: CGPoint(x: right, y: y + 8), control: CGPoint(x: right, y: y))
            }
            .stroke(Theme.goal, style: StrokeStyle(lineWidth: 2, lineCap: .round))
            Text(streakText)
                .font(Font(Self.bracketFont))
                .foregroundStyle(Theme.goal)
                .padding(.horizontal, 5)
                .background(Theme.background)
                .fixedSize()
                .position(x: (left + right) / 2, y: y)
        }
    }

    private static func width(_ text: String, _ font: UIFont) -> CGFloat {
        ceil((text as NSString).size(withAttributes: [.font: font]).width)
    }
}

/// Opened from the Steps screen's toolbar.
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
            .navigationTitle("Daily Step Goal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", role: .cancel) { dismiss() }
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
