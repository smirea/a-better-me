import Foundation
import Testing
@testable import App

struct HourPicksTests {
    let today = calendarDay("2026-10-27")

    func food(_ name: String) -> FoodSnapshot {
        FoodSnapshot(foodID: "custom-\(name)", source: .custom, name: name, nutrition: FoodNutrition(nutrients: [.energy: 100], measures: [Measure(name: "serving", quantity: 1, servings: 1)]))
    }

    func entry(_ name: String, daysAgo: Int, _ hour: Int, _ minute: Int, quantity: Double = 1) -> HourPicks.Entry {
        let snapshot = food(name)
        return HourPicks.Entry(
            portion: FoodPortion(snapshot, serving: Serving(measure: snapshot.nutrition.measures[0], quantity: quantity)),
            day: today.adding(days: -daysAgo), minute: hour * 60 + minute
        )
    }

    @Test func theHoursMostFrequentFoodsAtTheirLatestServingThere() {
        let picks = HourPicks.picks([
            entry("Oats", daysAgo: 5, 7, 40, quantity: 1),
            entry("Oats", daysAgo: 1, 7, 45, quantity: 1.5),
            entry("Oats", daysAgo: 2, 7, 10, quantity: 2),
            entry("Oats", daysAgo: 1, 19, 0, quantity: 3),
            entry("Banana", daysAgo: 0, 7, 10),
            entry("Banana", daysAgo: 1, 7, 50),
            entry("Toast", daysAgo: 4, 7, 0),
            entry("Toast", daysAgo: 4, 7, 20),
            entry("Yogurt", daysAgo: 3, 7, 30),
            entry("Coffee", daysAgo: 30, 7, 5),
            entry("Coffee", daysAgo: 31, 7, 5),
            entry("Eggs", daysAgo: -1, 7, 15),
            entry("Eggs", daysAgo: -2, 7, 15),
            entry("Salmon", daysAgo: 1, 19, 30),
        ], today: today)

        #expect(picks[7]?.map(\.food.name) == ["Oats", "Banana", "Yogurt"])
        #expect(picks[7]?.first?.serving.quantity == 1.5)
        #expect(picks[19]?.map(\.food.name) == ["Salmon", "Oats"])
        #expect(picks[19]?.last?.serving.quantity == 3)
        #expect(picks[8] == nil)
    }

    @Test func aMonthBackCountsAndTheDayBeforeDoesNot() {
        let picks = HourPicks.picks([entry("Coffee", daysAgo: 29, 6, 0), entry("Tea", daysAgo: 30, 6, 0)], today: today)
        #expect(picks[6]?.map(\.food.name) == ["Coffee"])
    }
}
