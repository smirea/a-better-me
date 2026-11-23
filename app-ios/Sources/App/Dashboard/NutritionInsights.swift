import Feedback
import SwiftUI

/// The "Insights & Data" blocks under the nutrition detail charts (docs/research/macrofactor/README.md §3.2-3.5).
struct ExpenditureInsights: View {
    let summary: ExpenditureSummary

    var body: some View {
        let changes = summary.changes
        let strategy = summary.strategy
        FlatSection("Insights & Data", spacing: 12) {
            ChangeRows(changes: changes, color: Theme.coral, tolerance: 0.5) {
                "\($0.wholeText) cal"
            }
            InsightTiles(tiles: [
                InsightTile(value: summary.currentKcal?.wholeText ?? "--", unit: "cal", title: "Current Expenditure"),
                InsightTile(value: strategy?.title ?? "--", title: "Current Strategy"),
            ])
            DataSources(sources: [
                ("Nutrition Data Manager", "cylinder.split.1x2", .nutritionData),
                ("Scale Weight", "scalemass", .scaleWeight),
            ])
        }
        .feedback(self)
    }
}

extension NutritionExpenditure.ExpenditureStrategy {
    var title: String {
        switch self {
        case .updating: "Updating"
        case .holding: "Holding"
        case .fixed: "Static"
        }
    }
}

struct WeightTrendInsights: View {
    let summary: WeightTrendSummary
    let unit: WeightUnit

    var body: some View {
        let changes = summary.changes
        let insights = summary.insights
        let losing = (insights?.weeklyChangeKg ?? 0) < 0
        FlatSection("Insights & Data", spacing: 12) {
            ChangeRows(changes: changes, color: Theme.weightTrend, tolerance: unit.toKg(0.05)) {
                "\(unit.fromKg($0).dashboardText) \(unit.rawValue)"
            }
            InsightTiles(tiles: [
                InsightTile(value: insights.map { unit.fromKg($0.currentKg).dashboardText } ?? "--", unit: unit.rawValue, title: "Current Weight"),
                InsightTile(value: insights?.weeklyChangeKg.map { signed(unit.fromKg($0)) } ?? "--", unit: "\(unit.rawValue)/wk", title: "Weekly Change"),
                InsightTile(value: insights?.energyBalanceKcal.map { abs($0).wholeText } ?? "--", unit: "cal/day", title: losing ? "Energy Deficit" : "Energy Surplus"),
                InsightTile(value: insights?.projectionKg.map { unit.fromKg($0).dashboardText } ?? "--", unit: unit.rawValue, title: "30-Day Projection"),
            ])
            DataSources(sources: [("Scale Weight", "scalemass", .scaleWeight)])
        }
        .feedback(self)
    }

    private func signed(_ value: Double) -> String {
        (value > 0 ? "+" : "") + value.dashboardText
    }
}

struct EnergyBalanceInsights: View {
    let rows: [(days: Int, mean: Double?)]
    let isExpenditure: Bool

    var body: some View {
        FlatSection("Insights & Data", spacing: 12) {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(rows, id: \.days) { row in
                    HStack {
                        Text("\(row.days)-day").font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary).frame(width: 52, alignment: .leading)
                        if let mean = row.mean { BalanceTag(balance: NutritionMetrics.balance(mean), isExpenditure: isExpenditure) }
                        Spacer()
                        Text(row.mean.map { "\(BalanceTag.signed($0)) cal" } ?? "--").font(AppFont.number(15))
                    }
                    .accessibilityElement(children: .combine)
                }
            }
            .feedback("Balance Changes", data: rows)
        }
        .feedback(self)
    }
}

struct BalanceTag: View {
    let balance: NutritionMetrics.Balance
    let isExpenditure: Bool

    static func signed(_ value: Double) -> String {
        (Int(value.rounded()) > 0 ? "+" : "") + value.wholeText
    }

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

    var color: Color { isExpenditure ? Theme.coral : Theme.fat }

    var body: some View {
        Label {
            Text(title).foregroundStyle(Theme.textSecondary)
        } icon: {
            Image(systemName: symbol).foregroundStyle(color)
        }
        .font(AppFont.rowDetail)
    }
}

/// 3- to 90-day change rows with a sparkline, as on the Expenditure and Weight Trend details.
private struct ChangeRows: View {
    let changes: [NutritionMetrics.Change]
    let color: Color
    let tolerance: Double
    let format: (Double) -> String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(changes, id: \.days) { change in
                let direction = NutritionMetrics.direction(change.delta, tolerance: tolerance)
                HStack(spacing: 12) {
                    Text("\(change.days)-day").font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary).frame(width: 52, alignment: .leading)
                    MiniLine(values: change.values, color: color, rightAlignedSlots: max(change.values.count, 2), showsPoints: false)
                        .frame(width: 70, height: 18)
                    Spacer()
                    Text(change.delta.map(format) ?? "--").font(AppFont.number(15))
                    Image(systemName: direction.symbol)
                        .font(AppFont.rowDetail)
                        .foregroundStyle(Theme.textSecondary)
                        .frame(width: 16)
                        .accessibilityLabel(direction.title)
                }
                .accessibilityElement(children: .combine)
            }
        }
        .feedback(self)
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
    var unit: String? = nil
    var title: String
}

struct InsightTiles: View {
    let tiles: [InsightTile]

    private var columnCount: Int {
        tiles.count == 3 || tiles.count >= 5 ? 3 : 2
    }

    var body: some View {
        let columns = Array(repeating: GridItem(.flexible(), spacing: 12, alignment: .leading), count: columnCount)
        LazyVGrid(columns: columns, alignment: .leading, spacing: 16) {
            ForEach(tiles, id: \.title) { tile in
                StatView(title: tile.title, value: tile.value, unit: tile.unit)
            }
        }
        .padding(.vertical, 4)
        .feedback(self)
    }
}

private struct DataSources: View {
    let sources: [(title: String, symbol: String, route: DashboardRoute)]

    var body: some View {
        FlatSection("Data Sources", spacing: 0) {
            ForEach(Array(sources.enumerated()), id: \.offset) { index, source in
                if index > 0 { Divider().overlay(Theme.separator).padding(.leading, 40) }
                NavigationLink(value: source.route) {
                    HStack {
                        RowLabel(title: source.title, systemImage: source.symbol)
                        Spacer()
                        Image(systemName: "chevron.forward").font(.footnote.weight(.semibold)).foregroundStyle(Theme.textTertiary)
                    }
                    .padding(.vertical, 12)
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
            }
        }
        .feedback(self)
    }
}
