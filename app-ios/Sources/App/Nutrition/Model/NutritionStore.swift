import Foundation
import GRDB

/// Nutrition's writes. Each runs as one `write`, in call order. None reaches from one table into another: entries,
/// favorites, and recipes hold snapshots, so deleting a food or recipe leaves them as they are.
extension LocalStore {

    /// Logs every portion at `minute` of `day`, as one transaction: a plate, a recipe, or a single food.
    func log(_ portions: [FoodPortion], on day: CalendarDay, minute: Int, section: String? = nil) {
        log(portions.map { ($0, day: day, minute: minute) }, section: section)
    }

    /// Logs each portion at its own day and minute, as one transaction: a ramble's rows. Each entry keeps the meal
    /// section it lands in: `section` when the owner picked one, else the one its minute falls in as the sections stand
    /// now, so moving a boundary later never moves it.
    func log(_ portions: [(FoodPortion, day: CalendarDay, minute: Int)], section: String? = nil) {
        let entries = portions.map { FoodEntry($0.0, day: $0.day, minute: $0.minute, section: section) }
        write { db in
            let sections = try MealSection.current(db)
            for var entry in entries {
                entry.section = entry.section ?? sections.section(at: entry.minute).id
                try entry.insert(db)
            }
        }
    }

    func deleteEntries(_ ids: [UUID]) {
        write { db in
            _ = try FoodEntry.deleteAll(db, keys: ids.map(FoodEntry.key))
        }
    }

    func updateDay(_ day: CalendarDay, _ change: @escaping @Sendable (inout NutritionDay) -> Void) {
        modify(NutritionDay.self, id: day, orInsert: { NutritionDay(id: day) }, change)
    }

    /// Creates a food, or refreshes a cached one in place, keeping when it was first saved and the icon inferred for it,
    /// since the database it came from has none.
    func saveFood(_ food: Food) {
        write { db in
            var saved = food
            guard let existing = try Food.fetchOne(db, key: food.id) else { return try saved.insert(db) }
            saved.createdAt = existing.createdAt
            if saved.source != .custom { saved.icon = saved.icon ?? existing.icon }
            try saved.update(db, from: existing)
        }
    }

    /// Gives a food without an icon the one `FoodIconInference` picked, and every snapshot of it without one too: the
    /// log's entries, favorites, and recipe ingredients. Only the icon changes and `updated_at` stays, so Latest keeps its
    /// order. A food that got an icon meanwhile keeps it.
    func setInferredIcon(_ icon: String, forFood id: String) {
        write { db in
            guard let food = try Food.fetchOne(db, key: id), food.icon == nil else { return }
            var named = food
            named.icon = icon
            try named.updateChanges(db, from: food)

            let missing = "json_extract(food, '$.foodID') = ? AND json_extract(food, '$.icon') IS NULL"
            for entry in try FoodEntry.fetchAll(db, sql: "SELECT * FROM food_entries WHERE \(missing)", arguments: [id]) {
                var changed = entry
                changed.food.icon = icon
                try changed.updateChanges(db, from: entry)
            }
            for favorite in try FoodFavorite.fetchAll(db, sql: "SELECT * FROM food_favorites WHERE \(missing)", arguments: [id]) {
                var changed = favorite
                changed.food.icon = icon
                try changed.updateChanges(db, from: favorite)
            }
            let ingredients = """
                SELECT * FROM recipes WHERE EXISTS (SELECT 1 FROM json_each(recipes.ingredients)
                WHERE json_extract(value, '$.food.foodID') = ? AND json_extract(value, '$.food.icon') IS NULL)
                """
            for recipe in try Recipe.fetchAll(db, sql: ingredients, arguments: [id]) {
                var changed = recipe
                for index in changed.ingredients.indices where changed.ingredients[index].food.foodID == id {
                    changed.ingredients[index].food.icon = changed.ingredients[index].food.icon ?? icon
                }
                try changed.updateChanges(db, from: recipe)
            }
        }
    }

    func deleteFood(_ id: String) {
        delete(Food.self, id: id)
    }

    func saveRecipe(_ recipe: Recipe) {
        insert(recipe)
    }

    func deleteRecipe(_ id: UUID) {
        delete(Recipe.self, id: id)
    }

    /// Saves a favorite. At the limit it replaces the oldest, as MacroFactor replaces one when full.
    func addFavorite(_ portion: FoodPortion) {
        let favorite = FoodFavorite(portion)
        write { db in
            let existing = try FoodFavorite.fetchAll(db).sorted { $0.createdAt < $1.createdAt }
            for old in existing.prefix(max(0, existing.count - FoodFavorite.limit + 1)) {
                try old.delete(db)
            }
            try favorite.insert(db)
        }
    }

    func deleteFavorite(_ id: UUID) {
        delete(FoodFavorite.self, id: id)
    }

    /// Sets the day's value of `kind`, replacing any earlier one; nil clears it.
    func setBodyMetric(_ kind: BodyMetricKind, on day: CalendarDay, value: Double?) {
        guard let value else { return delete(BodyMetric.self, id: BodyMetric.id(kind, on: day)) }
        put(BodyMetric(kind, on: day, value: value))
    }

    /// Saves the plan from its day on, replacing a plan that starts the same day.
    /// One plan per day, so a goal or program edited on a setup's or check-in's day replaces that row. It keeps its
    /// kind, and the expenditure and trend weight it froze when the edit froze none, or the history would lose that week.
    func savePlan(_ plan: NutritionPlan) {
        write { db in
            var plan = plan
            if let existing = try NutritionPlan.fetchOne(db, key: plan.key), existing.kind != .edit, plan.kind == .edit {
                plan.kind = existing.kind
                plan.expenditureKcal = plan.expenditureKcal ?? existing.expenditureKcal
                plan.trendWeightKg = plan.trendWeightKg ?? existing.trendWeightKg
            }
            try Self.put(plan, in: db)
        }
    }

    /// Sets a nutrient's goal from `day` on, replacing one set the same day.
    func setNutrientGoal(_ nutrient: NutrientID, from day: CalendarDay, _ mode: NutrientGoal.Mode) {
        put(NutrientGoal(nutrient, from: day, mode: mode))
    }

    func deleteNutrientGoal(_ nutrient: NutrientID, from day: CalendarDay) {
        delete(NutrientGoal.self, id: NutrientGoal.id(nutrient, from: day))
    }
}

extension LocalStore {
    /// Changes the meal sections. When a change moves time between sections (a boundary, a removal, a reorder), every
    /// entry without a section of its own (logged before sections existed, or into a section since removed) first gets
    /// the one its minute falls in as the sections stand, in the same transaction, so the change moves no entry already
    /// logged. A rename moves nothing, so it stamps nothing. The stamp keeps `updated_at`, which orders Latest.
    func updateMealSections(_ change: @escaping @Sendable ([MealSection]) -> [MealSection]) {
        write { db in
            let current = try AppSettings.fetchOne(db, key: AppSettings.key(AppSettings.rowID))
            let sections = current?.nutrition.mealSections ?? MealSection.defaults
            let changed = change(sections)
            guard changed != sections else { return }
            if changed.map(\.id) != sections.map(\.id) || changed.map(\.start) != sections.map(\.start) {
                try Self.stampSections(sections, in: db)
            }
            guard let current else {
                var fresh = AppSettings()
                fresh.nutrition.mealSections = changed
                return try fresh.insert(db)
            }
            var updated = current
            updated.nutrition.mealSections = changed
            try updated.updateChanges(db, from: current)
        }
    }

    nonisolated static func stampSections(_ sections: [MealSection], in db: Database) throws {
        let ids = sections.map(\.id)
        let cases = sections.reversed().map { _ in "WHEN minute >= ? THEN ?" }.joined(separator: " ")
        var arguments: [any DatabaseValueConvertible] = sections.reversed().flatMap { [$0.start, $0.id] as [any DatabaseValueConvertible] }
        arguments += ids
        try db.execute(
            sql: """
                UPDATE food_entries SET section = CASE \(cases) END
                WHERE section IS NULL OR section NOT IN (\(databaseQuestionMarks(count: ids.count)))
                """,
            arguments: StatementArguments(arguments)
        )
    }
}
