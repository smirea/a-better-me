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

    /// The same quantity in the corrected `nutrition`'s measure of this name, whose size may have changed with the
    /// correction, else one of its default measure.
    func fitted(to nutrition: FoodNutrition) -> Serving {
        if let same = nutrition.allMeasures.first(where: { $0.name == measure.name }) { return Serving(measure: same, quantity: quantity) }
        let base = nutrition.measures[0]
        return Serving(measure: base, quantity: base.quantity)
    }
}

/// A food's nutrition: sparse amounts per base serving and the measures it can be logged in, the first the default.
struct FoodNutrition: Hashable, Codable, Sendable {
    var nutrients: NutrientAmounts
    /// Grams in one base serving, which unlocks the weight measures.
    var baseGrams: Double?
    /// Milliliters in one base serving, which unlocks the volume measures.
    var baseMilliliters: Double?
    var measures: [Measure]

    func grams(_ serving: Serving) -> Double? { baseGrams.map { $0 * serving.servings } }

    /// `servingMeasures`, then the standard weights and volumes the base serving's size allows that it does not already name.
    var allMeasures: [Measure] {
        var all = servingMeasures
        for unit in SizeUnit.allCases where !all.contains(where: { $0.name == unit.rawValue }) {
            guard let base = unit.isVolume ? baseMilliliters : baseGrams else { continue }
            all.append(Measure(name: unit.rawValue, quantity: 1, servings: unit.size / base))
        }
        return all
    }

    /// `measures`, each spoon, cup, or weight measure followed by its neighbours the food lacks, with the same qualifier:
    /// a teaspoon's tablespoon, a tablespoon's teaspoon, a cup's tablespoon, a gram's kilogram, and an ounce's pound
    /// ("tsp, ground" brings "tbsp, ground", "oz, boneless" brings "lb, boneless").
    var servingMeasures: [Measure] {
        let own = Set(measures.compactMap { NamedUnit($0.name)?.key })
        var all: [Measure] = []
        for measure in measures {
            all.append(measure)
            guard let named = NamedUnit(measure.name) else { continue }
            for neighbour in named.neighbours where !own.contains(neighbour.key) {
                let servings = measure.servings / measure.quantity * neighbour.unit.size / named.unit.size
                all.append(Measure(name: neighbour.name, quantity: 1, servings: servings))
            }
        }
        return all
    }
}

/// A measure named for a spoon, a cup, or a weight, and the rest of its name. A measure whose rest gives a size
/// ("cup (8 fl oz)", "tbsp (1/8 cup)", "oz (28 g)") is not one: the size belongs to that unit alone.
struct NamedUnit {
    enum Unit: String {
        case tsp, tbsp, cup, g, kg, oz, lb

        /// Milliliters for a spoon or cup, grams for a weight.
        var size: Double {
            switch self {
            case .tsp: 4.92892159375
            case .tbsp: 14.78676478125
            case .cup: SizeUnit.cup.size
            case .g: SizeUnit.g.size
            case .kg: SizeUnit.kg.size
            case .oz: SizeUnit.oz.size
            case .lb: SizeUnit.lb.size
            }
        }

        /// A cup gains no teaspoon, and a spoon no cup: those amounts are far from how the food is measured. A weight
        /// gains the other unit of its system, so a steak weighed in grams or ounces can be logged by the kilogram or pound.
        var neighbours: [Unit] {
            switch self {
            case .tsp: [.tbsp]
            case .tbsp: [.tsp]
            case .cup: [.tbsp]
            case .g: [.kg]
            case .kg: [.g]
            case .oz: [.lb]
            case .lb: [.oz]
            }
        }

        fileprivate static let spellings: [(String, Unit)] = [
            ("tsp", .tsp), ("teaspoon", .tsp), ("tbsp", .tbsp), ("tablespoon", .tbsp), ("cup", .cup),
            ("kg", .kg), ("kilogram", .kg), ("gram", .g), ("g", .g), ("oz", .oz), ("ounce", .oz), ("lb", .lb), ("pound", .lb),
        ]
    }

    let unit: Unit
    /// What follows the unit, its separator included: ", ground" or " chopped", or empty.
    let qualifier: String

    init?(_ name: String) {
        let lower = name.lowercased()
        for (word, unit) in Unit.spellings {
            for spelled in [word + "s", word] where lower.hasPrefix(spelled) {
                let rest = name.dropFirst(spelled.count)
                guard rest.isEmpty || rest.first == "," || rest.first == " " else { continue }
                guard !rest.contains(where: { $0.isNumber || $0 == "(" }) else { return nil }
                self.unit = unit
                qualifier = String(rest)
                return
            }
        }
        return nil
    }

    private init(_ unit: Unit, qualifier: String) {
        self.unit = unit
        self.qualifier = qualifier
    }

    var name: String { unit.rawValue + qualifier }
    var neighbours: [NamedUnit] { unit.neighbours.map { NamedUnit($0, qualifier: qualifier) } }
    fileprivate var key: String { "\(unit) \(qualifier)" }
}

/// Everything a log entry, favorite, or recipe ingredient keeps of a food, so editing or deleting the food, or a
/// database update, never rewrites them. `foodID` is provenance only.
struct FoodSnapshot: Hashable, Codable, Sendable {
    var foodID: String?
    var source: FoodSource
    var name: String
    var brand: String?
    var icon: String?
    var nutrition: FoodNutrition

    func amounts(_ serving: Serving) -> NutrientAmounts { nutrition.nutrients.scaled(by: serving.servings) }

    /// "ZZ Test Food By ZZ Brand", as MacroFactor names branded foods.
    var displayName: String {
        guard let brand, !brand.isEmpty else { return name }
        return "\(name) By \(brand)"
    }

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
struct Food: Stamped {
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
    /// The store a store-packed food is from; its barcode is that store's item code (`ScannedBarcode`).
    var store: String?
    /// On the owner's correction of a USDA or Open Food Facts food, the `FoodSearchResult.key` of the food it stands in
    /// for wherever that one would appear (`CurrentFoods`).
    var replaces: String?
    var icon: String?
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
        FoodSnapshot(foodID: id, source: source, name: name, brand: brand, icon: icon, nutrition: nutrition)
    }

    init(row: Row) throws {
        id = row["id"]
        source = (row["source"] as String?).flatMap(FoodSource.init(rawValue:)) ?? .custom
        name = row["name"]
        brand = row["brand"]
        barcode = row["barcode"]
        store = row["store"]
        replaces = row["replaces"]
        icon = row["icon"]
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
        container["store"] = store
        container["replaces"] = replaces
        container["icon"] = icon
        container["nutrition"] = try RowJSON.text(nutrition)
        container["archived"] = isArchived ? 1 : 0
        container["created_at"] = Instant.text(createdAt)
        container["updated_at"] = Instant.text(updatedAt)
    }
}

/// The standard weights and volumes: what a food's size is typed in, the measures its size unlocks, the favorites
/// Settings offers, and the units Ramble hears. Weights set the food's grams, volumes its milliliters.
enum SizeUnit: String, CaseIterable, Identifiable, Sendable {
    case g, kg, oz, lb, mL, flOz = "fl oz", cup

    var id: Self { self }

    var isVolume: Bool { self == .mL || self == .flOz || self == .cup }

    /// Grams or milliliters in one of the unit.
    var size: Double {
        switch self {
        case .g, .mL: 1
        case .kg: 1000
        case .oz: 28.349523125
        case .lb: 453.59237
        case .flOz: 29.5735295625
        case .cup: 236.5882365
        }
    }
}
