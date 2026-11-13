import Feedback
import SwiftUI

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
        .feedback(self)
    }
}

/// Every nutrient as a full Nutrition Facts table (`NutrientList`), an unreported one as "–". The recipe page, Prepare,
/// and the recipe editor show it under `MacroSummary`.
struct NutrientBreakdown: View {
    let amounts: NutrientAmounts

    var body: some View {
        NutrientList(title: "Nutrients", rows: NutrientListRow.all) { nutrient in
            LabeledContent(nutrient.name) {
                Text(amounts.amount(of: nutrient.id).map { NutritionFormat.amount($0, nutrient.unit) } ?? "–")
                    .monospacedDigit()
            }
            .font(AppFont.body(15))
        }
    }
}
