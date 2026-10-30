import Charts
import SwiftUI

enum NutritionShown: String, CaseIterable {
    case consumed = "Consumed", remaining = "Remaining"
}

extension NutrientID {
    var dashboardLabel: String {
        switch self {
        case .energy: "Calories"
        case .protein: "Protein"
        case .fat: "Fat"
        case .carbs: "Carbs"
        default: NutrientRegistry.nutrient(self)?.name ?? rawValue
        }
    }
}

struct WeeklyNutritionFocus: View {
    private var values = DashboardValues()

    var body: some View {
        let context = values.context
        WeeklyNutritionCard(
            week: values.week, today: CalendarDay(context.today, in: context.calendar), calendar: context.calendar,
            overages: values.nutritionSettings.showOverages
        )
    }
}

struct DailyNutritionFocus: View {
    private var values = DashboardValues()

    var body: some View {
        DailyNutritionCard(day: values.todayNutrition, overages: values.nutritionSettings.showOverages)
    }
}

struct WeeklyNutritionCard: View {
    let week: [NutritionMetrics.DayNutrition]
    let today: CalendarDay
    let calendar: Calendar
    let overages: Bool
    @State private var shown = NutritionShown.consumed

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader("Weekly Nutrition")
            Grid(alignment: .leading, horizontalSpacing: 6, verticalSpacing: 8) {
                ForEach(NutrientID.macros, id: \.self) { id in
                    GridRow {
                        rowLabel(id).frame(width: 18)
                        ForEach(week, id: \.day) { cell(id, $0) }
                    }
                }
                GridRow {
                    Color.clear.frame(width: 18, height: 1)
                    ForEach(week, id: \.day) { day in
                        Text(day.day.date(in: calendar).formatted(.dateTime.weekday(.abbreviated)))
                            .font(day.day == today ? AppFont.headline(12) : AppFont.rowDetail)
                            .foregroundStyle(day.day == today ? Theme.textPrimary : Theme.textSecondary)
                            .frame(maxWidth: .infinity)
                    }
                }
            }
            shownPicker($shown)
        }
    }

    @ViewBuilder
    private func rowLabel(_ id: NutrientID) -> some View {
        if id == .energy {
            Image(systemName: "flame.fill").font(.caption).foregroundStyle(Theme.calories).accessibilityLabel("Calories")
        } else {
            Text(id.rawValue.uppercased()).font(AppFont.headline(12)).accessibilityLabel(id.dashboardLabel)
        }
    }

    private func cell(_ id: NutrientID, _ day: NutritionMetrics.DayNutrition) -> some View {
        let target = day.target(id)
        let value = shown == .consumed ? day.consumed(id) : day.remaining(id, overages: overages)
        let fill = target.map { $0 > 0 ? min(max(day.consumed(id) / $0, 0), 1) : 0 } ?? 0
        return HStack(alignment: .top, spacing: 3) {
            Capsule()
                .fill(Theme.surfaceRaised)
                .frame(width: 5, height: 26)
                .overlay(alignment: .bottom) {
                    Capsule().fill(id.color).frame(height: 26 * fill)
                }
            VStack(alignment: .leading, spacing: 0) {
                Text(value?.wholeText ?? "--").font(AppFont.badge)
                Text(target?.wholeText ?? "--").font(AppFont.caption(10)).foregroundStyle(Theme.textSecondary)
            }
            .lineLimit(1)
            .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(id.dashboardLabel) \(day.day.date(in: calendar).formatted(.dateTime.weekday(.wide)))")
        .accessibilityValue("\(value?.wholeText ?? "none") \(shown.rawValue.lowercased()) of \(target?.wholeText ?? "no target")")
    }
}

private func shownPicker(_ shown: Binding<NutritionShown>) -> some View {
    CardPicker("Show", selection: shown) {
        ForEach(NutritionShown.allCases, id: \.self) { Text($0.rawValue).tag($0) }
    }
}

struct DailyNutritionCard: View {
    let day: NutritionMetrics.DayNutrition
    let overages: Bool
    @State private var shown = NutritionShown.consumed

    var body: some View {
        let consumed = day.consumed(.energy)
        let target = day.target(.energy)
        let remaining = day.remaining(.energy, overages: overages)
        let center = shown == .consumed ? consumed : remaining
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader("Daily Nutrition")
            HStack {
                StatView(title: shown == .consumed ? "Remaining" : "Consumed", value: (shown == .consumed ? remaining : consumed)?.wholeText ?? "--", size: .compact)
                gauge(center: center, title: shown.rawValue, fill: target.map { $0 > 0 ? (center ?? 0) / $0 : 0 } ?? 0)
                StatView(title: "Target", value: target?.wholeText ?? "--", size: .compact)
            }
            HStack(spacing: 18) {
                ForEach([NutrientID.protein, .fat, .carbs], id: \.self) { macroBar($0) }
            }
            shownPicker($shown)
        }
    }

    /// MacroFactor's 270° gauge, open at the bottom.
    private func gauge(center: Double?, title: String, fill: Double) -> some View {
        ZStack {
            ProgressRing(fraction: fill, color: Theme.calories, lineWidth: 6, arc: 0.75)
            VStack(spacing: 0) {
                Text(center?.wholeText ?? "--").font(AppFont.number(26))
                Text(title).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
            }
        }
        .frame(width: 112, height: 112)
        .accessibilityElement(children: .combine)
    }

    private func macroBar(_ id: NutrientID) -> some View {
        let target = day.target(id)
        let value = shown == .consumed ? day.consumed(id) : day.remaining(id, overages: overages)
        let fill = target.map { $0 > 0 ? (value ?? 0) / $0 : 0 } ?? 0
        return VStack(spacing: 4) {
            Text(id.dashboardLabel).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
            ProgressView(value: min(max(fill, 0), 1)).progressViewStyle(.bar(id.color))
            Text("\(value?.wholeText ?? "--") / \(target.map { "\(Int($0.rounded()))g" } ?? "--")")
                .font(AppFont.headline(12))
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }
}

struct EnergyBalanceFocusCard: View {
    private var values = DashboardValues()
    @State private var reference = BalanceReference.expenditure

    var body: some View {
        let balance = values.balance(reference, days: 30)
        let lineColor = reference == .expenditure ? Theme.accent : Theme.fat
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader("Energy Balance")
            BalanceChart(bars: balance.bars, line: balance.line, lineColor: lineColor, domain: balance.interval, scrubbing: reference.rawValue)
                .frame(height: 110)
            Text("Last 30 Days").font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
                .frame(maxWidth: .infinity, alignment: .trailing)
            HStack(alignment: .top) {
                StatView(title: "Nutrition", value: balance.meanIntake?.wholeText ?? "--", size: .compact, symbol: ("chart.bar.fill", Theme.calories))
                Text("−").font(AppFont.number(19))
                StatView(title: reference.rawValue, value: balance.meanReference?.wholeText ?? "--", size: .compact, symbol: ("line.diagonal", lineColor))
                Text("=").font(AppFont.number(19))
                StatView(title: "Difference", value: balance.meanDifference?.wholeText ?? "--", size: .compact)
            }
            CardPicker("Compare With", selection: $reference) {
                ForEach(BalanceReference.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
        }
    }
}

/// Daily intake bars with a dashed reference line, the Energy Balance chart.
struct BalanceChart: View {
    let bars: [DatedValue]
    let line: [DatedValue]
    let lineColor: Color
    let domain: DateInterval
    /// The reference line's name; set only where the chart isn't a card's link, which a tap must still follow.
    var scrubbing: String?

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
        .modifier(BalanceScrub(bars: bars, line: line, lineColor: lineColor, reference: scrubbing))
        .accessibilityLabel("Energy balance chart")
    }
}

private struct BalanceScrub: ViewModifier {
    let bars: [DatedValue]
    let line: [DatedValue]
    let lineColor: Color
    let reference: String?

    func body(content: Content) -> some View {
        if let reference {
            content.chartScrubbing(bars.map { $0.date.addingTimeInterval(12 * 3600) }, placement: .beside) { index in
                let bar = bars[index]
                var lines = [ChartCallout.Line(label: "Nutrition", value: "\(bar.value.wholeText) kcal", color: Theme.calories)]
                if let value = line.first(where: { $0.date == bar.date })?.value {
                    lines.append(ChartCallout.Line(label: reference, value: "\(value.wholeText) kcal", color: lineColor))
                }
                return ChartCallout(title: bar.date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day()), lines: lines)
            }
        } else {
            content
        }
    }
}

struct EnergyBalanceInsightCard: View {
    let balance: BalanceValues

    var body: some View {
        let mean = balance.meanDifference
        NavigationLink(value: DashboardRoute.energyBalance) {
            DashboardCard(
                title: "Energy Balance", period: "Last 7 Days", value: mean.map { abs($0).wholeText },
                unit: (mean ?? 0) > 0 ? "kcal surplus" : "kcal deficit"
            ) {
                BalanceChart(bars: balance.bars, line: balance.line, lineColor: Theme.accent, domain: balance.interval)
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

/// The current goal measured on scale or trend weight.
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
        case .scale: DailyCombine.mean.combine(data.weighIns.map { DatedValue(date: $0.date, value: $0.kg) }, calendar: data.calendar)
        case .trend: data.trend
        }
        let start = goal.startedOn.date(in: data.calendar)
        days = max(NutritionEngine.days(from: start, to: data.now, calendar: data.calendar), 0)
        startKg = NutritionMetrics.value(points, on: start)
        currentKg = points.last?.value
    }
}
