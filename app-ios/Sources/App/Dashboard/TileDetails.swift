import Foundation

struct MacrosCardValues: Equatable {
    /// The last 7 days' calories from protein, fat, and carbs, oldest first.
    var days: [[Double]]
    var text: String?
}

/// What the nutrient detail's footer shows besides the per-day list.
struct NutrientSummary: Equatable {
    var nutrient: NutrientID
    var name: String
    var unit: String
    var today: CalendarDay
    var consumedToday: Double
    var range: NutrientRange
}

extension DashboardData {
    private var latestWeightKg: Double? { trend.last?.value }

    private func nutrientRange(_ id: NutrientID, on day: CalendarDay) -> NutrientRange {
        TileMetrics.range(id, on: day, plans: plans, goals: goals, sex: profile.sex, weightKg: latestWeightKg)
    }

    func nutrientTile(_ card: NutritionCard) -> TileMetrics.Tile {
        guard let id = card.nutrient, let nutrient = NutrientRegistry.nutrient(id) else {
            return TileMetrics.Tile(text: nil, unit: "", consumed: 0, range: NutrientRange())
        }
        let consumed = log.first { $0.day == today }?.consumed.amount(of: id) ?? 0
        return TileMetrics.tile(consumed: consumed, range: nutrientRange(id, on: today), display: card.display, unit: nutrient.unit.rawValue)
    }

    var macrosCard: MacrosCardValues {
        let days = (0..<7).reversed().map { today.adding(days: -$0) }
        let consumed = days.map { day in log.first { $0.day == day }?.consumed ?? [:] }
        let bars = consumed.map { [($0[.protein] ?? 0) * 4, ($0[.fat] ?? 0) * 9, ($0[.carbs] ?? 0) * 4] }
        let logged = consumed.compactMap { $0[.energy] }.filter { $0 > 0 }
        let average = logged.isEmpty ? nil : logged.reduce(0, +) / Double(logged.count)
        return MacrosCardValues(days: bars, text: average.map { Int($0.rounded()).formatted() })
    }

    func bodyMetricCard(_ card: BodyMetricCard) -> CardValues {
        let series = bodySeries(card)
        let last = series.suffix(7).map(\.value)
        return CardValues(values: last, text: series.last.map { format(card, $0.value) })
    }

    func nutrientDetail(_ id: NutrientID) -> MetricDetail {
        let nutrient = NutrientRegistry.nutrient(id)
        let unit = nutrient?.unit.rawValue ?? ""
        let days = TileMetrics.nutrientDays(id, log: log, plans: plans, goals: goals, sex: profile.sex, weightKg: latestWeightKg, calendar: calendar)
        let color = Theme.macro(id)
        return MetricDetail(title: nutrient?.name ?? id.rawValue, tabs: [MetricTab(
            title: nutrient?.name ?? id.rawValue, points: days.consumed, unit: unit, averageTitle: "Average",
            summary: .total, style: .bar, color: color,
            overlay: days.target.isEmpty ? nil : MetricTab.Overlay(title: "Target", points: days.target, color: Theme.textPrimary, dashed: true)
        )], footer: .nutrient(NutrientSummary(
            nutrient: id, name: nutrient?.name ?? id.rawValue, unit: unit, today: today,
            consumedToday: log.first { $0.day == today }?.consumed.amount(of: id) ?? 0, range: nutrientRange(id, on: today)
        )))
    }

    var macrosDetail: MetricDetail {
        let logged = log.filter { $0.entryCount > 0 || $0.hasOverride }
        let tabs = [(NutrientID.protein, "Protein"), (.fat, "Fat"), (.carbs, "Carbs")].map { id, title in
            MetricTab(
                title: title, points: logged.map { DatedValue(date: $0.day.date(in: calendar), value: $0.consumed.amount(of: id) ?? 0) },
                unit: "g", averageTitle: "Average \(title)", summary: .total, style: .bar, color: Theme.macro(id)
            )
        }
        return MetricDetail(title: "Macros", tabs: tabs, footer: .macros(logged.reversed().compactMap { day in
            TileMetrics.split(day.consumed).map { (date: day.day.date(in: calendar), split: $0) }
        }))
    }

    func bodyMetricDetail(_ card: BodyMetricCard) -> MetricDetail {
        let unit = card.unit(weight: self.unit, height: nutritionSettings.heightUnit)
        return MetricDetail(title: card.title, tabs: [MetricTab(
            title: card.title, points: bodySeries(card).map { DatedValue(date: $0.date, value: display(card, $0.value)) }, unit: unit,
            averageTitle: "Average", summary: .change, style: .line, color: Theme.green
        )], footer: .months)
    }

    private func bodySeries(_ card: BodyMetricCard) -> [DatedValue] {
        TileMetrics.bodySeries(card, metrics: bodyMetrics, heightCm: profile.heightCm, calendar: calendar)
    }

    private func display(_ card: BodyMetricCard, _ value: Double) -> Double {
        card.isLength ? nutritionSettings.heightUnit.fromCm(value) : value
    }

    private func format(_ card: BodyMetricCard, _ value: Double) -> String {
        switch card {
        case .waistToHeight, .waistToHip: value.formatted(.number.precision(.fractionLength(2)))
        default: display(card, value).dashboardText
        }
    }
}
