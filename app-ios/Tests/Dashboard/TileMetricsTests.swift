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
        let consumed = TileMetrics.tile(consumed: 85, target: 170, display: .consumed, unit: "g")
        #expect(consumed == TileMetrics.Tile(text: "85", unit: "g", fill: 85 / (170 / 0.59), tick: 0.59))
        #expect(TileMetrics.tile(consumed: 85, target: 170, display: .percent, unit: "g").text == "50")
        #expect(TileMetrics.tile(consumed: 85, target: 170, display: .percent, unit: "g").unit == "%")
        let remaining = TileMetrics.tile(consumed: 200, target: 170, display: .remaining, unit: "g")
        #expect(remaining.text == "-30")
        #expect(remaining.unit == "g left")
        #expect(remaining.fill == 200 / (170 / 0.59))
    }

    @Test func tileWithoutATargetFallsBackToConsumedAndFillsFully() {
        let tile = TileMetrics.tile(consumed: 12.5, target: nil, display: .remaining, unit: "g")
        #expect(tile == TileMetrics.Tile(text: "12.5", unit: "g", fill: 1, tick: nil))
        #expect(TileMetrics.tile(consumed: 1234.4, target: nil, display: .consumed, unit: "mg").text == "1,234")
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
