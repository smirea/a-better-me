import CryptoKit
import Foundation
import GRDB

/// What makes two meals the same meal: the distinct foods in it (`FoodSearchResult.key`), in any order and at any
/// servings. Quick adds are left out, since every one shares the name "Quick Add" and none is a food the owner could
/// eat again. Fewer than `minimumFoods` foods are no meal.
struct MealComponents: Hashable, Sendable {
    static let minimumFoods = 3

    let keys: [String]
    /// A digest of the sorted keys, the same on every device and launch, which the `meal_names` rows are keyed by.
    let hash: String

    init?(keys: some Sequence<String>) {
        let keys = Set(keys).sorted()
        guard keys.count >= Self.minimumFoods else { return nil }
        self.keys = keys
        hash = SHA256.hash(data: Data(keys.joined(separator: "\n").utf8)).prefix(16).map { String(format: "%02x", $0) }.joined()
    }

    init?(_ foods: some Sequence<FoodSnapshot>) {
        self.init(keys: foods.filter { $0.source != .quickAdd }.map(FoodSearchResult.key))
    }
}

/// A row of the synced `meal_names` table: the name the on-device model suggested for a meal, keyed by its
/// `MealComponents.hash`. Stored once, so the meal shows the same name on every later day and device whether or not
/// the owner ever creates it; nothing but the Food Log's meal line reads it, so a suggestion never shows in search.
struct MealName: SyncedRecord {
    static let table = "meal_names"

    var id: String
    var name: String
    var createdAt = Date.now

    init(id: String, name: String) {
        self.id = id
        self.name = name
    }

    init(row: Row) throws {
        id = row["id"]
        name = row["name"]
        createdAt = try row.instant("created_at")
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = id
        container["name"] = name
        container["created_at"] = Instant.text(createdAt)
    }
}
