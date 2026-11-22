import Foundation
@testable import Core
import Testing

struct TileMetricsTests {
    private let utc: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }()

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

    @Test func microTargetsComeFromGoalsAndMacroTargetsFromThePlan() {
        let day = CalendarDay("2026-10-05")!
        let custom = NutrientGoal("291", from: CalendarDay("2026-10-01")!, mode: .custom(NutrientRange(floor: 20, target: 40, ceiling: nil)))
        #expect(NutrientTargets(target: nil, goals: [custom], day: day, sex: .male, weightKg: nil).range("291") == NutrientRange(floor: 20, target: 40, ceiling: nil))
        #expect(NutrientTargets(target: nil, goals: [], day: day, sex: .male, weightKg: nil).range(.protein) == NutrientRange())
    }

    @Test func layoutsSavedBeforeRevisionFiveAdoptNutritionVisualBodyFatAndPings() throws {
        let old = #"{"revision":1,"sections":["insights","habits","bodyMetrics","general"],"bodyMetrics":["scaleWeight"]}"#
        let adopted = try RowJSON.decoder.decode(DashboardLayout.self, from: Data(old.utf8))
        #expect(adopted.sections == [.insights, .habits, .pings, .nutrition, .bodyMetrics])
        #expect(adopted.bodyMetrics == [.scaleWeight, .visualBodyFat])
        #expect(adopted.nutrition == NutritionCard.defaults)
        let saved = #"{"revision":2,"sections":["insights"],"bodyMetrics":["scaleWeight"],"nutrition":[]}"#
        let kept = try RowJSON.decoder.decode(DashboardLayout.self, from: Data(saved.utf8))
        #expect(kept.sections == [.insights, .pings])
        #expect(kept.bodyMetrics == [.scaleWeight])
        #expect(kept.nutrition.isEmpty)
    }

    @Test func stepsMoveFromGeneralIntoInsightsOnce() throws {
        func decode(_ json: String) throws -> DashboardLayout { try RowJSON.decoder.decode(DashboardLayout.self, from: Data(json.utf8)) }
        let shown = try decode(#"{"revision":2,"sections":["general","insights"],"insights":["weightTrend","workouts"],"general":["steps"]}"#)
        #expect(shown.sections == [.insights, .pings])
        #expect(shown.insights == [.weightTrend, .steps, .workouts])
        let hidden = try decode(#"{"revision":2,"insights":["workouts"],"general":[]}"#)
        #expect(hidden.insights == [.workouts])
        let removedSince = try decode(#"{"revision":3,"insights":["workouts"]}"#)
        #expect(removedSince.insights == [.workouts])
        #expect(try decode("{}").insights == [.workouts, .weightTrend, .expenditure, .energyBalance, .goalProgress, .steps])
    }

    @Test func layoutsWithLegacyPrimaryFocusDecodeWithoutLosingCustomizations() throws {
        let json = #"{"revision":5,"primaryFocus":["overview","workouts","recentRecords","weeklyNutrition","energyBalance","dailyNutrition"],"sections":["habits","insights","pings"],"insights":["weightTrend","steps"],"habits":["foodLogging"],"nutrition":[],"bodyMetrics":["scaleWeight"]}"#
        let decoded = try RowJSON.decoder.decode(DashboardLayout.self, from: Data(json.utf8))
        #expect(decoded.sections == [.habits, .insights, .pings])
        #expect(decoded.insights == [.weightTrend, .steps])
        #expect(decoded.habits == [.foodLogging])
        #expect(decoded.nutrition.isEmpty)
        #expect(decoded.bodyMetrics == [.scaleWeight])
        #expect(decoded.revision == DashboardLayout.revision)
    }
}
