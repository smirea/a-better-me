import Foundation

/// A nutrient registry id: `k`, `p`, `f`, `c`, `nc`, or a USDA nutrient number such as `291`, MacroFactor's own keys,
/// so USDA FoodData Central imports without a mapping. The sugar alcohols and allulose, which MacroFactor and SR Legacy
/// lack, have two-letter ids of the app's own. `nutrients.json` lists them (docs/decisions/nutrition.md).
struct NutrientID: RawRepresentable, Hashable, Codable, CodingKeyRepresentable, Sendable, ExpressibleByStringLiteral {
    let rawValue: String

    init(rawValue: String) { self.rawValue = rawValue }
    init(stringLiteral value: String) { rawValue = value }

    static let energy: NutrientID = "k"
    static let protein: NutrientID = "p"
    static let fat: NutrientID = "f"
    static let carbs: NutrientID = "c"
    /// Carbs minus fiber, sugar alcohols, and allulose. Reported by a few labels; `amount(of:)` derives it for every
    /// other food.
    static let netCarbs: NutrientID = "nc"
    static let fiber: NutrientID = "291"
    static let sugarAlcohols: NutrientID = "sa"
    /// The sugar alcohols a label may break out, which `sugarAlcohols` totals.
    static let polyols: [NutrientID] = ["er", "xy", "ma", "so"]
    static let allulose: NutrientID = "au"
    static let alcohol: NutrientID = "221"

    /// Calories, then protein, fat, and carbs: the order every summary, header, and macro line uses.
    static let macros: [NutrientID] = [.energy, .protein, .fat, .carbs]
    /// What a column of the Food Log's summary can show (`NutritionSettings.summaryNutrients`).
    static let summaryChoices: [NutrientID] = [.energy, .protein, .fat, .carbs, .fiber, .netCarbs]

    /// Calories per gram, by Atwater's general factors; nil for a nutrient that supplies none.
    var kcalPerGram: Double? {
        switch self {
        case .protein, .carbs: 4
        case .fat: 9
        case .alcohol: 7
        default: nil
        }
    }

    /// A summary column's letters. Fat is "Fa" so it never reads as fiber's "Fb"; calories draw the flame instead.
    var columnLetters: String {
        NutritionSnapshot.columnLetters(rawValue) ?? NutrientRegistry.nutrient(self)?.short ?? rawValue
    }
}

/// Sparse nutrient amounts in the registry's units (energy always kcal). A missing id means not reported, which a total
/// reads as zero. Encodes as a flat JSON object keyed by id.
typealias NutrientAmounts = [NutrientID: Double]

extension Dictionary where Key == NutrientID, Value == Double {
    func scaled(by factor: Double) -> NutrientAmounts { mapValues { $0 * factor } }

    func kcal(from id: NutrientID) -> Double { (self[id] ?? 0) * (id.kcalPerGram ?? 0) }

    /// A macro's share of the calories protein, fat, and carbs supply, so the shares sum to 100% as MacroFactor's chips
    /// do, even when a label's energy disagrees with its macros. Net carbs count as carbs, so a summary showing them
    /// gets their part of the carbs' share. Nil when none of the three is reported.
    func macroShare(_ id: NutrientID) -> Double? {
        let total = [NutrientID.protein, .fat, .carbs].map(kcal(from:)).reduce(0, +)
        guard total > 0 else { return nil }
        return id == .netCarbs ? (amount(of: .netCarbs) ?? 0) * (NutrientID.carbs.kcalPerGram ?? 0) / total : kcal(from: id) / total
    }

    /// Once either side reports net carbs, the sum carries them explicitly, so the side that does not report them
    /// still adds its derived amount.
    static func + (lhs: NutrientAmounts, rhs: NutrientAmounts) -> NutrientAmounts {
        var sum = lhs.merging(rhs, uniquingKeysWith: +)
        if lhs[.netCarbs] != nil || rhs[.netCarbs] != nil {
            sum[.netCarbs] = (lhs.amount(of: .netCarbs) ?? 0) + (rhs.amount(of: .netCarbs) ?? 0)
        }
        // A side that lists only single sugar alcohols still deducts them once its total is summed with another's.
        if lhs.sugarAlcoholTotal != nil || rhs.sugarAlcoholTotal != nil {
            sum[.sugarAlcohols] = (lhs.sugarAlcoholTotal ?? 0) + (rhs.sugarAlcoholTotal ?? 0)
        }
        return sum
    }

    /// The sugar alcohols' total, else the single ones listed summed; nil when the food reports none.
    var sugarAlcoholTotal: Double? {
        if let total = self[.sugarAlcohols] { return total }
        let listed = NutrientID.polyols.compactMap { self[$0] }
        return listed.isEmpty ? nil : listed.reduce(0, +)
    }

    /// The amount of `id`, with net carbs derived when the food does not report it: carbs less what the body barely
    /// takes up, fiber, sugar alcohols (their total, else the ones listed), and allulose, as MacroFactor and keto
    /// labels count them.
    func amount(of id: NutrientID) -> Double? {
        if id == .netCarbs, self[.netCarbs] == nil, let carbs = self[.carbs] {
            return Swift.max(0, carbs - (self[.fiber] ?? 0) - (sugarAlcoholTotal ?? 0) - (self[.allulose] ?? 0))
        }
        return self[id]
    }
}

enum NutrientUnit: String, Decodable, Sendable {
    case kcal, g, mg, mcg, mL

    /// What the app prints after an amount. Energy stays in kilocalories but reads "cal", the k implied.
    var label: String { self == .kcal ? "cal" : rawValue }
}

enum NutrientGroup: String, Decodable, CaseIterable, Sendable {
    case general, protein, carbohydrates, fats, vitamins, minerals
}

/// A floor, target, and ceiling. A nil bound is not shown.
struct NutrientRange: Hashable, Codable, Sendable {
    var floor: Double?
    var target: Double?
    var ceiling: Double?

    /// What a bar fills against: the target, else the floor, else the ceiling, as the widgets measure.
    var goal: Double? { target ?? floor ?? ceiling }
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
        guard let url = Bundle.core.url(forResource: "nutrients", withExtension: "json") else {
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

extension NutrientID {
    var title: String { NutrientRegistry.nutrient(self)?.name ?? rawValue }
}

extension NutrientID {
    /// The banner's and the plate's short names.
    var macroLetter: String {
        switch self {
        case .energy: "cal"
        case .protein: "P"
        case .fat: "F"
        case .carbs: "C"
        default: NutrientRegistry.nutrient(self)?.short ?? rawValue
        }
    }
}

extension NutrientGroup {
    var title: String {
        switch self {
        case .general: "General"
        case .protein: "Protein Breakdown"
        case .carbohydrates: "Carb Breakdown"
        case .fats: "Fat Breakdown"
        case .vitamins: "Vitamins"
        case .minerals: "Minerals"
        }
    }
}

extension Nutrient {
    var tint: NutrientTint {
        switch (id, group) {
        case (.energy, _): .calories
        case (.fiber, _): .fiber
        case (.netCarbs, _): .netCarbs
        case (_, .protein): .protein
        case (_, .fats): .fat
        case (_, .carbohydrates): .carbs
        case (_, .vitamins): .vitamins
        case (_, .minerals): .minerals
        case (_, .general): .calories
        }
    }
}
