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

extension Dictionary where Key == NutrientID, Value == Double {
    /// "105 kcal  1P 0F 27C", the compact line under a food's name.
    var macroLine: String {
        let kcal = Int((self[.energy] ?? 0).rounded())
        let macros = [NutrientID.protein, .fat, .carbs].map { "\(Int((self[$0] ?? 0).rounded()))\($0.macroLetter)" }
        return "\(kcal) kcal  " + macros.joined(separator: " ")
    }
}

/// A food's icon: the one picked in the library when it has one, otherwise a symbol for where it came from.
struct LoggerFoodIcon: View {
    let food: FoodSnapshot

    var body: some View {
        Group {
            if FoodIcon.named(food.icon) != nil {
                FoodIconView(name: food.icon, size: 26)
            } else {
                Image(systemName: symbol)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.textSecondary)
            }
        }
        .frame(width: 34, height: 34)
        .background(Theme.surfaceRaised, in: .circle)
    }

    private var symbol: String {
        switch food.source {
        case .recipe: "frying.pan"
        case .quickAdd: "bolt.fill"
        case .openFoodFacts: "barcode"
        case .custom: "fork.knife"
        case .usda: "leaf"
        }
    }
}

/// A result row: icon, name and brand, "105 kcal 1P 0F 27C • 1 medium", and a round + that puts the food on the plate
/// without leaving the list (MacroFactor's Multi-Add). Tapping the row opens the food detail.
struct LoggerFoodRow: View {
    let portion: FoodPortion
    let open: () -> Void
    let add: () -> Void
    @State private var added = 0

    var body: some View {
        HStack(spacing: 12) {
            Button(action: open) {
                HStack(spacing: 12) {
                    LoggerFoodIcon(food: portion.food)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(title).font(AppFont.medium(15)).lineLimit(2)
                        Text("\(portion.amounts.macroLine) • \(portion.serving.label)")
                            .font(AppFont.caption(12))
                            .foregroundStyle(Theme.textSecondary)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 0)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            Button("Add \(portion.food.name) to plate", systemImage: "plus") {
                added += 1
                add()
            }
            .labelStyle(.iconOnly)
            .font(.system(size: 14, weight: .semibold))
            .frame(width: 32, height: 32)
            .background(Theme.surfaceRaised, in: .circle)
            .buttonStyle(.plain)
            .sensoryFeedback(.success, trigger: added)
        }
    }

    private var title: String {
        guard let brand = portion.food.brand, !brand.isEmpty else { return portion.food.name }
        return "\(portion.food.name) By \(brand)"
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
        .foregroundStyle(Color.black)
        .disabled(session.plate.isEmpty && !hasPending)
    }
}
