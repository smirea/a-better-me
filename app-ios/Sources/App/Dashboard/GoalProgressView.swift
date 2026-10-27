import Charts
import SwiftUI

/// MacroFactor's Goal Progress detail: a monthly waterfall of the distance to the target on scale or trend weight.
/// It has no range pills because the waterfall always spans the current goal.
struct GoalProgressView: View {
    private var values = DashboardValues()
    @State private var source = GoalProgressValues.Source.scale

    private var context: DashboardContext { values.context }

    var body: some View {
        let progress = values.goalProgress(source)
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                tabStrip
                if let progress {
                    let bars = NutritionMetrics.waterfall(progress.points, goal: progress.goal, now: context.today, calendar: context.calendar)
                    if bars.isEmpty {
                        ContentUnavailableView(
                            "No Distance to Track", systemImage: "equal.circle",
                            description: Text("A goal to maintain has no distance to track. Set a target weight to lose or gain toward in Strategy.")
                        )
                    } else {
                        header(bars)
                        chart(bars).frame(height: 320)
                        legend
                    }
                    insights(progress)
                } else {
                    ContentUnavailableView(
                        "No Weight Goal", systemImage: "target", description: Text("Set a weight goal in Strategy to track your progress toward it.")
                    )
                }
            }
            .padding(.horizontal, Theme.margin)
            .padding(.bottom, 30)
        }
        .background(Theme.background)
        .detailTitle("Goal Progress")
    }

    private var tabStrip: some View {
        Picker("Weight", selection: $source) {
            ForEach(GoalProgressValues.Source.allCases, id: \.self) { Text($0.rawValue).tag($0) }
        }
        .pickerStyle(.segmented)
    }

    private func header(_ bars: [NutritionMetrics.WaterfallBar]) -> some View {
        let remaining = bars.last.map { $0.low < 0 ? $0.low : $0.high } ?? 0
        return StatView(title: "Distance", value: context.unit.fromKg(max(remaining, 0)).dashboardText, unit: context.unit.rawValue)
    }

    /// The x axis is categorical, one slot per bar, so the remaining bar gets its own slot beside the last month's.
    private func chart(_ bars: [NutritionMetrics.WaterfallBar]) -> some View {
        Chart(Array(bars.enumerated()), id: \.offset) { index, bar in
            BarMark(
                x: .value("Month", String(index)),
                yStart: .value("From", context.unit.fromKg(bar.low)),
                yEnd: .value("To", context.unit.fromKg(bar.high)),
                width: .ratio(0.7)
            )
            .foregroundStyle(color(bar.kind))
        }
        .chartXAxis {
            let step = bars.count > 7 ? 4 : 1
            AxisMarks { value in
                AxisValueLabel {
                    if let index = value.as(String.self).flatMap(Int.init) {
                        if bars[index].kind == .remaining {
                            Text("Left")
                        } else if index % step == 0 {
                            Text("Month \(bars[index].month)")
                        }
                    }
                }
                .foregroundStyle(Theme.textSecondary)
            }
        }
        .themedYAxis()
        .accessibilityLabel("Goal progress waterfall")
    }

    private func color(_ kind: NutritionMetrics.WaterfallBar.Kind) -> Color {
        switch kind {
        case .start, .away: Theme.goal
        case .towards: Theme.goalTowards
        case .remaining: Theme.surfaceRaised
        }
    }

    private var legend: some View {
        ChartLegend(items: [
            ChartLegend.Item(title: "Away", symbol: "square.fill", color: Theme.goal),
            ChartLegend.Item(title: "Towards", symbol: "square.fill", color: Theme.goalTowards),
            ChartLegend.Item(title: "Distance", symbol: "square.fill", color: Theme.surfaceRaised),
        ])
    }

    private func insights(_ progress: GoalProgressValues) -> some View {
        let goal = progress.goal
        let rate = NutritionEngine.Goal(
            kind: goal.kind == .lose ? .lose : goal.kind == .gain ? .gain : .maintain,
            ratePercentPerWeek: abs(goal.ratePercentPerWeek), targetWeightKg: goal.targetWeightKg
        )
        let eta = progress.currentKg
            .flatMap { NutritionEngine.Targets.estimatedDays(goal: rate, weightKg: $0) }
            .map { context.calendar.date(byAdding: .day, value: $0, to: context.today)! }
        return VStack(alignment: .leading, spacing: 12) {
            SectionHeader("Insights & Data")
            InsightTiles(tiles: [
                InsightTile(
                    value: goal.targetWeightKg.map { context.unit.fromKg($0).dashboardText } ?? "--", unit: context.unit.rawValue,
                    title: "Target Weight", text: "The target you selected during goal creation."
                ),
                InsightTile(value: progress.days.formatted(), unit: "days", title: "Duration", text: "The number of days that you have spent pursuing your current goal."),
                InsightTile(
                    value: eta.map { $0.formatted(.dateTime.month(.abbreviated).day()) } ?? "--", unit: eta.map { $0.formatted(.dateTime.year()) },
                    title: "Optimistic ETA",
                    text: "Estimate of when you would reach your goal if you achieve and sustain your intended rate of weight change based on \(source == .scale ? "scale" : "trend") weight."
                ),
            ])
        }
    }
}
