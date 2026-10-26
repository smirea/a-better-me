import Foundation
import GRDB

/// A row of the synced `food_entries` table: one logged food in an hour of a day, MacroFactor's timeline bucket.
struct FoodEntry: SyncedRecord {
    static let table = "food_entries"

    var id: UUID
    var day: CalendarDay
    /// 0 through 23.
    var hour: Int
    var food: FoodSnapshot
    var serving: Serving
    var createdAt: Date
    var updatedAt: Date

    init(_ portion: FoodPortion, day: CalendarDay, hour: Int, at date: Date = .now) {
        id = UUID()
        self.day = day
        self.hour = hour
        food = portion.food
        serving = portion.serving
        createdAt = date
        updatedAt = date
    }

    var portion: FoodPortion { FoodPortion(food, serving: serving) }
    var amounts: NutrientAmounts { food.amounts(serving) }

    init(row: Row) throws {
        id = try row.uuid("id")
        day = try row.day("day")
        hour = row["hour"] ?? 12
        food = try row.json("food")
        serving = try row.json("serving")
        createdAt = try row.instant("created_at")
        updatedAt = try row.instant("updated_at")
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = key
        container["day"] = day.description
        container["hour"] = hour
        container["food"] = try RowJSON.text(food)
        container["serving"] = try RowJSON.text(serving)
        container["created_at"] = Instant.text(createdAt)
        container["updated_at"] = Instant.text(updatedAt)
    }
}

/// A row of the synced `food_favorites` table: a saved food at a chosen serving. Several may come from one food.
struct FoodFavorite: SyncedRecord {
    static let table = "food_favorites"
    /// MacroFactor's cap. Saving one more replaces the oldest (`LocalStore.addFavorite`).
    static let limit = 50

    var id: UUID
    var food: FoodSnapshot
    var serving: Serving
    var createdAt: Date

    init(_ portion: FoodPortion, at date: Date = .now) {
        id = UUID()
        food = portion.food
        serving = portion.serving
        createdAt = date
    }

    var portion: FoodPortion { FoodPortion(food, serving: serving) }

    init(row: Row) throws {
        id = try row.uuid("id")
        food = try row.json("food")
        serving = try row.json("serving")
        createdAt = try row.instant("created_at")
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = key
        container["food"] = try RowJSON.text(food)
        container["serving"] = try RowJSON.text(serving)
        container["created_at"] = Instant.text(createdAt)
    }
}
