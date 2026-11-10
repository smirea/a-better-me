#if DEBUG
import Foundation
import GRDB

/// The dev seed's (`DevSeed`) real foods: today and the five days before it with entries across the hours, among them
/// `LibrarySeed`'s recipes and custom foods at full and partial servings, and a fasted day three days ago.
/// Earlier days get quick adds from `insertHistory`.
enum FoodLogSeed {
    private static func food(_ name: String, _ icon: String, brand: String? = nil, _ nutrients: NutrientAmounts, grams: Double?, measure: Measure) -> FoodSnapshot {
        FoodSnapshot(source: .usda, name: name, brand: brand, icon: icon, nutrition: FoodNutrition(nutrients: nutrients, baseGrams: grams, measures: [measure]))
    }

    static let oats = food("Oatmeal", "cereal", [.energy: 150, .protein: 5, .fat: 3, .carbs: 27, .fiber: 4, "307": 115, "303": 1.7], grams: 40, measure: Measure(name: "cup", quantity: 1, servings: 2))
    static let banana = food("Banana, Fresh", "banana", [.energy: 105, .protein: 1.3, .fat: 0.4, .carbs: 27, .fiber: 3.1, "306": 422, "401": 10.3], grams: 118, measure: Measure(name: "medium", quantity: 1, servings: 1))
    static let yogurt = food("Greek Yogurt", "milk", brand: "Fage", [.energy: 100, .protein: 18, .fat: 0, .carbs: 6, "301": 200], grams: 170, measure: Measure(name: "container", quantity: 1, servings: 1))
    static let chicken = food("Chicken Breast, Grilled", "chicken", [.energy: 165, .protein: 31, .fat: 3.6, .carbs: 0, "307": 74, "309": 1], grams: 100, measure: Measure(name: "breast", quantity: 1, servings: 1.7))
    static let rice = food("White Rice, Cooked", "rice", [.energy: 130, .protein: 2.7, .fat: 0.3, .carbs: 28, "303": 1.2], grams: 100, measure: Measure(name: "cup", quantity: 1, servings: 1.58))
    static let salmon = food("Salmon, Baked", "fish", [.energy: 206, .protein: 22, .fat: 12, .carbs: 0, "901": 2.3, "328": 11], grams: 100, measure: Measure(name: "fillet", quantity: 1, servings: 1.5))
    static let salad = food("Mixed Salad", "salad", [.energy: 20, .protein: 1.5, .fat: 0.2, .carbs: 3.6, .fiber: 2, "320": 370], grams: 85, measure: Measure(name: "bowl", quantity: 1, servings: 1))
    static let almonds = food("Almonds", "peanuts", [.energy: 164, .protein: 6, .fat: 14, .carbs: 6, .fiber: 3.5, "304": 76], grams: 28, measure: Measure(name: "oz", quantity: 1, servings: 1))

    private static let overnightOats = LibrarySeed.overnightOats.snapshot
    private static let chickenRiceBowl = LibrarySeed.chickenRiceBowl.snapshot
    private static let salmonSalad = LibrarySeed.salmonSalad.snapshot
    private static let proteinPancakes = LibrarySeed.proteinPancakes.snapshot

    /// A day of meals: (minute, food, quantity of its measure).
    static let days: [[(Int, FoodSnapshot, Double)]] = [
        [(7 * 60 + 40, overnightOats, 1), (7 * 60 + 40, LibrarySeed.coldBrew.snapshot, 1), (12 * 60 + 15, chickenRiceBowl, 1), (15 * 60 + 30, yogurt, 1), (15 * 60 + 30, LibrarySeed.granola.snapshot, 0.5)],
        [(8 * 60 + 5, yogurt, 1), (8 * 60 + 5, banana, 1), (13 * 60, salad, 1), (13 * 60, chicken, 1), (16 * 60 + 10, almonds, 1.5), (16 * 60 + 10, LibrarySeed.whey.snapshot, 1), (19 * 60 + 47, salmonSalad, 1), (19 * 60 + 48, rice, 1)],
        [(9 * 60, proteinPancakes, 0.5), (9 * 60, LibrarySeed.coldBrew.snapshot, 1), (12 * 60 + 30, chicken, 1.5), (12 * 60 + 30, rice, 1), (18 * 60 + 45, salmon, 1), (18 * 60 + 45, salad, 2)],
        [],
        [(7 * 60 + 30, overnightOats, 0.5), (7 * 60 + 30, LibrarySeed.sourdough.snapshot, 2), (11 * 60 + 50, chicken, 1), (11 * 60 + 50, salad, 1), (20 * 60 + 15, almonds, 1)],
        [(8 * 60 + 20, oats, 1), (13 * 60 + 5, chickenRiceBowl, 1.5), (17 * 60, banana, 2), (19 * 60 + 30, salmonSalad, 0.75)],
    ]

    static func insert(in db: Database) throws {
        let today = CalendarDay.today
        let nowMinute = Date.now.minuteOfDay()
        for (offset, meals) in days.enumerated() {
            let day = today.adding(days: -offset)
            for (index, (minute, food, quantity)) in meals.enumerated() where offset > 0 || minute <= nowMinute {
                var entry = FoodEntry(FoodPortion(food, serving: Serving(measure: food.nutrition.measures[0], quantity: quantity)), day: day, minute: minute, at: Calendar.current.date(bySettingHour: minute / 60, minute: minute % 60, second: 0, of: day.date)!)
                entry.id = DevSeed.id("food/\(offset)/\(index)")
                // Logged as they would be: into the section the minute falls in, except the early lunch at 11:50, which
                // the owner put in Lunch, so a stored section over its AM Snack minute shows in the seed.
                entry.section = minute == 11 * 60 + 50 ? "lunch" : MealSection.defaults.section(at: minute).id
                try entry.insert(db)
            }
        }
        var fasted = NutritionDay(id: today.adding(days: -3))
        fasted.status = .fasted
        try LocalStore.put(fasted, in: db)
        var edited = NutritionDay(id: today.adding(days: -1))
        edited.status = .partial
        edited.override = [.energy: 2350, .protein: 160]
        try LocalStore.put(edited, in: db)
    }
}

extension FoodLogSeed {
    /// 45 days of weigh-ins, quick adds before the Food Log's own six days, a losing plan, imported steps, and one
    /// fasted, one incomplete, and one entered day, so the nutrition cards and details have data.
    static func insertHistory(in db: Database) throws {
        let today = CalendarDay.today
        let calendar = Calendar.current
        for offset in 0..<45 {
            let day = today.adding(days: -offset)
            let date = day.date(in: calendar)
            if offset % 5 != 2 {
                let kg = 84 - Double(45 - offset) * 0.045 + sin(Double(offset) * 1.3) * 0.5
                var weighIn = BodyWeight(weightKg: (kg * 10).rounded() / 10, measuredAt: min(date.addingTimeInterval(7.5 * 3600), .now.addingTimeInterval(-60)))
                weighIn.id = DevSeed.id("weigh-in/\(offset)")
                try weighIn.insert(db)
            }
            if offset >= 20 {
                try BodyMetric(.steps, on: day, value: Double(6000 + (offset * 1931) % 7000)).insert(db)
            }
            guard offset >= FoodLogSeed.days.count else { continue }
            switch offset {
            case 12:
                var row = NutritionDay(id: day)
                row.status = .fasted
                try row.insert(db)
                continue
            case 18:
                var row = NutritionDay(id: day)
                row.override = [.energy: 2350, .protein: 150, .fat: 80, .carbs: 240]
                try row.insert(db)
                continue
            case 7:
                var row = NutritionDay(id: day)
                row.status = .partial
                try row.insert(db)
            default:
                if offset % 9 == 4 { continue }
            }
            let kcal = 2050 + Double((offset * 137) % 400) - 200
            for (meal, (minute, share)) in [(480, 0.25), (780, 0.35), (1140, 0.4)].enumerated() {
                let amounts: NutrientAmounts = [.energy: kcal * share, .protein: kcal * share * 0.3 / 4, .fat: kcal * share * 0.3 / 9, .carbs: kcal * share * 0.4 / 4]
                var entry = FoodEntry(FoodPortion(.quickAdd(amounts)), day: day, minute: minute)
                entry.id = DevSeed.id("quick-add/\(offset)/\(meal)")
                try entry.insert(db)
            }
        }
        let start = today.adding(days: -40)
        try NutritionPlan(
            from: start, kind: .setup,
            goal: NutritionGoal(kind: .lose, targetWeightKg: 78, ratePercentPerWeek: -0.5, startedOn: start),
            coaching: CoachingProgram(), targets: WeekTargets(every: DayTarget(energy: 2100, protein: 160, fat: 65, carbs: 210))
        ).insert(db)
        var settings = try AppSettings.current.fetch(db)
        if settings.profile.heightCm == nil { settings.profile.heightCm = 180 }
        if settings.profile.birthDate == nil { settings.profile.birthDate = CalendarDay("1990-06-01") }
        try LocalStore.put(settings, in: db)
    }
}
#endif
