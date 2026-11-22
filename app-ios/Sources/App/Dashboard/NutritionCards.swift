import Charts
import SwiftUI

struct BalanceChart: View {
    let bars: [DatedValue]
    let line: [DatedValue]
    let lineColor: Color
    let domain: DateInterval

    var body: some View {
        let high = max((bars + line).map(\.value).max() ?? 0, 1)
        Chart {
            ForEach(bars, id: \.date) { point in
                BarMark(x: .value("Date", point.date, unit: .day), y: .value("Calories", point.value), width: .ratio(0.6))
                    .foregroundStyle(Theme.calories)
            }
            ForEach(line, id: \.date) { point in
                LineMark(x: .value("Date", point.date, unit: .day), y: .value("Reference", point.value), series: .value("Series", "Reference"))
                    .foregroundStyle(lineColor)
                    .lineStyle(StrokeStyle(lineWidth: 1.5, dash: [2, 3]))
            }
        }
        .chartXScale(domain: domain.start...domain.end)
        .chartYScale(domain: 0...(high * 1.1))
        .chartXAxis(.hidden)
        .chartYAxis(.hidden)
        .accessibilityLabel("Energy balance chart")
    }
}

struct EnergyBalanceInsightCard: View {
    let balance: BalanceValues

    var body: some View {
        let mean = balance.meanDifference
        NavigationLink(value: DashboardRoute.energyBalance) {
            DashboardCard(
                title: "Energy Balance", period: "Last 7 Days", value: mean.map { abs($0).wholeText },
                unit: (mean ?? 0) > 0 ? "cal surplus" : "cal deficit"
            ) {
                BalanceChart(bars: balance.bars, line: balance.line, lineColor: Theme.coral, domain: balance.interval)
            }
        }
    }
}

struct GoalProgressInsightCard: View {
    let progress: GoalProgressValues?

    var body: some View {
        NavigationLink(value: DashboardRoute.goalProgress) {
            DashboardCard(
                title: "Goal Progress",
                period: progress.map { "Last \($0.days) Days" } ?? "No Goal",
                value: progress?.percent?.wholeText,
                unit: "%"
            ) {
                ProgressView(value: min(max((progress?.percent ?? 0) / 100, 0), 1))
                    .progressViewStyle(.bar(Theme.goal, height: 8))
            }
        }
    }
}

struct GoalProgressValues {
    enum Source: String, CaseIterable {
        case scale = "Scale Weight", trend = "Trend Weight"
    }

    var goal: NutritionGoal
    var points: [DatedValue]
    /// Days on the current goal.
    var days: Int
    var startKg: Double?
    var currentKg: Double?

    var percent: Double? {
        guard let target = goal.targetWeightKg, goal.kind != .maintain, let startKg, let currentKg else { return nil }
        return NutritionMetrics.goalPercent(startKg: startKg, currentKg: currentKg, targetKg: target)
    }

    init?(data: DashboardData, source: Source) {
        guard let plan = data.goalPlan else { return nil }
        goal = plan.goal
        points = switch source {
        case .scale: DailyCombine.mean.combine(data.weighIns.points, calendar: data.calendar)
        case .trend: data.trend
        }
        let start = goal.startedOn.date(in: data.calendar)
        days = max(NutritionEngine.days(from: start, to: data.now, calendar: data.calendar), 0)
        startKg = NutritionMetrics.value(points, on: start)
        currentKg = points.last?.value
    }
}
