import Foundation

/// Quick Add's form: energy in the chosen unit, the macros and alcohol in grams, and an optional name.
struct QuickAddDraft: Hashable, Sendable {
    var energy = ""
    var unit = NutritionSettings.EnergyUnit.kcal
    var protein = ""
    var fat = ""
    var carbs = ""
    var alcohol = ""
    var name = ""

    static let kilojoulesPerKcal = 4.184

    /// "Macro sum is 250 kcal": 4 kcal per gram of protein and carbs, 9 of fat, 7 of alcohol, in the chosen unit.
    var macroSum: Double {
        let kcal = 4 * Self.grams(protein) + 9 * Self.grams(fat) + 4 * Self.grams(carbs) + 7 * Self.grams(alcohol)
        return unit == .kj ? kcal * Self.kilojoulesPerKcal : kcal
    }

    /// The entry's amounts, energy in kcal. Without a typed energy the macro sum is the energy. Nil when nothing is
    /// filled in, or a field is not a number.
    var amounts: NutrientAmounts? {
        let fields = [energy, protein, fat, carbs, alcohol]
        guard fields.allSatisfy({ Self.number($0) != nil }), fields.contains(where: { Self.grams($0) > 0 }) else { return nil }
        var amounts: NutrientAmounts = [:]
        let typed = Self.grams(energy)
        let energyInUnit = typed > 0 ? typed : macroSum
        amounts[.energy] = unit == .kj ? energyInUnit / Self.kilojoulesPerKcal : energyInUnit
        for (id, text) in [(NutrientID.protein, protein), (.fat, fat), (.carbs, carbs), (.alcohol, alcohol)] where !text.isEmpty {
            amounts[id] = Self.grams(text)
        }
        return amounts
    }

    var portion: FoodPortion? {
        guard let amounts else { return nil }
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        return FoodPortion(.quickAdd(amounts, name: trimmed.isEmpty ? nil : trimmed))
    }

    /// An empty field is zero; anything else must parse.
    private static func number(_ text: String) -> Double? {
        let trimmed = text.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: ".")
        return trimmed.isEmpty ? 0 : Double(trimmed).flatMap { $0 >= 0 ? $0 : nil }
    }

    private static func grams(_ text: String) -> Double { number(text) ?? 0 }
}

/// When the logger searches as the owner types. Local results (history, the owner's foods, USDA) come on every
/// keystroke, since they are an in-memory scan; Open Food Facts waits for a pause in typing, so a word typed quickly
/// costs one request instead of one per letter.
enum SearchPolicy {
    static let remoteDelay = Duration.milliseconds(400)
    /// Open Food Facts' search needs a couple of letters to say anything useful; `FoodSearch.search` skips shorter.
    static let remoteMinimumLength = 2

    /// How long to wait before asking Open Food Facts, nil when this query never does.
    static func remoteDelay(for query: String, branded: Bool) -> Duration? {
        guard branded, query.trimmingCharacters(in: .whitespacesAndNewlines).count >= remoteMinimumLength else { return nil }
        return remoteDelay
    }
}
