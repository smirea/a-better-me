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

/// Every nutrient `MacroSummary` leaves out, in one `NutrientList`: fiber and net carbs unlabeled, then the breakdowns.
/// Without `showAll` only reported nutrients show.
struct NutrientBreakdown: View {
    let amounts: NutrientAmounts
    var showAll = false
    @State private var rows = ViewMemo<Key, [NutrientListRow]>()

    private struct Key: Equatable {
        let amounts: NutrientAmounts
        let showAll: Bool
    }

    var body: some View {
        let rows = rows(Key(amounts: amounts, showAll: showAll)) {
            NutrientListRow.rows(labelsMacros: false) { !NutrientID.macros.contains($0.id) && (showAll || amounts.amount(of: $0.id) != nil) }
        }
        NutrientList(rows: rows) { nutrient in
            LabeledContent(nutrient.name) {
                Text(amounts.amount(of: nutrient.id).map { NutritionFormat.amount($0, nutrient.unit) } ?? "–")
                    .monospacedDigit()
            }
            .font(AppFont.body(15))
        }
    }
}
