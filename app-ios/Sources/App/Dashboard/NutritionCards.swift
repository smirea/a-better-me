import Charts
import Feedback
import SwiftUI

enum NutritionShown: String, CaseIterable {
    case consumed = "Consumed", remaining = "Remaining"
}

struct WeeklyNutritionFocus: View {
    private var values = DashboardValues()

    var body: some View {
        let context = values.context
        let settings = values.nutritionSettings
        WeeklyNutritionCard(
            week: values.week(settings.summaryNutrients, overages: settings.showOverages),
            today: CalendarDay(context.today, in: context.calendar), calendar: context.calendar
        )
        .feedback(self)
    }
}

struct DailyNutritionFocus: View {
    private var values = DashboardValues()

    var body: some View {
        let settings = values.nutritionSettings
        DailyNutritionCard(lines: values.todaySummary(settings.summaryNutrients, overages: settings.showOverages))
            .feedback(self)
    }
}

/// The week's summary columns, a row each, against each day's targets.
struct WeeklyNutritionCard: View {
    let week: [NutritionMetrics.DaySummary]
    let today: CalendarDay
    let calendar: Calendar
    @State private var shown = NutritionShown.consumed

    var body: some View {
        let columns = week.first?.lines.map(\.nutrient) ?? []
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader("Weekly Nutrition")
            Grid(alignment: .leading, horizontalSpacing: 6, verticalSpacing: 8) {
                ForEach(Array(columns.enumerated()), id: \.element) { index, id in
                    GridRow {
                        id.columnLabel
                            .font(AppFont.headline(12))
                            .accessibilityLabel(id.title)
                            .frame(width: 20)
                        ForEach(week, id: \.day) { cell($0.lines[index], on: $0.day) }
                    }
                }
                GridRow {
                    Color.clear.frame(width: 20, height: 1)
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

    private func cell(_ line: MacroLine, on day: CalendarDay) -> some View {
        let value = shown == .consumed ? line.total : line.remaining
        let fill = line.fill(.eaten)?.eaten ?? 0
        return HStack(alignment: .top, spacing: 3) {
            Capsule()
                .fill(Theme.surfaceRaised)
                .frame(width: 5, height: 26)
                .overlay(alignment: .bottom) {
                    Capsule().fill(line.nutrient.color).frame(height: 26 * fill)
                }
            VStack(alignment: .leading, spacing: 0) {
                Text(value?.wholeText ?? "--").font(AppFont.badge)
                Text(line.target?.wholeText ?? "--").font(AppFont.caption(10)).foregroundStyle(Theme.textSecondary)
            }
            .lineLimit(1)
            .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(line.nutrient.title) \(day.date(in: calendar).formatted(.dateTime.weekday(.wide)))")
        .accessibilityValue("\(value?.wholeText ?? "none") \(shown.rawValue.lowercased()) of \(line.target?.wholeText ?? "no target")")
    }
}

private func shownPicker(_ shown: Binding<NutritionShown>) -> some View {
    CardPicker("Show", selection: shown) {
        ForEach(NutritionShown.allCases, id: \.self) { Text($0.rawValue).tag($0) }
    }
}

/// Today's first summary column as a gauge, calories unless the owner moved them, and the other columns as bars.
struct DailyNutritionCard: View {
    let lines: [MacroLine]
    @State private var shown = NutritionShown.consumed

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader("Daily Nutrition")
            if let first = lines.first {
                let center = shown == .consumed ? first.total : first.remaining
                let other = shown == .consumed ? first.remaining : first.total
                // Calories need no name; any other first column says which nutrient and unit the gauge measures.
                let unit = first.nutrient == .energy ? "" : " g"
                let title = first.nutrient == .energy ? shown.rawValue : "\(first.nutrient.title) \(shown.rawValue.lowercased())"
                HStack {
                    StatView(title: shown == .consumed ? "Remaining" : "Consumed", value: other.map { "\($0.wholeText)\(unit)" } ?? "--", size: .compact)
                    gauge(center: center, title: title, fill: first.fill(shown == .consumed ? .eaten : .remaining)?.eaten ?? 0, color: first.nutrient.color)
                    StatView(title: "Target", value: first.target.map { "\($0.wholeText)\(unit)" } ?? "--", size: .compact)
                }
            }
            HStack(spacing: 18) {
                ForEach(lines.dropFirst()) { macroBar($0) }
            }
            shownPicker($shown)
        }
    }

    /// MacroFactor's 270° gauge, open at the bottom.
    private func gauge(center: Double?, title: String, fill: Double, color: Color) -> some View {
        ZStack {
            ProgressRing(fraction: fill, color: color, lineWidth: 6, arc: 0.75)
            VStack(spacing: 0) {
                Text(center?.wholeText ?? "--").font(AppFont.number(26))
                Text(title).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .padding(.horizontal, 10)
        }
        .frame(width: 112, height: 112)
        .accessibilityElement(children: .combine)
    }

    private func macroBar(_ line: MacroLine) -> some View {
        let value = shown == .consumed ? line.total : line.remaining
        let unit = line.nutrient == .energy ? "" : "g"
        return VStack(spacing: 4) {
            Text(line.nutrient.title).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
            TargetBar(fill: line.fill(shown == .consumed ? .eaten : .remaining) ?? MacroLine.Fill(eaten: 0, plate: 0), color: line.nutrient.color)
            Text("\(value?.wholeText ?? "--") / \(line.target.map { "\($0.wholeText)\(unit)" } ?? "--")")
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
        let lineColor = reference == .expenditure ? Theme.coral : Theme.fat
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader("Energy Balance")
            BalanceChart(bars: balance.bars, line: balance.line, lineColor: lineColor, domain: balance.interval, scrubbing: reference.rawValue)
                .frame(height: 110)
                .feedback("Energy Balance Chart", data: (reference: reference, bars: balance.bars))
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
        .feedback(self)
    }
}

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
