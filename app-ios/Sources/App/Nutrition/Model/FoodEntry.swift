import Foundation
import GRDB

/// A row of the synced `food_entries` table: one logged food at a time of a day, and the meal section it was logged
/// into. The Time display groups entries by hour, the Sections display by section.
struct FoodEntry: Stamped {
    static let table = "food_entries"

    var id: UUID
    var day: CalendarDay
    /// Minutes since midnight, 0 through 1439.
    var minute: Int
    var food: FoodSnapshot
    var serving: Serving
    /// The `MealSection` id it was logged into, kept when the sections or their times change later. Nil for entries
    /// logged before sections existed, which show in the section their minute falls in.
    var section: String?
    var createdAt: Date
    var updatedAt: Date

    init(_ portion: FoodPortion, day: CalendarDay, minute: Int, section: String? = nil, at date: Date = .now) {
        id = UUID()
        self.day = day
        self.minute = minute
        self.section = section
        food = portion.food
        serving = portion.serving
        createdAt = date
        updatedAt = date
    }

    var hour: Int { minute / 60 }
    var portion: FoodPortion { FoodPortion(food, serving: serving) }
    var amounts: NutrientAmounts { food.amounts(serving) }

    init(row: Row) throws {
        id = try row.uuid("id")
        day = try row.day("day")
        minute = row["minute"] ?? 720
        food = try row.json("food")
        serving = try row.json("serving")
        section = row["section"]
        createdAt = try row.instant("created_at")
        updatedAt = try row.instant("updated_at")
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = key
        container["day"] = day.description
        container["minute"] = minute
        container["food"] = try RowJSON.text(food)
        container["serving"] = try RowJSON.text(serving)
        container["section"] = section
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

extension [FoodEntry] {
    /// The entries' sum, with net carbs as `NutrientAmounts +` carries them.
    var totals: NutrientAmounts { reduce(into: NutrientAmounts()) { $0 = $0 + $1.amounts } }
}
