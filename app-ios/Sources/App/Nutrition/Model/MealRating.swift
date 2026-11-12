import Foundation

/// Settings > Food Log > Meal Rating: a tag that grades a group of foods (a meal, the day, a recipe, the plate) by one
/// formula.
struct MealRating: Codable, Hashable, Sendable {
    var enabled = false
    var formula = Formula.caloriesPerProtein

    enum Formula: String, Codable, CaseIterable, Sendable {
        case caloriesPerProtein

        var title: String { "Calories per Protein" }
        var abbreviation: String { "C:P" }

        var explanation: String {
            "A meal's calories divided by its grams of protein. The lower it is, the more of its calories come from "
                + "protein, which keeps you full longer and protects muscle."
        }

        /// The highest value each tier but `poor` takes, best first.
        var bounds: [Int] { [6, 8, 10, 13] }
        /// Past this, the tag also gets a skull.
        var direAbove: Int { 20 }

        /// Nil when the meal has no calories to rate. No protein reads as infinite: the worst a meal can do. It divides
        /// the whole numbers the row's totals show, so "403 kcal, 28 P" reads 14:1 rather than the 15:1 of 403.4 ÷ 27.4.
        func score(_ amounts: NutrientAmounts) -> Score? {
            let calories = (amounts[.energy] ?? 0).rounded()
            guard calories > 0 else { return nil }
            let protein = (amounts[.protein] ?? 0).rounded()
            let ratio = protein > 0 ? Int((calories / protein).rounded()) : nil
            let tier = ratio.map { ratio in Tier.allCases.first { ratio <= bound(of: $0) ?? .max }! } ?? .poor
            return Score(ratio: ratio, tier: tier, isDire: ratio.map { $0 > direAbove } ?? true)
        }

        func bound(of tier: Tier) -> Int? {
            tier.rawValue < bounds.count ? bounds[tier.rawValue] : nil
        }

        /// "≤6:1", "7–8:1", ">13:1".
        func range(of tier: Tier) -> String {
            guard let upper = bound(of: tier) else { return ">\(bounds.last!):1" }
            guard tier.rawValue > 0 else { return "≤\(upper):1" }
            return "\(bounds[tier.rawValue - 1] + 1)–\(upper):1"
        }
    }

    /// Best first. The two best tiers draw a moving border, as does a dire score.
    enum Tier: Int, CaseIterable, Sendable {
        case excellent, great, good, fair, poor

        var title: String {
            switch self {
            case .excellent: "Excellent"
            case .great: "Great"
            case .good: "Good"
            case .fair: "Fair"
            case .poor: "Poor"
            }
        }

        func isAnimated(dire: Bool) -> Bool { dire || self == .excellent || self == .great }
    }

    struct Score: Hashable, Sendable {
        /// Calories per gram of protein, rounded; nil when the meal has none.
        let ratio: Int?
        let tier: Tier
        let isDire: Bool

        /// "13:1", or "∞" for a meal without protein.
        var ratioText: String { ratio.map { "\($0):1" } ?? "∞" }
    }
}
