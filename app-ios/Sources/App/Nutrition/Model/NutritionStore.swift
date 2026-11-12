import Foundation
import GRDB

/// Nutrition's writes. Each runs as one `write`, in call order. Entries, favorites, and recipes hold snapshots, so
/// deleting or editing a food or recipe leaves them as they are; only a food's icon reaches them.
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
                entry.food = try Self.withFoodIcon(entry.food, in: db)
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

    /// A snapshot taken before its food's icon was inferred, picked, or cleared (a plate item, a recipe draft, a Ramble
    /// row) takes the food's icon as it is saved, since `setInferredIcon` and `setIcon` reach only the snapshots stored
    /// by then. A cached food's icon is the snapshot's, even none after Default; a food no longer stored leaves it as is.
    nonisolated static func withFoodIcon(_ food: FoodSnapshot, in db: Database) throws -> FoodSnapshot {
        guard let id = food.foodID, [.custom, .usda, .openFoodFacts].contains(food.source),
              let row = try Row.fetchOne(db, sql: "SELECT icon FROM foods WHERE id = ?", arguments: [id]) else { return food }
        var filled = food
        filled.icon = row["icon"]
        return filled
    }

    /// Gives a food without an icon the one `FoodIconInference` picked, and every snapshot of it without one too: the
    /// log's entries, favorites, and recipe ingredients. Only the icon changes and `updated_at` stays, so Latest keeps its
    /// order. A food that got an icon meanwhile, the model's or the owner's, keeps it.
    func setInferredIcon(_ icon: String, forFood id: String) {
        write { db in
            guard let food = try Food.fetchOne(db, key: id), food.icon == nil else { return }
            var named = food
            named.icon = icon
            try named.updateChanges(db, from: food)
            try Self.setSnapshotIcons(icon, of: named.snapshot, replacing: false, in: db)
        }
    }

    /// The owner's icon for a food or recipe, nil for Default (the app's choice, which lets the model pick again). It is a
    /// correction, so it replaces the icon on the food and on every snapshot of it, whatever they held. A snapshot
    /// without a food id (the dev seed's log) stands for every snapshot with its name and brand, as search groups them.
    func setIcon(_ icon: String?, of food: FoodSnapshot) {
        guard food.source != .quickAdd else { return }
        write { db in
            switch food.source {
            case .custom, .usda, .openFoodFacts:
                if let id = food.foodID, let row = try Food.fetchOne(db, key: id) {
                    var changed = row
                    changed.icon = icon
                    try changed.updateChanges(db, from: row)
                }
            case .recipe:
                if let id = food.foodID.flatMap(UUID.init(uuidString:)), let row = try Recipe.fetchOne(db, key: Recipe.key(id)) {
                    var changed = row
                    changed.icon = icon
                    try changed.updateChanges(db, from: row)
                }
            case .quickAdd:
                break
            }
            try Self.setSnapshotIcons(icon, of: food, replacing: true, in: db)
        }
    }

    /// Sets the icon on the log's entries, the favorites, and the recipe ingredients that are snapshots of `food`
    /// (`FoodSearchResult.key`): only those without one unless `replacing`. `updated_at` stays, so Latest keeps its order.
    nonisolated private static func setSnapshotIcons(_ icon: String?, of food: FoodSnapshot, replacing: Bool, in db: Database) throws {
        let key = FoodSearchResult.key(food)
        func matching(_ path: String) -> String {
            "\(FoodSearchResult.keySQL(path)) = ?" + (replacing ? " AND json_extract(\(path), '$.icon') IS NOT ?" : " AND json_extract(\(path), '$.icon') IS NULL")
        }
        let arguments: StatementArguments = replacing ? [key, icon] : [key]
        for entry in try FoodEntry.fetchAll(db, sql: "SELECT * FROM food_entries WHERE \(matching("food"))", arguments: arguments) {
            var changed = entry
            changed.food.icon = icon
            try changed.updateChanges(db, from: entry)
        }
        for favorite in try FoodFavorite.fetchAll(db, sql: "SELECT * FROM food_favorites WHERE \(matching("food"))", arguments: arguments) {
            var changed = favorite
            changed.food.icon = icon
            try changed.updateChanges(db, from: favorite)
        }
        let ingredients = "SELECT * FROM recipes WHERE EXISTS (SELECT 1 FROM json_each(recipes.ingredients) WHERE \(matching("json_extract(value, '$.food')")))"
        for recipe in try Recipe.fetchAll(db, sql: ingredients, arguments: arguments) {
            var changed = recipe
            for index in changed.ingredients.indices where FoodSearchResult.key(changed.ingredients[index].food) == key {
                if replacing || changed.ingredients[index].food.icon == nil { changed.ingredients[index].food.icon = icon }
            }
            try changed.updateChanges(db, from: recipe)
        }
    }

    func deleteFood(_ id: String) {
        delete(Food.self, id: id)
    }

    func saveRecipe(_ recipe: Recipe) {
        write { try Self.insert(recipe, in: $0) }
    }

    nonisolated static func insert(_ recipe: Recipe, in db: Database) throws {
        var saved = recipe
        for index in saved.ingredients.indices {
            saved.ingredients[index].food = try withFoodIcon(saved.ingredients[index].food, in: db)
        }
        try saved.insert(db)
    }

    func deleteRecipe(_ id: UUID) {
        delete(Recipe.self, id: id)
    }

    /// Saves a favorite. At the limit it replaces the oldest, as MacroFactor replaces one when full. A screen that can
    /// take the favorite back passes its `id`.
    func addFavorite(_ portion: FoodPortion, id: UUID = UUID()) {
        let made = FoodFavorite(portion)
        write { db in
            var favorite = made
            favorite.id = id
            favorite.food = try Self.withFoodIcon(favorite.food, in: db)
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
