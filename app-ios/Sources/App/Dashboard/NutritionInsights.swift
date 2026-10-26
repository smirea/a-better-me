import SwiftUI

/// The "Insights & Data" blocks under the nutrition detail charts (docs/research/macrofactor/README.md §3.2-3.5).
struct ExpenditureInsights: View {
    let data: DashboardData

    var body: some View {
        let changes = NutritionMetrics.changes(data.expenditurePoints, now: data.now, calendar: data.calendar)
        let strategy = NutritionMetrics.strategy(data.expenditure, settings: data.nutritionSettings.expenditure)
        VStack(alignment: .leading, spacing: 12) {
            Text("Insights & Data").font(AppFont.title())
            ChangeRows(title: "Expenditure Changes", changes: changes, color: DashboardColor.expenditure, tolerance: 0.5) {
                "\(Int($0.rounded()).formatted()) kcal"
            }
            InsightTiles(tiles: [
                InsightTile(
                    value: data.expenditure.last.map { Int($0.kcal.rounded()).formatted() } ?? "--", unit: "kcal",
                    title: "Current Expenditure",
                    text: "The latest estimate of your daily energy expenditure based on your weight trend and nutrition data."
                ),
                InsightTile(value: strategy?.title ?? "--", unit: nil, title: "Current Strategy", text: strategy?.explanation ?? Self.missing),
            ])
            DataSources(sources: [
                ("Nutrition Data Manager", "cylinder.split.1x2", .nutritionData),
                ("Scale Weight", "scalemass", .scaleWeight),
            ])
        }
    }

    static let missing = "Log your weight and nutrition, and add your height and birth date in Settings, to start the estimate."
}

extension NutritionMetrics.ExpenditureStrategy {
    var title: String {
        switch self {
        case .updating: "Updating"
        case .holding: "Holding"
        case .fixed: "Static"
        }
    }

    var explanation: String {
        switch self {
        case .updating: "Your expenditure updates each day from the last four weeks of nutrition and weight trend data."
        case .holding: "Holding safeguards your expenditure estimate against insufficient data. Updating requires at least 3 days of nutrition data and 1 day of weight data per 7-day period."
        case .fixed: "You have set a static number for your daily energy expenditure."
        }
    }
}

struct WeightTrendInsights: View {
    let data: DashboardData

    var body: some View {
        let changes = NutritionMetrics.changes(data.trend, now: data.now, calendar: data.calendar)
        let insights = NutritionMetrics.weightInsights(trend: data.trend, now: data.now, calendar: data.calendar)
        let unit = data.unit
        let losing = (insights?.weeklyChangeKg ?? 0) < 0
        VStack(alignment: .leading, spacing: 12) {
            Text("Insights & Data").font(AppFont.title())
            ChangeRows(title: "Weight Changes", changes: changes, color: DashboardColor.trend, tolerance: unit.toKg(0.05)) {
                "\(unit.fromKg($0).dashboardText) \(unit.rawValue)"
            }
            InsightTiles(tiles: [
                InsightTile(
                    value: insights.map { unit.fromKg($0.currentKg).dashboardText } ?? "--", unit: unit.rawValue, title: "Current Weight",
                    text: "Our estimate of your true weight after smoothing out day-to-day fluctuations."
                ),
                InsightTile(
                    value: insights?.weeklyChangeKg.map { signed(unit.fromKg($0)) } ?? "--", unit: "\(unit.rawValue)/wk", title: "Weekly Weight Change",
                    text: "Your typical weekly rate of weight \(losing ? "loss" : "gain") over the past three weeks."
                ),
                InsightTile(
                    value: insights?.energyBalanceKcal.map { Int(abs($0).rounded()).formatted() } ?? "--", unit: "kcal/day",
                    title: losing ? "Energy Deficit" : "Energy Surplus",
                    text: "Our estimate of your average daily caloric \(losing ? "deficit" : "surplus"), based on your rate of weight \(losing ? "loss" : "gain") over the past three weeks."
                ),
                InsightTile(
                    value: insights?.projectionKg.map { unit.fromKg($0).dashboardText } ?? "--", unit: unit.rawValue, title: "30-Day Projection",
                    text: "Your projected weight in 30 days if your current rate of weight \(losing ? "loss" : "gain") is met."
                ),
            ])
            DataSources(sources: [("Scale Weight", "scalemass", .scaleWeight)])
        }
    }

    private func signed(_ value: Double) -> String {
        (value > 0 ? "+" : "") + value.formatted(.number.precision(.fractionLength(0...2)))
    }
}

struct EnergyBalanceInsights: View {
    let data: DashboardData
    let tab: MetricTab

    var body: some View {
        let isExpenditure = tab.id == "Expenditure"
        let differences = NutritionMetrics.differences(intake: tab.points, reference: tab.overlay?.points ?? [], calendar: data.calendar)
        let rows = NutritionMetrics.changeSpans.map { (days: $0, mean: NutritionMetrics.trailingMean(differences, days: $0, now: data.now, calendar: data.calendar)) }
        VStack(alignment: .leading, spacing: 12) {
            Text("Insights & Data").font(AppFont.title())
            VStack(alignment: .leading, spacing: 12) {
                Text(isExpenditure ? "Relative to Expenditure" : "Relative to Targets").font(AppFont.headline(16))
                ForEach(rows, id: \.days) { row in
                    HStack {
                        Text("\(row.days)-day").font(AppFont.caption(13)).foregroundStyle(Theme.textSecondary).frame(width: 60, alignment: .leading)
                        Text(row.mean.map { "\(signed($0)) kcal" } ?? "--").font(AppFont.headline(14))
                        Spacer()
                        if let mean = row.mean { BalanceTag(balance: NutritionMetrics.balance(mean), isExpenditure: isExpenditure) }
                    }
                    .accessibilityElement(children: .combine)
                }
            }
            .padding(14)
            .background(Theme.surface, in: .rect(cornerRadius: Theme.cornerRadius))
        }
        MonthList(rows: differences.reversed().map { day in
            let tag = BalanceTag(balance: NutritionMetrics.balance(day.value), isExpenditure: isExpenditure)
            return MonthRow(date: day.date, text: "\(signed(day.value)) kcal", tag: MonthRow.Tag(text: tag.title, symbol: tag.symbol, color: tag.color))
        }, calendar: data.calendar)
    }

    private func signed(_ value: Double) -> String {
        let rounded = Int(value.rounded())
        return (rounded > 0 ? "+" : "") + rounded.formatted()
    }
}

private struct BalanceTag: View {
    let balance: NutritionMetrics.Balance
    let isExpenditure: Bool

    var title: String {
        switch (balance, isExpenditure) {
        case (.balanced, true): "Balance"
        case (.above, true): "Surplus"
        case (.below, true): "Deficit"
        case (.balanced, false): "At Target"
        case (.above, false): "Above Target"
        case (.below, false): "Below Target"
        }
    }

    var symbol: String {
        switch balance {
        case .balanced: isExpenditure ? "scale.3d" : "equal"
        case .above: "arrowtriangle.up.fill"
        case .below: "arrowtriangle.down.fill"
        }
    }

    var color: Color { isExpenditure ? DashboardColor.expenditure : DashboardColor.fat }

    var body: some View {
        Label {
            Text(title).foregroundStyle(Theme.textSecondary)
        } icon: {
            Image(systemName: symbol).foregroundStyle(color)
        }
        .font(AppFont.caption(13))
    }
}

/// 3- to 90-day change rows with a sparkline, as on the Expenditure and Weight Trend details.
private struct ChangeRows: View {
    let title: String
    let changes: [NutritionMetrics.Change]
    let color: Color
    let tolerance: Double
    let format: (Double) -> String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(AppFont.headline(16))
            ForEach(changes, id: \.days) { change in
                let direction = NutritionMetrics.direction(change.delta, tolerance: tolerance)
                HStack(spacing: 12) {
                    Text("\(change.days)-day").font(AppFont.caption(13)).foregroundStyle(Theme.textSecondary).frame(width: 52, alignment: .leading)
                    MiniLine(values: change.values, color: color, rightAlignedSlots: max(change.values.count, 2), showsPoints: false)
                        .frame(width: 70, height: 18)
                    Text(change.delta.map(format) ?? "--").font(AppFont.headline(14)).frame(minWidth: 70, alignment: .leading)
                    Spacer()
                    Label(direction.title, systemImage: direction.symbol)
                        .lineLimit(1)
                        .fixedSize()
                        .font(AppFont.caption(13))
                        .foregroundStyle(Theme.textSecondary)
                }
                .accessibilityElement(children: .combine)
            }
        }
        .padding(14)
        .background(Theme.surface, in: .rect(cornerRadius: Theme.cornerRadius))
    }
}

private extension NutritionMetrics.Direction {
    var title: String {
        switch self {
        case .increase: "Increase"
        case .decrease: "Decrease"
        case .noChange: "No Change"
        }
    }

    var symbol: String {
        switch self {
        case .increase: "arrow.up.right"
        case .decrease: "arrow.down.right"
        case .noChange: "arrow.right"
        }
    }
}

struct InsightTile {
    var value: String
    var unit: String?
    var title: String
    var text: String
}

struct InsightTiles: View {
    let tiles: [InsightTile]

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            ForEach(tiles, id: \.title) { tile in
                HStack(alignment: .top, spacing: 14) {
                    VStack(spacing: 2) {
                        Text(tile.value).font(AppFont.number(18)).lineLimit(1).minimumScaleFactor(0.6)
                        if let unit = tile.unit {
                            Text(unit).font(AppFont.caption(11)).foregroundStyle(Theme.textSecondary)
                        }
                    }
                    .frame(width: 86, height: 64)
                    .background(Theme.surfaceRaised, in: .rect(cornerRadius: Theme.smallCornerRadius))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(tile.title).font(AppFont.headline(15))
                        Text(tile.text).font(AppFont.caption(13)).foregroundStyle(Theme.textSecondary)
                    }
                }
                .accessibilityElement(children: .combine)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: .rect(cornerRadius: Theme.cornerRadius))
    }
}

private struct DataSources: View {
    let sources: [(title: String, symbol: String, route: DashboardRoute)]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Data Sources").font(AppFont.title())
            VStack(spacing: 0) {
                ForEach(Array(sources.enumerated()), id: \.offset) { index, source in
                    if index > 0 { Divider().overlay(Theme.separator).padding(.leading, 50) }
                    NavigationLink(value: source.route) {
                        HStack(spacing: 14) {
                            Image(systemName: source.symbol).frame(width: 22)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(source.title).font(AppFont.headline(15))
                                Text("Manage Data").font(AppFont.caption(13)).foregroundStyle(Theme.textSecondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.forward").font(.footnote.weight(.semibold)).foregroundStyle(Theme.textTertiary)
                        }
                        .padding(14)
                        .contentShape(.rect)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(source.title), Manage Data")
                }
            }
            .background(Theme.surface, in: .rect(cornerRadius: Theme.cornerRadius))
        }
    }
}
