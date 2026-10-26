import Foundation

/// The settings screens' arithmetic and labels, apart from the views.
enum SettingsRules {
    static let kilojoulesPerKcal = 4.184
    static let centimetersPerInch = 2.54

    /// Stored energy is kcal; the energy unit only changes what a field shows.
    static func displayEnergy(_ kcal: Double, in unit: NutritionSettings.EnergyUnit) -> Double {
        unit == .kj ? kcal * kilojoulesPerKcal : kcal
    }

    static func storedEnergy(_ value: Double, in unit: NutritionSettings.EnergyUnit) -> Double {
        unit == .kj ? value / kilojoulesPerKcal : value
    }

    static func energyLabel(_ unit: NutritionSettings.EnergyUnit) -> String { unit == .kj ? "kJ" : "kcal" }

    /// `5' 11"` or `180 cm`, to the nearest whole inch or centimeter.
    static func height(_ centimeters: Double, in unit: NutritionSettings.HeightUnit) -> String {
        switch unit {
        case .centimeters:
            return "\(Int(centimeters.rounded())) cm"
        case .feetAndInches:
            let inches = Int((centimeters / centimetersPerInch).rounded())
            return "\(inches / 12)' \(inches % 12)\""
        }
    }

    /// The heights the profile offers, in centimeters: every whole inch from 4' to 7' 6", or every centimeter from 120
    /// to 230, so a pick shows back exactly as it was chosen.
    static func heightChoices(in unit: NutritionSettings.HeightUnit) -> [Double] {
        switch unit {
        case .centimeters: (120...230).map(Double.init)
        case .feetAndInches: (48...90).map { Double($0) * centimetersPerInch }
        }
    }

    /// `8 AM`, `12 PM`, `9 PM`.
    static func hour(_ hour: Int) -> String {
        let twelve = hour % 12 == 0 ? 12 : hour % 12
        return "\(twelve) \(hour < 12 ? "AM" : "PM")"
    }

    static let weightMeasures = ["g", "oz", "lb"]
    static let volumeMeasures = ["mL", "cup", "tbsp", "tsp", "fl oz"]
    /// MacroFactor pins at most two weights and two volumes to the front of the serving picker.
    static let favoritesPerCategory = 2

    /// Toggles `measure` in `favorites`. Adding a third of a category drops that category's oldest pick, so the order
    /// stays the order they were picked.
    static func toggleFavorite(_ measure: String, in favorites: [String]) -> [String] {
        if favorites.contains(measure) { return favorites.filter { $0 != measure } }
        let category = weightMeasures.contains(measure) ? weightMeasures : volumeMeasures
        var next = favorites + [measure]
        let picked = next.filter(category.contains)
        if picked.count > favoritesPerCategory, let oldest = picked.first {
            next.removeAll { $0 == oldest }
        }
        return next
    }
}
