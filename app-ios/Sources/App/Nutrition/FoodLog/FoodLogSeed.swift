#if DEBUG
import Foundation
import GRDB

/// The dev seed's (`DevSeed`) real foods: today and the five days before it with entries across the hours, a note
/// today, and a fasted day three days ago. Earlier days get quick adds from `DashboardSeed`.
enum FoodLogSeed {
    private static func food(_ name: String, _ icon: String, brand: String? = nil, _ nutrients: NutrientAmounts, grams: Double?, measure: Measure) -> FoodSnapshot {
        FoodSnapshot(source: .usda, name: name, brand: brand, icon: icon, nutrition: FoodNutrition(nutrients: nutrients, baseGrams: grams, measures: [measure]))
    }

    private static let oats = food("Oatmeal", "🥣", [.energy: 150, .protein: 5, .fat: 3, .carbs: 27, .fiber: 4, "307": 115, "303": 1.7], grams: 40, measure: Measure(name: "cup", quantity: 1, servings: 2))
    private static let banana = food("Banana, Fresh", "🍌", [.energy: 105, .protein: 1.3, .fat: 0.4, .carbs: 27, .fiber: 3.1, "306": 422, "401": 10.3], grams: 118, measure: Measure(name: "medium", quantity: 1, servings: 1))
    private static let yogurt = food("Greek Yogurt", "🥛", brand: "Fage", [.energy: 100, .protein: 18, .fat: 0, .carbs: 6, "301": 200], grams: 170, measure: Measure(name: "container", quantity: 1, servings: 1))
    private static let chicken = food("Chicken Breast, Grilled", "🍗", [.energy: 165, .protein: 31, .fat: 3.6, .carbs: 0, "307": 74, "309": 1], grams: 100, measure: Measure(name: "breast", quantity: 1, servings: 1.7))
    private static let rice = food("White Rice, Cooked", "🍚", [.energy: 130, .protein: 2.7, .fat: 0.3, .carbs: 28, "303": 1.2], grams: 100, measure: Measure(name: "cup", quantity: 1, servings: 1.58))
    private static let salmon = food("Salmon, Baked", "🐟", [.energy: 206, .protein: 22, .fat: 12, .carbs: 0, "901": 2.3, "328": 11], grams: 100, measure: Measure(name: "fillet", quantity: 1, servings: 1.5))
    private static let salad = food("Mixed Salad", "🥗", [.energy: 20, .protein: 1.5, .fat: 0.2, .carbs: 3.6, .fiber: 2, "320": 370], grams: 85, measure: Measure(name: "bowl", quantity: 1, servings: 1))
    private static let almonds = food("Almonds", "🥜", [.energy: 164, .protein: 6, .fat: 14, .carbs: 6, .fiber: 3.5, "304": 76], grams: 28, measure: Measure(name: "oz", quantity: 1, servings: 1))

    /// A day of meals: (minute, food, quantity of its measure).
    static let days: [[(Int, FoodSnapshot, Double)]] = [
        [(7 * 60 + 40, oats, 1), (7 * 60 + 40, banana, 1), (12 * 60 + 15, chicken, 1), (12 * 60 + 15, rice, 1.25), (15 * 60 + 30, yogurt, 1)],
        [(8 * 60 + 5, yogurt, 1), (8 * 60 + 5, banana, 1), (13 * 60, salad, 1), (13 * 60, chicken, 1), (16 * 60 + 10, almonds, 1.5), (19 * 60 + 47, salmon, 1), (19 * 60 + 48, rice, 1)],
        [(9 * 60, oats, 1.5), (12 * 60 + 30, chicken, 1.5), (12 * 60 + 30, rice, 1), (18 * 60 + 45, salmon, 1), (18 * 60 + 45, salad, 2)],
        [],
        [(7 * 60 + 30, yogurt, 2), (11 * 60 + 50, chicken, 1), (11 * 60 + 50, salad, 1), (20 * 60 + 15, almonds, 1)],
        [(8 * 60 + 20, oats, 1), (13 * 60 + 5, rice, 1.5), (13 * 60 + 5, salmon, 1), (17 * 60, banana, 2)],
    ]

    static func insert(in db: Database) throws {
        let today = CalendarDay.today
        let now = Calendar.current.dateComponents([.hour, .minute], from: .now)
        let nowMinute = now.hour! * 60 + now.minute!
        for (offset, meals) in days.enumerated() {
            let day = today.adding(days: -offset)
            for (index, (minute, food, quantity)) in meals.enumerated() where offset > 0 || minute <= nowMinute {
                var entry = FoodEntry(FoodPortion(food, serving: Serving(measure: food.nutrition.measures[0], quantity: quantity)), day: day, minute: minute)
                entry.id = DevSeed.id("food/\(offset)/\(index)")
                try entry.insert(db)
            }
        }
        var fasted = NutritionDay(id: today.adding(days: -3))
        fasted.status = .fasted
        try LocalStore.put(fasted, in: db)
        var note = FoodLogNote(day: today, minute: 9 * 60 + 10, title: "Felt hungry before lunch")
        note.id = DevSeed.id("note")
        note.body = "Try a bigger breakfast tomorrow."
        note.color = .green
        try note.insert(db)
    }
}
#endif
