import Feedback
import SwiftUI

/// A food everywhere one is listed (the timeline, search, the library, a recipe's ingredients), one line each like
/// MacroFactor's 47 pt rows: its icon, "Name By Brand" with the words a search matched in bold, and under it "1 large"
/// at `serving` on the left with the summary's columns as a table's cells on the right, so the numbers line up from row
/// to row (2026-11-18). The serving truncates before the columns do.
struct FoodRow: View {
    let food: FoodSnapshot
    let serving: Serving
    var showsDetail = true
    var titleColor = Theme.textPrimary
    /// An altered recipe's changed amount, which draws yellow as the Food Log's tile draws it.
    var servingColor = Theme.textSecondary
    /// The search's terms (`FoodText.terms`), whose matches draw bold.
    var matching: [String] = []
    @Environment(\.summaryNutrients) private var columns

    var body: some View {
        HStack(spacing: 12) {
            FoodIcon(food: food)
            VStack(alignment: .leading, spacing: 2) {
                title.font(AppFont.rowTitle).foregroundStyle(titleColor)
                if showsDetail {
                    HStack(spacing: 8) {
                        Text(NutritionFormat.listed(serving, of: food)).foregroundStyle(servingColor)
                        Spacer(minLength: 0)
                        MacroColumns(amounts: food.amounts(serving), columns: columns).layoutPriority(1)
                    }
                    .font(AppFont.rowDetail)
                    .foregroundStyle(Theme.textSecondary)
                }
            }
            .lineLimit(1)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .contentShape(.rect)
        .accessibilityElement(children: .combine)
        .feedback(self)
    }

    private var title: Text {
        let name = food.displayName
        let ranges = FoodText.matches(in: name, terms: matching)
        guard !ranges.isEmpty else { return Text(name) }
        var title = AttributedString(name)
        for range in ranges {
            guard let lower = AttributedString.Index(range.lowerBound, within: title),
                  let upper = AttributedString.Index(range.upperBound, within: title) else { continue }
            title[lower..<upper].font = AppFont.title(15)
        }
        return Text(title)
    }
}

extension Text {
    /// "105ઠ 1P 0Fa 27C": MacroFactor's compact nutrition in the summary's columns, the calorie glyph in place of "kcal".
    init(macroLine amounts: NutrientAmounts, columns: [NutrientID]) {
        let parts = columns.map { id in
            let value = NutritionFormat.column(id, amounts)
            return Text("\(value)\(id.columnLabel)")
        }
        self = parts.dropFirst().reduce(parts.first ?? Text("")) { Text("\($0) \($1)") }
            .accessibilityLabel(NutritionFormat.spoken(amounts, columns))
    }
}

/// A food's summary columns as a table's cells: each right-aligned in a fixed width, so a list of foods reads as a
/// table whatever the numbers.
struct MacroColumns: View {
    let amounts: NutrientAmounts
    let columns: [NutrientID]
    @ScaledMetric(relativeTo: .caption) private var caloriesWidth: CGFloat = 40
    @ScaledMetric(relativeTo: .caption) private var width: CGFloat = 32

    var body: some View {
        HStack(spacing: 4) {
            ForEach(columns, id: \.self) { id in
                Text("\(NutritionFormat.column(id, amounts))\(id.columnLabel)")
                    .minimumScaleFactor(0.8)
                    .frame(width: id == .energy ? caloriesWidth : width, alignment: .trailing)
            }
        }
        .monospacedDigit()
        .lineLimit(1)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(NutritionFormat.spoken(amounts, columns))
    }
}
