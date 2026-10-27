import Foundation
@testable import App
import Testing

struct TileMetricsTests {
    private let utc: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }()

    @Test func tileStatesConsumedPercentAndRemaining() {
        let range = NutrientRange(target: 170)
        #expect(TileMetrics.tile(consumed: 85, range: range, display: .consumed, unit: "g") == TileMetrics.Tile(text: "85", unit: "g", consumed: 85, range: range))
        #expect(TileMetrics.tile(consumed: 85, range: range, display: .percent, unit: "g") == TileMetrics.Tile(text: "50", unit: "%", consumed: 85, range: range))
        #expect(TileMetrics.tile(consumed: 200, range: range, display: .remaining, unit: "g") == TileMetrics.Tile(text: "-30", unit: "g left", consumed: 200, range: range))
    }

    @Test func tileWithoutATargetFallsBackToConsumed() {
        let floorOnly = NutrientRange(floor: 10)
        #expect(TileMetrics.tile(consumed: 12.5, range: floorOnly, display: .remaining, unit: "g").text == "12.5")
        #expect(TileMetrics.tile(consumed: 12.5, range: floorOnly, display: .percent, unit: "g").unit == "g")
        #expect(TileMetrics.tile(consumed: 1234.4, range: NutrientRange(), display: .consumed, unit: "mg").text == "1,234")
    }

    @Test func smallAmountsKeepTheirDecimals() {
        #expect(TileMetrics.tile(consumed: 0.4, range: NutrientRange(), display: .consumed, unit: "mg").text == "0.4")
        #expect(TileMetrics.tile(consumed: 1, range: NutrientRange(target: 1.2), display: .remaining, unit: "mg").text == "0.2")
        #expect(TileMetrics.tile(consumed: 12.34, range: NutrientRange(), display: .consumed, unit: "mcg").text == "12.3")
        #expect(MetricTab(title: "Waist to Height", points: [], unit: "ratio", averageTitle: "Average", summary: .change, style: .line, color: .white).format(0.4722) == "0.47")
    }

    @Test func macroSplitIsTheShareOfCalories() {
        let split = TileMetrics.split([.protein: 100, .fat: 50, .carbs: 175])
        #expect(split == TileMetrics.MacroSplit(protein: 400.0 / 1550, fat: 450.0 / 1550, carbs: 700.0 / 1550))
        #expect(split?.text == "26% P • 29% F • 45% C")
        #expect(TileMetrics.split([:]) == nil)
    }

    @Test func bodySeriesConvertsRatiosFromTheSameDay() {
        let metrics = [
            BodyMetric(.waist, on: CalendarDay("2026-10-01")!, value: 80),
            BodyMetric(.hips, on: CalendarDay("2026-10-01")!, value: 100),
            BodyMetric(.waist, on: CalendarDay("2026-10-02")!, value: 81),
            BodyMetric(.visualBodyFat, on: CalendarDay("2026-10-02")!, value: 18),
        ]
        let first = CalendarDay("2026-10-01")!.date(in: utc)
        let second = CalendarDay("2026-10-02")!.date(in: utc)
        #expect(TileMetrics.bodySeries(.waistToHip, metrics: metrics, heightCm: 180, calendar: utc) == [DatedValue(date: first, value: 0.8)])
        #expect(TileMetrics.bodySeries(.waistToHeight, metrics: metrics, heightCm: 160, calendar: utc) == [
            DatedValue(date: first, value: 0.5), DatedValue(date: second, value: 81.0 / 160),
        ])
        #expect(TileMetrics.bodySeries(.waistToHeight, metrics: metrics, heightCm: nil, calendar: utc).isEmpty)
        #expect(TileMetrics.bodySeries(.visualBodyFat, metrics: metrics, heightCm: nil, calendar: utc) == [DatedValue(date: second, value: 18)])
    }

    @Test func availableBodyMetricsFollowVisibility() {
        #expect(BodyMetricCard.available(visible: []) == [.scaleWeight, .visualBodyFat])
        #expect(BodyMetricCard.available(visible: [.waist, .neck]) == [.scaleWeight, .visualBodyFat, .neck, .waist, .waistToHeight])
        #expect(BodyMetricCard.available(visible: [.waist, .hips]) == [.scaleWeight, .visualBodyFat, .waist, .hips, .waistToHeight, .waistToHip])
    }

    @Test func microTargetsComeFromGoalsAndMacroTargetsFromThePlan() {
        let day = CalendarDay("2026-10-05")!
        let custom = NutrientGoal("291", from: CalendarDay("2026-10-01")!, mode: .custom(NutrientRange(floor: 20, target: 40, ceiling: nil)))
        #expect(TileMetrics.range("291", on: day, plans: [], goals: [custom], sex: .male, weightKg: nil) == NutrientRange(floor: 20, target: 40, ceiling: nil))
        #expect(TileMetrics.range(.protein, on: day, plans: [], goals: [], sex: .male, weightKg: nil) == NutrientRange())
    }

    @Test func layoutsSavedBeforeRevisionTwoAdoptNutritionAndVisualBodyFat() throws {
        let old = #"{"revision":1,"sections":["insights","habits","bodyMetrics","general"],"bodyMetrics":["scaleWeight"]}"#
        let adopted = try RowJSON.decoder.decode(DashboardLayout.self, from: Data(old.utf8))
        #expect(adopted.sections == [.insights, .habits, .nutrition, .bodyMetrics, .general])
        #expect(adopted.bodyMetrics == [.scaleWeight, .visualBodyFat])
        #expect(adopted.nutrition == NutritionCard.defaults)
        #expect(NutritionCard.defaults.map(\.id) == ["macros", "k", "p", "291", "c", "539"])
        let saved = #"{"revision":2,"sections":["insights"],"bodyMetrics":["scaleWeight"],"nutrition":[]}"#
        let kept = try RowJSON.decoder.decode(DashboardLayout.self, from: Data(saved.utf8))
        #expect(kept.sections == [.insights])
        #expect(kept.bodyMetrics == [.scaleWeight])
        #expect(kept.nutrition.isEmpty)
    }
}
