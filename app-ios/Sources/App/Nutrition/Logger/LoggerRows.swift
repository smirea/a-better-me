import SwiftUI

extension NutrientID {
    /// The banner's and the plate's short names.
    var macroLetter: String {
        switch self {
        case .energy: "kcal"
        case .protein: "P"
        case .fat: "F"
        case .carbs: "C"
        default: NutrientRegistry.nutrient(self)?.short ?? rawValue
        }
    }
}

/// The round + that puts a food on the plate without leaving the list, MacroFactor's Multi-Add.
struct AddToPlateButton: View {
    let food: FoodSnapshot
    let add: () -> Void
    @State private var added = 0

    var body: some View {
        RoundIconButton("Add \(food.name) to plate", systemImage: "plus", size: .small) {
            added += 1
            add()
        }
        .sensoryFeedback(.success, trigger: added)
    }
}

/// The logger's one action everywhere: log what is on the plate.
struct LogFoodsButton: View {
    let session: LoggerSession
    /// Runs before logging, so a tab can put its own food on the plate first (Quick Add's form).
    var prepare: () -> Void = {}
    /// The tab holds a food `prepare` adds, so an empty plate can still log.
    var hasPending = false

    var body: some View {
        Button("Log Foods") {
            prepare()
            session.logPlate()
        }
        .font(AppFont.headline(15))
        .buttonStyle(.glassProminent)
        .tint(Theme.textPrimary)
        .foregroundStyle(Theme.onPrimary)
        .disabled(session.plate.isEmpty && !hasPending)
    }
}
