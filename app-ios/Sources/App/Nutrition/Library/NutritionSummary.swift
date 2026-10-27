import SwiftUI

/// Calories, Protein, Fat, and Carbs side by side.
struct MacroSummary: View {
    let amounts: NutrientAmounts
    var caption: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                ForEach(NutrientID.macros, id: \.self) { id in
                    let nutrient = NutrientRegistry.nutrient(id)
                    VStack(spacing: 2) {
                        Text(NutritionFormat.amount(amounts[id] ?? 0))
                            .font(AppFont.number(id == .energy ? 26 : 18))
                            .foregroundStyle(Theme.textPrimary)
                        Text(nutrient?.name ?? "")
                            .font(AppFont.rowDetail)
                            .foregroundStyle(Theme.textSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .accessibilityElement(children: .combine)
                }
            }
            if let caption {
                Text(caption).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .center)
            }
        }
        .padding(.vertical, 4)
    }
}

/// Every nutrient section below the macros, as Form sections. Without `showAll` only reported nutrients show.
struct NutrientBreakdown: View {
    let amounts: NutrientAmounts
    var showAll = false

    var body: some View {
        ForEach(NutrientSection.allCases.filter { $0 != .macros }) { section in
            let rows = section.nutrients.compactMap { nutrient -> (Nutrient, Double?)? in
                let amount = amounts.amount(of: nutrient.id)
                return showAll || amount != nil ? (nutrient, amount) : nil
            }
            if !rows.isEmpty {
                ThemedSection(section.rawValue) {
                    ForEach(rows, id: \.0.id) { nutrient, amount in
                        LabeledContent(nutrient.name) {
                            Text(amount.map { NutritionFormat.amount($0, nutrient.unit) } ?? "–")
                                .monospacedDigit()
                        }
                        .font(AppFont.body(15))
                    }
                }
            }
        }
    }
}
