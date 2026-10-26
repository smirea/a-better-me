import Foundation
import GRDB

/// Where a food snapshot came from. Only `custom`, `usda`, and `openFoodFacts` are rows of `foods`.
enum FoodSource: String, Codable, Sendable {
    case custom, usda, openFoodFacts = "open_food_facts", recipe, quickAdd = "quick_add"
}

/// A unit a food is logged in: `quantity` of it is `servings` base servings, so `{ cup, 1, 2.4 }` is 2.4 base servings.
struct Measure: Hashable, Codable, Sendable {
    var name: String
    var quantity: Double
    var servings: Double
}

/// How much was eaten: `quantity` of `measure`. The measure travels with the quantity, so a log never needs the food.
struct Serving: Hashable, Codable, Sendable {
    var measure: Measure
    var quantity: Double

    /// The base servings eaten, the one factor every amount scales by.
    var servings: Double { measure.servings * quantity / measure.quantity }
}

/// A food's nutrition: sparse amounts per base serving and the measures it can be logged in, the first the default.
struct FoodNutrition: Hashable, Codable, Sendable {
    var nutrients: NutrientAmounts
    /// Grams in one base serving, which unlocks the weight measures.
    var baseGrams: Double?
    /// Milliliters in one base serving, which unlocks the volume measures.
    var baseMilliliters: Double?
    var measures: [Measure]

    private static let weights = [("g", 1.0), ("oz", 28.349523125), ("lb", 453.59237)]
    private static let volumes = [("mL", 1.0), ("fl oz", 29.5735295625), ("cup", 236.5882365)]

    /// `measures`, then the standard weights and volumes the base serving's size allows that it does not already name.
    var allMeasures: [Measure] {
        var all = measures
        func add(_ units: [(String, Double)], base: Double?) {
            guard let base else { return }
            for (name, size) in units where !all.contains(where: { $0.name == name }) {
                all.append(Measure(name: name, quantity: 1, servings: size / base))
            }
        }
        add(Self.weights, base: baseGrams)
        add(Self.volumes, base: baseMilliliters)
        return all
    }
}

/// Everything a log entry, favorite, or recipe ingredient keeps of a food, so editing or deleting the food, or a
/// database update, never rewrites them. `foodID` is provenance only.
struct FoodSnapshot: Hashable, Codable, Sendable {
    var foodID: String?
    var source: FoodSource
    var name: String
    var brand: String?
    var nutrition: FoodNutrition

    func amounts(_ serving: Serving) -> NutrientAmounts { nutrition.nutrients.scaled(by: serving.servings) }

    static func quickAdd(_ amounts: NutrientAmounts, name: String? = nil) -> FoodSnapshot {
        FoodSnapshot(
            source: .quickAdd, name: name ?? "Quick Add",
            nutrition: FoodNutrition(nutrients: amounts, measures: [Measure(name: "serving", quantity: 1, servings: 1)])
        )
    }
}

/// A food snapshot at a serving: what a log entry, a favorite, and a recipe ingredient each hold.
struct FoodPortion: Hashable, Sendable {
    var food: FoodSnapshot
    var serving: Serving

    var amounts: NutrientAmounts { food.amounts(serving) }

    /// One of the food's default measure.
    init(_ food: FoodSnapshot, serving: Serving? = nil) {
        self.food = food
        self.serving = serving ?? Serving(measure: food.nutrition.measures[0], quantity: food.nutrition.measures[0].quantity)
    }
}

/// A row of the synced `foods` table: a food the owner made, or a USDA or Open Food Facts food cached on first use.
struct Food: SyncedRecord {
    static let table = "foods"

    enum Remote: Sendable {
        case usda(fdcID: Int)
        case openFoodFacts(barcode: String)
    }

    var id: String
    var source: FoodSource
    var name: String
    var brand: String?
    var barcode: String?
    var nutrition: FoodNutrition
    var isArchived = false
    var createdAt: Date
    var updatedAt: Date

    init(name: String, brand: String? = nil, barcode: String? = nil, nutrition: FoodNutrition) {
        self.init(id: UUID().uuidString.lowercased(), source: .custom, name: name, brand: brand, barcode: barcode, nutrition: nutrition)
    }

    /// A food from a remote database, with an id built from its key, so caching it twice converges on one row.
    init(_ remote: Remote, name: String, brand: String? = nil, nutrition: FoodNutrition) {
        switch remote {
        case let .usda(fdcID):
            self.init(id: "usda-\(fdcID)", source: .usda, name: name, brand: brand, barcode: nil, nutrition: nutrition)
        case let .openFoodFacts(barcode):
            self.init(id: "off-\(barcode)", source: .openFoodFacts, name: name, brand: brand, barcode: barcode, nutrition: nutrition)
        }
    }

    private init(id: String, source: FoodSource, name: String, brand: String?, barcode: String?, nutrition: FoodNutrition) {
        self.id = id
        self.source = source
        self.name = name
        self.brand = brand
        self.barcode = barcode
        self.nutrition = nutrition
        createdAt = .now
        updatedAt = .now
    }

    var snapshot: FoodSnapshot {
        FoodSnapshot(foodID: id, source: source, name: name, brand: brand, nutrition: nutrition)
    }

    init(row: Row) throws {
        id = row["id"]
        source = (row["source"] as String?).flatMap(FoodSource.init(rawValue:)) ?? .custom
        name = row["name"]
        brand = row["brand"]
        barcode = row["barcode"]
        nutrition = try row.json("nutrition")
        isArchived = row.flag("archived")
        createdAt = try row.instant("created_at")
        updatedAt = try row.instant("updated_at")
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = id
        container["source"] = source.rawValue
        container["name"] = name
        container["brand"] = brand
        container["barcode"] = barcode
        container["nutrition"] = try RowJSON.text(nutrition)
        container["archived"] = isArchived ? 1 : 0
        container["created_at"] = Instant.text(createdAt)
        container["updated_at"] = Instant.text(updatedAt)
    }
}
