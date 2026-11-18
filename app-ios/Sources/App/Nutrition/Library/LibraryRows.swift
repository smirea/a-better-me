import Feedback
import SwiftUI

/// A food everywhere one is listed (the timeline, search, the library, the plate, a recipe), one line each like
/// MacroFactor's 47 pt rows: its icon, "Name By Brand" with the words a search matched in bold, and "120ઠ 1P 0Fa 31C" at
/// `serving` with "1 large" at the trailing edge, which truncates before the macros do.
struct FoodRow: View {
    let food: FoodSnapshot
    let serving: Serving
    var showsDetail = true
    var titleColor = Theme.textPrimary
    /// The search's terms (`FoodText.terms`), whose matches draw bold.
    var matching: [String] = []
    @Environment(\.summaryNutrients) private var columns

    var body: some View {
        HStack(spacing: 12) {
            FoodIcon(food: food)
            RowLabel(
                title: title,
                detail: showsDetail ? Text(macroLine: food.amounts(serving), columns: columns) : nil,
                trailingDetail: showsDetail ? Text(NutritionFormat.listed(serving, of: food)) : nil,
                titleColor: titleColor
            )
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
            return id == .energy ? Text("\(value)\(calorieGlyph)") : Text("\(value)\(id.columnLetters)")
        }
        self = parts.dropFirst().reduce(parts.first ?? Text("")) { Text("\($0) \($1)") }
            .accessibilityLabel(NutritionFormat.spoken(amounts, columns))
    }
}
