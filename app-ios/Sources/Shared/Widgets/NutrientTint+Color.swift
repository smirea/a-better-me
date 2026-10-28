import SwiftUI

extension NutrientTint {
    var color: Color {
        switch self {
        case .calories: Theme.calories
        case .protein: Theme.protein
        case .fat: Theme.fat
        case .carbs: Theme.carbs
        case .vitamins: Theme.vitamins
        case .minerals: Theme.minerals
        }
    }
}
