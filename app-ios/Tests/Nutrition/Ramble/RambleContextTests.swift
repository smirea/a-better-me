import Foundation
import Testing
@testable import App

struct RambleContextTests {
    let today = calendarDay("2026-10-28")

    func food(_ name: String, id: String? = nil, source: FoodSource = .custom) -> FoodSnapshot {
        FoodSnapshot(foodID: id ?? name, source: source, name: name, nutrition: FoodNutrition(nutrients: [.energy: 100], baseGrams: 100, measures: [Measure(name: "cup", quantity: 1, servings: 1)]))
    }

    func entry(_ food: FoodSnapshot, _ daysAgo: Int, _ minute: Int, quantity: Double = 1) -> FoodEntry {
        FoodEntry(FoodPortion(food, serving: Serving(measure: food.nutrition.measures[0], quantity: quantity)), day: today.adding(days: -daysAgo), minute: minute)
    }

    @Test func mealBucketsFollowTheClock() {
        let minutes = [3 * 60 + 59, 4 * 60, 10 * 60 + 59, 11 * 60, 14 * 60 + 59, 15 * 60, 16 * 60 + 59, 17 * 60, 22 * 60 + 59, 23 * 60]
        #expect(minutes.map { RambleContext.meal(at: $0).rawValue } == [
            "snack", "breakfast", "breakfast", "lunch", "lunch", "snack", "snack", "dinner", "dinner", "snack",
        ])
    }

    @Test func theLastWeekIsGroupedIntoMealsWithShortServings() {
        let oats = food("Oats"), kefir = food("Kefir"), steak = food("Steak")
        let entries = [
            entry(oats, 0, 8 * 60, quantity: 0.5),
            entry(kefir, 0, 8 * 60 + 5),
            entry(steak, 1, 19 * 60, quantity: 1.25),
            entry(oats, 6, 9 * 60),
            entry(oats, 7, 9 * 60),
            entry(oats, -1, 9 * 60),
        ]
        let context = RambleContext(entries: entries, today: today)
        #expect(context.meals.map { "\($0.id) \($0.meal): \($0.entries.map { "\($0.name) (\($0.serving))" }.joined(separator: ", "))" } == [
            "2026-10-22-breakfast breakfast: Oats (1 cup)",
            "2026-10-27-dinner dinner: Steak (1.25 cup)",
            "2026-10-28-breakfast breakfast: Oats (0.5 cup), Kefir (1 cup)",
        ])
        #expect(context.meals[2].entries.map(\.id) == [entries[0].key, entries[1].key])
        #expect(context.mealEntries["2026-10-28-breakfast"] == [entries[0], entries[1]])
    }

    @Test func usualFoodsAreTheOnesLoggedOnTheMostDaysAtTheirLatestEntry() {
        let coffee = food("Cold Brew"), eggs = food("Eggs"), toast = food("Toast"), old = food("Old Cereal")
        var entries: [FoodEntry] = []
        for day in 0..<10 { entries.append(entry(coffee, day, 7 * 60 + day)) }
        // Three times in one day still counts as one day.
        for _ in 0..<3 { entries.append(entry(toast, 2, 8 * 60)) }
        for day in [1, 3] { entries.append(entry(eggs, day, 8 * 60, quantity: Double(day))) }
        entries.append(entry(old, 60, 8 * 60))
        entries.append(entry(FoodSnapshot.quickAdd([.energy: 300]), 0, 12 * 60))
        for index in 0..<20 { entries.append(entry(food("Once \(index)"), 5, 12 * 60 + index)) }

        let usual = RambleContext(entries: entries, today: today).usual
        #expect(usual.count == RambleContext.usualLimit)
        #expect(usual.prefix(3).map { "\($0.name) (\($0.serving))" } == ["Cold Brew (1 cup)", "Eggs (1 cup)", "Toast (1 cup)"])
        #expect(usual[0].id == entries[0].key)
        #expect(!usual.contains { $0.name == "Old Cereal" || $0.name == "Quick Add" })
    }
}
