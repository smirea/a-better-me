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

struct WeeklyNutritionCard: View {
    let week: [NutritionMetrics.DayNutrition]
    let today: CalendarDay
    let overages: Bool
    @State private var shown = NutritionShown.consumed

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Weekly Nutrition").font(AppFont.title())
            Grid(alignment: .leading, horizontalSpacing: 6, verticalSpacing: 8) {
                ForEach(NutritionMetrics.macros, id: \.self) { id in
                    GridRow {
                        rowLabel(id).frame(width: 18)
                        ForEach(week, id: \.day) { cell(id, $0) }
                    }
                }
                GridRow {
                    Color.clear.frame(width: 18, height: 1)
                    ForEach(week, id: \.day) { day in
                        Text(day.day.date(in: .current).formatted(.dateTime.weekday(.abbreviated)))
                            .font(day.day == today ? AppFont.headline(12) : AppFont.caption(12))
                            .foregroundStyle(day.day == today ? Theme.textPrimary : Theme.textSecondary)
                            .frame(maxWidth: .infinity)
                    }
                }
            }
            NutritionShownPicker(shown: $shown)
        }
    }

    @ViewBuilder
    private func rowLabel(_ id: NutrientID) -> some View {
        if id == .energy {
            Image(systemName: "flame.fill").font(.caption).foregroundStyle(DashboardColor.energy).accessibilityLabel("Calories")
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
                    Capsule().fill(DashboardColor.nutrient(id)).frame(height: 26 * fill)
                }
            VStack(alignment: .leading, spacing: 0) {
                Text(value.map { Int($0.rounded()).formatted() } ?? "--").font(AppFont.headline(11))
                Text(target.map { Int($0.rounded()).formatted() } ?? "--").font(AppFont.caption(10)).foregroundStyle(Theme.textSecondary)
            }
            .lineLimit(1)
            .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(id.dashboardLabel) \(day.day.date(in: .current).formatted(.dateTime.weekday(.wide)))")
        .accessibilityValue("\(value.map { Int($0.rounded()).formatted() } ?? "none") \(shown.rawValue.lowercased()) of \(target.map { Int($0.rounded()).formatted() } ?? "no target")")
    }
}

private struct NutritionShownPicker: View {
    @Binding var shown: NutritionShown

    var body: some View {
        Picker("Show", selection: $shown) {
            ForEach(NutritionShown.allCases, id: \.self) { Text($0.rawValue).tag($0) }
        }
        .pickerStyle(.segmented)
        .frame(maxWidth: 260)
        .frame(maxWidth: .infinity)
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
            Text("Daily Nutrition").font(AppFont.title())
            HStack {
                sideStat(shown == .consumed ? remaining : consumed, shown == .consumed ? "Remaining" : "Consumed")
                gauge(center: center, title: shown.rawValue, fill: target.map { $0 > 0 ? (center ?? 0) / $0 : 0 } ?? 0)
                sideStat(target, "Target")
            }
            HStack(spacing: 18) {
                ForEach([NutrientID.protein, .fat, .carbs], id: \.self) { macroBar($0) }
            }
            NutritionShownPicker(shown: $shown)
        }
    }

    private func sideStat(_ value: Double?, _ title: String) -> some View {
        VStack(spacing: 2) {
            Text(value.map { Int($0.rounded()).formatted() } ?? "--").font(AppFont.number(19))
            Text(title).font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }

    /// MacroFactor's 270° gauge, open at the bottom.
    private func gauge(center: Double?, title: String, fill: Double) -> some View {
        ZStack {
            Circle().trim(from: 0, to: 0.75)
                .stroke(Theme.surfaceRaised, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                .rotationEffect(.degrees(135))
            Circle().trim(from: 0, to: 0.75 * min(max(fill, 0), 1))
                .stroke(DashboardColor.energy, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                .rotationEffect(.degrees(135))
            VStack(spacing: 0) {
                Text(center.map { Int($0.rounded()).formatted() } ?? "--").font(AppFont.number(26))
                Text(title).font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
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
            Text(id.dashboardLabel).font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
            GeometryReader { proxy in
                Capsule().fill(Theme.surfaceRaised)
                    .overlay(alignment: .leading) {
                        Capsule().fill(DashboardColor.nutrient(id)).frame(width: proxy.size.width * min(max(fill, 0), 1))
                    }
            }
            .frame(height: 4)
            Text("\(value.map { Int($0.rounded()).formatted() } ?? "--") / \(target.map { "\(Int($0.rounded()))g" } ?? "--")")
                .font(AppFont.headline(12))
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }
}

struct EnergyBalanceFocusCard: View {
    enum Reference: String, CaseIterable {
        case expenditure = "Expenditure", targets = "Targets"
    }

    let data: DashboardData
    @State private var reference = Reference.expenditure

    private static let days = 30

    var body: some View {
        let interval = DateInterval(
            start: data.calendar.date(byAdding: .day, value: -(Self.days - 1), to: data.calendar.startOfDay(for: data.now))!,
            end: data.calendar.date(byAdding: .day, value: 1, to: data.calendar.startOfDay(for: data.now))!
        )
        let intake = data.intake.inside(interval)
        let line = (reference == .expenditure ? data.expenditurePoints : data.energyTargets).inside(interval)
        let differences = NutritionMetrics.differences(intake: intake, reference: line, calendar: data.calendar)
        // The three terms are means over the days that have both intake and a reference, so they add up.
        let paired = Set(differences.map(\.date))
        let meanDifference = differences.average
        let meanIntake = paired.isEmpty ? intake.average : intake.filter { paired.contains($0.date) }.average
        let meanReference = meanDifference.flatMap { difference in meanIntake.map { $0 - difference } } ?? line.average
        let lineColor = reference == .expenditure ? DashboardColor.expenditure : DashboardColor.fat
        VStack(alignment: .leading, spacing: 10) {
            Text("Energy Balance").font(AppFont.title())
            BalanceChart(bars: intake, line: line, lineColor: lineColor, domain: interval)
                .frame(height: 110)
            Text("Last 30 Days").font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
                .frame(maxWidth: .infinity, alignment: .trailing)
            HStack(alignment: .top) {
                term(meanIntake, "Nutrition", symbol: "chart.bar.fill", color: DashboardColor.energy)
                Text("−").font(AppFont.number(17))
                term(meanReference, reference.rawValue, symbol: "line.diagonal", color: lineColor)
                Text("=").font(AppFont.number(17))
                term(meanDifference, "Difference", symbol: nil, color: Theme.textSecondary)
            }
            Picker("Compare With", selection: $reference) {
                ForEach(Reference.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .frame(maxWidth: 260)
            .frame(maxWidth: .infinity)
        }
    }

    private func term(_ value: Double?, _ title: String, symbol: String?, color: Color) -> some View {
        VStack(spacing: 2) {
            Text(value.map { Int($0.rounded()).formatted() } ?? "N/A").font(AppFont.number(17))
            Label {
                Text(title)
            } icon: {
                if let symbol { Image(systemName: symbol).foregroundStyle(color) }
            }
            .font(AppFont.caption(12))
            .foregroundStyle(Theme.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }
}

/// Daily intake bars with a dashed reference line, the Energy Balance chart.
struct BalanceChart: View {
    let bars: [DatedValue]
    let line: [DatedValue]
    let lineColor: Color
    let domain: DateInterval
    var showsAxis = false

    var body: some View {
        let high = max((bars + line).map(\.value).max() ?? 0, 1)
        Chart {
            ForEach(bars, id: \.date) { point in
                BarMark(x: .value("Date", point.date, unit: .day), y: .value("Calories", point.value), width: .ratio(0.6))
                    .foregroundStyle(DashboardColor.energy)
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
    let data: DashboardData

    var body: some View {
        let today = data.calendar.startOfDay(for: data.now)
        let interval = DateInterval(start: data.calendar.date(byAdding: .day, value: -6, to: today)!, end: data.calendar.date(byAdding: .day, value: 1, to: today)!)
        let reference = data.expenditurePoints.inside(interval)
        let differences = NutritionMetrics.differences(intake: data.intake, reference: reference, calendar: data.calendar)
        let mean = NutritionMetrics.trailingMean(differences, days: 7, now: data.now, calendar: data.calendar)
        NavigationLink(value: DashboardRoute.energyBalance) {
            DashboardCard(
                title: "Energy Balance", period: "Last 7 Days", value: mean.map { Int(abs($0).rounded()).formatted() },
                unit: (mean ?? 0) > 0 ? "kcal surplus" : "kcal deficit"
            ) {
                BalanceChart(bars: data.intake.inside(interval), line: reference, lineColor: DashboardColor.expenditure, domain: interval)
            }
        }
    }
}

struct GoalProgressInsightCard: View {
    let data: DashboardData

    var body: some View {
        let progress = GoalProgressValues(data: data, source: .scale)
        NavigationLink(value: DashboardRoute.goalProgress) {
            DashboardCard(
                title: "Goal Progress",
                period: progress.map { "Last \($0.days) Days" } ?? "No Goal",
                value: progress?.percent.map { Int($0.rounded()).formatted() },
                unit: "%"
            ) {
                GeometryReader { proxy in
                    Capsule().fill(Theme.surfaceRaised)
                        .overlay(alignment: .leading) {
                            Capsule().fill(DashboardColor.goal).frame(width: proxy.size.width * (progress?.percent ?? 0) / 100)
                        }
                        .frame(height: 8)
                        .frame(maxHeight: .infinity)
                }
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
