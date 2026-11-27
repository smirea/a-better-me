import Feedback
import SwiftUI

/// A recipe's numbers at the top of its page, Prepare, the editor, and Alter: a food page's `MacroHeader` in the
/// summary's columns, with what amount they are for under it.
struct MacroSummary: View {
    let amounts: NutrientAmounts
    var caption: String?
    @Environment(\.summaryNutrients) private var columns

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            MacroHeader(amounts: amounts, columns: columns)
            if let caption {
                Text(caption).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
            }
        }
        .padding(.vertical, 4)
        .feedback(self)
    }
}

/// A recipe's Nutrition Facts table (`NutrientList`): its significant nutrients, then every other one, an unreported
/// one as "–", behind the table's closing switch. The recipe page, Prepare, and the recipe editor show it.
struct NutrientBreakdown<Actions: View>: View {
    let amounts: NutrientAmounts
    @ViewBuilder var actions: Actions

    var body: some View {
        NutrientList(title: "Nutrients", amounts: amounts, listsUnreported: true) { nutrient in
            let amount = amounts.amount(of: nutrient.id)
            LabeledContent(nutrient.name) {
                Text(amount.map { NutritionFormat.amount($0, nutrient.unit) } ?? "–")
                    .foregroundStyle(amount == nil ? Theme.textTertiary : Theme.textSecondary)
                    .monospacedDigit()
            }
            .font(AppFont.body(15))
        } actions: {
            actions
        }
    }
}

extension NutrientBreakdown where Actions == EmptyView {
    init(amounts: NutrientAmounts) {
        self.init(amounts: amounts) { EmptyView() }
    }
}

/// What a recipe's nutrient table counts: one serving or the whole recipe. The recipe page and Prepare share the
/// owner's last choice.
enum RecipeNutrientsScope: String {
    case serving, recipe

    static let storageKey = "recipe.nutrientsScope"
}

/// The Nutrients header's Serving | Recipe switch.
struct RecipeNutrientsScopePicker: View {
    @Binding var scope: RecipeNutrientsScope

    var body: some View {
        Picker("Nutrients Per", selection: $scope) {
            Text("Serving").tag(RecipeNutrientsScope.serving)
            Text("Recipe").tag(RecipeNutrientsScope.recipe)
        }
        .pickerStyle(.segmented)
        .fixedSize()
    }
}
