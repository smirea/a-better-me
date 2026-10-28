import Foundation
import GRDB

/// Nutrition's writes. Each runs as one `write`, in call order. None reaches from one table into another: entries,
/// favorites, and recipes hold snapshots, so deleting a food or recipe leaves them as they are.
extension LocalStore {
    // MARK: Log

    /// Logs every portion at `minute` of `day`, as one transaction: a plate, a recipe, or a single food.
    func log(_ portions: [FoodPortion], on day: CalendarDay, minute: Int) {
        let entries = portions.map { FoodEntry($0, day: day, minute: minute) }
        write { db in
            for entry in entries {
                try entry.insert(db)
            }
        }
    }

    /// Logs each portion at its own day and minute, as one transaction: a ramble's rows.
    func log(_ portions: [(FoodPortion, day: CalendarDay, minute: Int)]) {
        let entries = portions.map { FoodEntry($0.0, day: $0.day, minute: $0.minute) }
        write { db in
            for entry in entries {
                try entry.insert(db)
            }
        }
    }

    func quickAdd(_ amounts: NutrientAmounts, name: String? = nil, on day: CalendarDay, minute: Int) {
        log([FoodPortion(.quickAdd(amounts, name: name))], on: day, minute: minute)
    }

    func editEntry(_ id: UUID, _ change: @escaping @Sendable (inout FoodEntry) -> Void) {
        modify(FoodEntry.self, id: id) {
            change(&$0)
            $0.updatedAt = .now
        }
    }

    /// Patches only `day` and `minute`, so a move on one device and a serving edit on another both land.
    func moveEntries(_ ids: [UUID], to day: CalendarDay, minute: Int) {
        write { db in
            for id in ids {
                guard let entry = try FoodEntry.fetchOne(db, key: FoodEntry.key(id)) else { continue }
                var moved = entry
                moved.day = day
                moved.minute = minute
                moved.updatedAt = .now
                try moved.updateChanges(db, from: entry)
            }
        }
    }

    /// Copies keep the snapshot and serving under new ids, so pasting twice logs twice.
    func copyEntries(_ ids: [UUID], to day: CalendarDay, minute: Int) {
        write { db in
            for id in ids {
                guard let entry = try FoodEntry.fetchOne(db, key: FoodEntry.key(id)) else { continue }
                try FoodEntry(entry.portion, day: day, minute: minute).insert(db)
            }
        }
    }

    func deleteEntries(_ ids: [UUID]) {
        write { db in
            _ = try FoodEntry.deleteAll(db, keys: ids.map(FoodEntry.key))
        }
    }

    // MARK: Days

    /// Changes the day's row, creating it on first use.
    func updateDay(_ day: CalendarDay, _ change: @escaping @Sendable (inout NutritionDay) -> Void) {
        modify(NutritionDay.self, id: day, orInsert: { NutritionDay(id: day) }, change)
    }

    func saveNote(_ note: FoodLogNote) {
        insert(note)
    }

    func editNote(_ id: UUID, _ change: @escaping @Sendable (inout FoodLogNote) -> Void) {
        modify(FoodLogNote.self, id: id, change)
    }

    func deleteNote(_ id: UUID) {
        delete(FoodLogNote.self, id: id)
    }

    // MARK: Foods and recipes

    /// Creates a food, or refreshes a cached one in place, keeping when it was first saved.
    func saveFood(_ food: Food) {
        write { db in
            var saved = food
            guard let existing = try Food.fetchOne(db, key: food.id) else { return try saved.insert(db) }
            saved.createdAt = existing.createdAt
            saved.updatedAt = .now
            try saved.updateChanges(db, from: existing)
        }
    }

    func editFood(_ id: String, _ change: @escaping @Sendable (inout Food) -> Void) {
        modify(Food.self, id: id) {
            change(&$0)
            $0.updatedAt = .now
        }
    }

    func deleteFood(_ id: String) {
        delete(Food.self, id: id)
    }

    func saveRecipe(_ recipe: Recipe) {
        insert(recipe)
    }

    func editRecipe(_ id: UUID, _ change: @escaping @Sendable (inout Recipe) -> Void) {
        modify(Recipe.self, id: id) {
            change(&$0)
            $0.updatedAt = .now
        }
    }

    func deleteRecipe(_ id: UUID) {
        delete(Recipe.self, id: id)
    }

    // MARK: Favorites

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

    // MARK: Body metrics

    /// Sets the day's value of `kind`, replacing any earlier one; nil clears it.
    func setBodyMetric(_ kind: BodyMetricKind, on day: CalendarDay, value: Double?) {
        guard let value else { return delete(BodyMetric.self, id: BodyMetric.id(kind, on: day)) }
        put(BodyMetric(kind, on: day, value: value))
    }

    // MARK: Strategy

    /// Saves the plan from its day on, replacing a plan that starts the same day.
    /// One plan per day, so a goal or program edited on a check-in's day replaces that row. It stays a check-in and
    /// keeps the expenditure and trend weight the check-in froze, or the check-in history would lose that week.
    func savePlan(_ plan: NutritionPlan) {
        write { db in
            var plan = plan
            if let existing = try NutritionPlan.fetchOne(db, key: plan.key), existing.kind == .checkIn, plan.kind == .edit {
                plan.kind = .checkIn
                plan.expenditureKcal = plan.expenditureKcal ?? existing.expenditureKcal
                plan.trendWeightKg = plan.trendWeightKg ?? existing.trendWeightKg
            }
            try Self.put(plan, in: db)
        }
    }

    func deletePlan(startingOn day: CalendarDay) {
        delete(NutritionPlan.self, id: day)
    }

    /// Sets a nutrient's goal from `day` on, replacing one set the same day.
    func setNutrientGoal(_ nutrient: NutrientID, from day: CalendarDay, _ mode: NutrientGoal.Mode) {
        put(NutrientGoal(nutrient, from: day, mode: mode))
    }

    func deleteNutrientGoal(_ nutrient: NutrientID, from day: CalendarDay) {
        delete(NutrientGoal.self, id: NutrientGoal.id(nutrient, from: day))
    }
}
