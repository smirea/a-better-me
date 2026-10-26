import Foundation
import GRDB
import Testing
@testable import App

/// Every Nutrition write in `LocalStore`, over a fresh migrated database that never syncs.
@MainActor
struct NutritionStoreTests {
    let store: LocalStore
    let monday = calendarDay("2026-10-26")
    let tuesday = calendarDay("2026-10-27")

    init() throws {
        store = try LocalStore(unsyncedAt: FileManager.default.temporaryDirectory.appending(path: "nutrition-\(UUID().uuidString)/a.sqlite"))
    }

    /// Waits for every write called so far, since writes run in call order.
    func settled() async throws {
        try await store.write { _ in }.value
    }

    func read<T>(_ query: DatabaseQuery<T>) throws -> T {
        try store.read(query.fetch)
    }

    func outbox() throws -> [String] {
        try store.read { db in
            try Row.fetchAll(db, sql: #"SELECT op, "table" AS tbl, col FROM _outbox ORDER BY seq"#).map {
                "\($0["op"] as String) \($0["tbl"] as String) \($0["col"] as String? ?? "-")"
            }
        }
    }

    @Test func logsQuickAddsMovesCopiesAndDeletesEntries() async throws {
        store.log([FoodPortion(yogurt), FoodPortion(yogurt, serving: Serving(measure: yogurt.nutrition.measures[0], quantity: 2))], on: monday, hour: 8)
        store.quickAdd([.energy: 420, .protein: 30], name: "Lunch out", on: monday, hour: 13)
        try await settled()

        let logged = try read(FoodEntry.on(monday))
        #expect(logged.map(\.hour) == [8, 8, 13])
        #expect(logged.map { $0.amounts[.energy] } == [180, 360, 420])
        #expect(logged[2].food.name == "Lunch out")
        #expect(logged[2].food.source == .quickAdd)

        store.editEntry(logged[1].id) { $0.serving.quantity = 0.5 }
        store.moveEntries([logged[0].id], to: tuesday, hour: 7)
        store.copyEntries([logged[2].id], to: tuesday, hour: 12)
        try await settled()

        #expect(try read(FoodEntry.on(monday)).map { $0.amounts[.energy] } == [90, 420])
        let tuesdays = try read(FoodEntry.on(tuesday))
        #expect(tuesdays.map(\.hour) == [7, 12])
        #expect(tuesdays[0].id == logged[0].id)
        #expect(tuesdays[1].id != logged[2].id)
        #expect(tuesdays[1].food == logged[2].food)
        #expect(try outbox().filter { $0.hasPrefix("update") }.sorted() == [
            "update food_entries day", "update food_entries hour", "update food_entries serving",
            "update food_entries updated_at", "update food_entries updated_at",
        ])

        store.deleteEntries([logged[2].id, tuesdays[1].id])
        try await settled()
        #expect(try read(FoodEntry.between(monday, tuesday)).map { $0.amounts[.energy] } == [90, 180])
    }

    @Test func marksADayAndClearsItsOverride() async throws {
        #expect(try read(NutritionDay.one(monday)) == NutritionDay(id: monday))
        store.updateDay(monday) { $0.status = .fasted }
        store.updateDay(monday) {
            $0.note = "Travel"
            $0.override = [.energy: 1800]
        }
        try await settled()
        var day = try read(NutritionDay.one(monday))
        #expect(day.status == .fasted)
        #expect(day.note == "Travel")
        #expect(day.override == [.energy: 1800])

        store.updateDay(monday) { $0.override = nil }
        try await settled()
        day = try read(NutritionDay.one(monday))
        #expect(day.override == nil)
        #expect(try outbox() == [
            "insert nutrition_days -", "update nutrition_days note", "update nutrition_days override", "update nutrition_days override",
        ])
    }

    @Test func cachesAFoodOnceAndKeepsLoggedSnapshotsWhenItChanges() async throws {
        let cached = Food(.openFoodFacts(barcode: "5000112637922"), name: "Cola", nutrition: FoodNutrition(nutrients: [.energy: 42], baseMilliliters: 100, measures: [Measure(name: "can", quantity: 1, servings: 3.3)]))
        store.saveFood(cached)
        try await settled()
        let firstSaved = try #require(try read(Food.library).first)
        var refreshed = Food(.openFoodFacts(barcode: "5000112637922"), name: "Cola Classic", nutrition: cached.nutrition)
        refreshed.createdAt = .now.addingTimeInterval(60)
        store.saveFood(refreshed)
        store.log([FoodPortion(firstSaved.snapshot)], on: monday, hour: 18)
        try await settled()

        let foods = try read(Food.library)
        #expect(foods.map(\.id) == ["off-5000112637922"])
        #expect(foods[0].name == "Cola Classic")
        #expect(foods[0].barcode == "5000112637922")
        #expect(foods[0].createdAt == firstSaved.createdAt)

        let custom = Food(name: "Oats", nutrition: FoodNutrition(nutrients: [.energy: 380], baseGrams: 100, measures: [Measure(name: "g", quantity: 100, servings: 1)]))
        store.saveFood(custom)
        store.editFood(custom.id) { $0.name = "Rolled oats" }
        store.editFood(cached.id) { $0.nutrition.nutrients[.energy] = 0 }
        store.deleteFood(cached.id)
        try await settled()

        #expect(try read(Food.library).map(\.name) == ["Rolled oats"])
        let entry = try #require(try read(FoodEntry.on(monday)).first)
        #expect(entry.food.name == "Cola")
        #expect(entry.food.foodID == "off-5000112637922")
        #expect(entry.amounts[.energy] == 138.6)
    }

    @Test func savesEditsAndDeletesRecipes() async throws {
        var recipe = Recipe(name: "Overnight oats", servings: 2)
        recipe.ingredients = [RecipeIngredient(FoodPortion(yogurt))]
        recipe.steps = ["Mix", "Chill"]
        store.saveRecipe(recipe)
        store.editRecipe(recipe.id) {
            $0.servings = 3
            $0.prepMinutes = 5
        }
        try await settled()

        let saved = try #require(try read(Recipe.library).first)
        #expect(saved.ingredients == recipe.ingredients)
        #expect(saved.steps == ["Mix", "Chill"])
        #expect(saved.prepMinutes == 5)
        #expect(saved.nutrition.nutrients[.energy] == 60)

        store.log([FoodPortion(saved.snapshot)], on: monday, hour: 7)
        store.deleteRecipe(recipe.id)
        try await settled()
        #expect(try read(Recipe.library).isEmpty)
        #expect(try read(FoodEntry.on(monday)).map { $0.amounts[.energy] } == [60])
    }

    @Test func aFullFavoritesListReplacesItsOldest() async throws {
        let start = Date(timeIntervalSince1970: 1_761_321_600)
        for index in 0..<FoodFavorite.limit {
            store.insert(FoodFavorite(FoodPortion(.quickAdd([.energy: Double(index)])), at: start.addingTimeInterval(Double(index))))
        }
        store.addFavorite(FoodPortion(yogurt))
        try await settled()

        let favorites = try read(FoodFavorite.all)
        #expect(favorites.count == 50)
        #expect(favorites.first?.food.nutrition.nutrients[.energy] == 1)
        #expect(favorites.last?.food == yogurt)

        store.deleteFavorite(favorites[0].id)
        try await settled()
        #expect(try read(FoodFavorite.all).count == 49)
    }

    @Test func setsReplacesAndClearsABodyMetricPerDay() async throws {
        store.setBodyMetric(.waist, on: monday, value: 84)
        store.setBodyMetric(.waist, on: monday, value: 83.5)
        store.setBodyMetric(.bodyFat, on: monday, value: 17.5)
        store.setBodyMetric(.waist, on: tuesday, value: 83)
        try await settled()

        #expect(try read(BodyMetric.series(.waist)).map(\.value) == [83.5, 83])
        #expect(try read(BodyMetric.series(.bodyFat)).map(\.id) == ["2026-10-26/body_fat"])

        store.setBodyMetric(.waist, on: monday, value: nil)
        try await settled()
        #expect(try read(BodyMetric.series(.waist)).map(\.day) == [tuesday])
    }

    @Test func aPlanOnTheSameDayReplacesTheEarlierOne() async throws {
        let goal = NutritionGoal(kind: .lose, targetWeightKg: 75, ratePercentPerWeek: -0.5, startedOn: monday)
        let setup = NutritionPlan(from: monday, kind: .setup, goal: goal, coaching: CoachingProgram(), targets: WeekTargets(every: DayTarget(energy: 2200, protein: 160, fat: 70, carbs: 230)))
        var checkIn = NutritionPlan(from: monday.adding(days: 7), kind: .checkIn, goal: goal, coaching: CoachingProgram(), targets: WeekTargets(every: DayTarget(energy: 2100, protein: 160, fat: 65, carbs: 220)))
        checkIn.expenditureKcal = 2650
        checkIn.trendWeightKg = 81.2
        store.savePlan(setup)
        store.savePlan(checkIn)
        var redo = checkIn
        redo.targets = WeekTargets(every: DayTarget(energy: 2050, protein: 160, fat: 65, carbs: 210))
        store.savePlan(redo)
        try await settled()

        let plans = try read(NutritionPlan.all)
        #expect(plans.map(\.id.description) == ["2026-10-26", "2026-11-02"])
        #expect(plans[1].target(on: monday.adding(days: 9)).energy == 2050)
        #expect(plans[1].expenditureKcal == 2650)
        #expect(plans[1].kind == .checkIn)

        store.deletePlan(startingOn: monday)
        try await settled()
        #expect(try read(NutritionPlan.all).map(\.kind) == [.checkIn])
    }

    @Test func setsAndDeletesNutrientGoals() async throws {
        store.setNutrientGoal(.fiber, from: monday, .custom(NutrientRange(floor: 25, target: 35)))
        store.setNutrientGoal(.fiber, from: monday, .custom(NutrientRange(target: 40)))
        store.setNutrientGoal("307", from: tuesday, .auto)
        try await settled()

        let goals = try read(NutrientGoal.all)
        #expect(goals.map(\.id) == ["2026-10-26/291", "2026-10-27/307"])
        #expect(goals[0].mode == .custom(NutrientRange(target: 40)))
        #expect(goals[1].mode == .auto)

        store.deleteNutrientGoal(.fiber, from: monday)
        try await settled()
        #expect(try read(NutrientGoal.all).map(\.nutrient) == ["307"])
    }

    @Test func nutritionSettingsPatchTheirOwnColumn() async throws {
        store.updateSettings { $0.workout.rest.enabled = false }
        store.updateSettings { $0.nutrition.energyUnit = .kj }
        try await settled()

        let settings = try #require(try store.read { try AppSettings.fetchOne($0, key: AppSettings.rowID) })
        #expect(settings.nutrition.energyUnit == .kj)
        #expect(settings.nutrition.pinnedNutrients == [.energy, .protein, .fat, .carbs])
        #expect(try outbox() == ["insert settings -", "update settings nutrition"])
    }
}
