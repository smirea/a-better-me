import Foundation
import Testing
@testable import App

@MainActor
struct WidgetSnapshotTests {
    let store: LocalStore
    let monday = calendarDay("2026-10-26")

    init() throws {
        store = try LocalStore(unsyncedAt: FileManager.default.temporaryDirectory.appending(path: "widgets-\(UUID().uuidString)/a.sqlite"))
    }

    func snapshot() async throws -> NutritionSnapshot {
        try await store.write { _ in }.value
        return try store.read { try WidgetPublisher.snapshot($0, today: monday) }
    }

    @Test func coversAWeekWithTheLogAndThePlanTargets() async throws {
        let goal = NutritionGoal(kind: .lose, targetWeightKg: 75, ratePercentPerWeek: -0.5, startedOn: monday)
        store.savePlan(NutritionPlan(
            from: monday, kind: .setup, goal: goal, coaching: CoachingProgram(),
            targets: WeekTargets(every: DayTarget(energy: 2200, protein: 160, fat: 70, carbs: 230))
        ))
        store.log([FoodPortion(yogurt, serving: Serving(measure: yogurt.nutrition.measures[0], quantity: 1))], on: monday, minute: 8 * 60)

        let snapshot = try await snapshot()
        #expect(snapshot.days.map(\.day) == ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"])
        let today = snapshot.days[0]
        #expect(["k", "p", "f", "c", "291"].map { today.consumed[$0] } == [180, 15, 6, 18, 3])
        #expect(today.ranges["k"] == NutritionSnapshot.Range(target: 2200))
        #expect(snapshot.days[1].consumed["k"] == nil)
        #expect(snapshot.days[1].ranges["p"] == NutritionSnapshot.Range(target: 160))
        #expect(snapshot.progress("k", on: today)?.remainingLabel == "2,020 kcal left")
        #expect(snapshot.pinned == ["k", "p", "f", "c"])
    }

    @Test func leavesOutHiddenNutrientsButKeepsTheMacros() async throws {
        store.updateSettings { $0.nutrition.hiddenNutrients = [.fiber, .protein] }

        let ids = Set(try await snapshot().nutrients.map(\.id))
        #expect(!ids.contains("291"))
        #expect(ids.isSuperset(of: ["k", "p", "f", "c"]))
    }
}

struct NutrientProgressTests {
    private let fiber = NutritionSnapshot.Nutrient(id: "291", name: "Fiber", unit: "g", tint: .carbs)

    private func progress(_ consumed: Double, _ range: NutritionSnapshot.Range, overages: Bool = true) -> NutrientProgress {
        NutrientProgress(nutrient: fiber, consumed: consumed, range: range, showOverages: overages)
    }

    @Test func aFloorIsMetNotOvershot() {
        #expect(progress(20, .init(floor: 25)).remainingLabel == "5 g left")
        #expect(progress(30, .init(floor: 25)).remainingLabel == "Minimum met")
        #expect(!progress(30, .init(floor: 25)).isOver)
        #expect(progress(25, .init(floor: 25, ceiling: 50)).fraction == 1)
    }

    @Test func aTargetOrCeilingCanBeOvershot() {
        #expect(progress(200, .init(target: 180)).remainingLabel == "20 g over")
        #expect(progress(2.5, .init(ceiling: 2)).remainingLabel == "0.5 g over")
        #expect(progress(60, .init(floor: 25, ceiling: 50)).remainingLabel == "10 g over")
        #expect(progress(60, .init(floor: 25, ceiling: 50), overages: false).remainingLabel == "0 g left")
    }
}
