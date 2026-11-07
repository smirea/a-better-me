import Feedback
import SwiftUI

/// The day's summary nutrients in four columns, each a line of text over a thin bar: the Food Log's summary and the
/// logger's banner. Inside the logger the plate's part of each bar is lit and what was eaten dims behind it. Holding a
/// column picks what it shows, for every place that draws these columns.
struct MacroTotalsBars: View {
    let lines: [MacroLine]
    let page: MacroLine.Page
    @Environment(LocalStore.self) private var store

    var body: some View {
        HStack(spacing: 10) {
            ForEach(Array(lines.enumerated()), id: \.element.id) { index, line in
                VStack(alignment: .leading, spacing: 5) {
                    Text("\(prefix(line.nutrient)) \(Text(line.text(page)).font(AppFont.rowDetail))")
                        .font(AppFont.headline(12))
                        .monospacedDigit()
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                        .contentTransition(.numericText())
                    if let fill = line.fill(page) {
                        TotalsBar(fill: fill, color: line.nutrient.color, dimsEaten: line.plate != nil)
                            .scaleEffect(x: page == .remaining && line.target != nil ? -1 : 1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(.contextMenuPreview, .rect(cornerRadius: 8))
                .contextMenu { columnPicker(index, showing: line.nutrient) }
                .feedback(line.nutrient.title, data: line)
            }
        }
        .animation(.snappy, value: lines)
        .contentShape(Rectangle())
    }

    private func prefix(_ id: NutrientID) -> Text {
        id == .energy ? Text(calorieGlyph) : Text(id.columnLetters)
    }

    private func columnPicker(_ index: Int, showing nutrient: NutrientID) -> some View {
        let choice = Binding(
            get: { nutrient },
            set: { picked in
                store.updateSettings { $0.nutrition.summaryNutrients = FoodLog.choosing(picked, at: index, in: $0.nutrition.summaryNutrients) }
            }
        )
        return Picker("Show in This Column", selection: choice) {
            ForEach(NutrientID.summaryChoices, id: \.self) { Text($0.title).tag($0) }
        }
        .pickerStyle(.inline)
    }
}

private struct TotalsBar: View {
    let fill: MacroLine.Fill
    let color: Color
    let dimsEaten: Bool

    var body: some View {
        GeometryReader { proxy in
            HStack(spacing: 0) {
                Rectangle().fill(color.opacity(dimsEaten ? 0.45 : 1)).frame(width: proxy.size.width * fill.eaten)
                Rectangle().fill(color).frame(width: proxy.size.width * fill.plate)
            }
        }
        .background(Theme.surfaceRaised)
        .clipShape(Capsule())
        .frame(height: 3)
        .accessibilityHidden(true)
    }
}
