import Foundation

/// A nutrient registry id: `k`, `p`, `f`, `c`, `nc`, or a USDA nutrient number such as `291`, MacroFactor's own keys,
/// so USDA FoodData Central imports without a mapping. `nutrients.json` lists them (docs/decisions/nutrition.md).
struct NutrientID: RawRepresentable, Hashable, Codable, CodingKeyRepresentable, Sendable, ExpressibleByStringLiteral {
    let rawValue: String

    init(rawValue: String) { self.rawValue = rawValue }
    init(stringLiteral value: String) { rawValue = value }

    static let energy: NutrientID = "k"
    static let protein: NutrientID = "p"
    static let fat: NutrientID = "f"
    static let carbs: NutrientID = "c"
    /// Carbs minus fiber. Reported by a few labels; `amount(of:)` derives it for every other food.
    static let netCarbs: NutrientID = "nc"
    static let fiber: NutrientID = "291"
    static let alcohol: NutrientID = "221"
}

/// Sparse nutrient amounts in the registry's units (energy always kcal). A missing id means not reported, which a total
/// reads as zero. Encodes as a flat JSON object keyed by id.
typealias NutrientAmounts = [NutrientID: Double]

extension Dictionary where Key == NutrientID, Value == Double {
    func scaled(by factor: Double) -> NutrientAmounts { mapValues { $0 * factor } }

    static func + (lhs: NutrientAmounts, rhs: NutrientAmounts) -> NutrientAmounts {
        lhs.merging(rhs, uniquingKeysWith: +)
    }

    /// The amount of `id`, with net carbs derived from carbs and fiber when the food does not report it.
    func amount(of id: NutrientID) -> Double? {
        if id == .netCarbs, self[.netCarbs] == nil, let carbs = self[.carbs] {
            return Swift.max(0, carbs - (self[.fiber] ?? 0))
        }
        return self[id]
    }
}

enum NutrientUnit: String, Decodable, Sendable {
    case kcal, g, mg, mcg, mL
}

enum NutrientGroup: String, Decodable, CaseIterable, Sendable {
    case general, protein, carbohydrates, fats, vitamins, minerals
}

/// A floor, target, and ceiling. A nil bound is not shown.
struct NutrientRange: Hashable, Codable, Sendable {
    var floor: Double?
    var target: Double?
    var ceiling: Double?
}

/// One entry of the bundled registry, `Resources/Nutrition/nutrients.json`.
struct Nutrient: Decodable, Hashable, Identifiable, Sendable {
    struct Defaults: Decodable, Hashable, Sendable {
        let male: NutrientRange
        let female: NutrientRange
    }

    let id: NutrientID
    let name: String
    let short: String
    let unit: NutrientUnit
    let group: NutrientGroup
    let symbol: String
    /// Adult DRI target (RDA or AI) and ceiling (UL). Calories and the macros come from the plan instead.
    let defaults: Defaults?
    /// Amino acids: the target scales with body weight, in grams per kilogram.
    let targetPerKg: Double?

    func defaultRange(sex: BodySex, weightKg: Double?) -> NutrientRange {
        var range = (sex == .male ? defaults?.male : defaults?.female) ?? NutrientRange()
        if let targetPerKg, let weightKg { range.target = targetPerKg * weightKg }
        return range
    }
}

/// The registry in display order: grouped, and in MacroFactor's order within a group.
enum NutrientRegistry {
    static let all: [Nutrient] = {
        guard let url = Bundle.main.url(forResource: "nutrients", withExtension: "json") else {
            fatalError("Missing nutrients.json in the app bundle.")
        }
        do {
            return try JSONDecoder().decode([Nutrient].self, from: Data(contentsOf: url))
        } catch {
            fatalError("nutrients.json does not match Nutrient: \(error)")
        }
    }()

    private static let byID = Dictionary(uniqueKeysWithValues: all.map { ($0.id, $0) })

    static func nutrient(_ id: NutrientID) -> Nutrient? { byID[id] }
}
