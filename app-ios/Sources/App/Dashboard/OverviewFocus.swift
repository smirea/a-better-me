import Feedback
import SwiftUI

/// The Dashboard's Today overview: the body heat map Levels draws, both sides at once, beside today's Food Log
/// summary against its targets.
struct OverviewFocus: View {
    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(SessionHistory.self) private var history
    @AppStorage(LevelsPeriod.storageKey) private var period = LevelsPeriod.oneWeek
    private var values = DashboardValues()

    var body: some View {
        let settings = values.nutritionSettings
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader("Today")
            HStack(alignment: .center, spacing: 16) {
                MuscleState(sets: WeeklySets.memoized(in: history, period: period, catalog: catalog).totals, period: period)
                TodayTargets(lines: values.todaySummary(settings.summaryNutrients, overages: settings.showOverages))
            }
        }
        .feedback(self)
    }
}

private struct MuscleState: View {
    let sets: [Muscle: Double]
    let period: LevelsPeriod

    var body: some View {
        NavigationLink(value: DashboardRoute.levels) {
            HStack(spacing: 2) {
                BodyMap(values: sets, side: .front)
                BodyMap(values: sets, side: .back)
            }
            .frame(height: 190)
            .frame(maxWidth: .infinity)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Levels")
        .accessibilityValue(sets.isEmpty ? "No sets" : "Weekly sets over \(period.rawValue)")
        .feedback(self)
    }
}

private struct TodayTargets: View {
    let lines: [MacroLine]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            ForEach(lines) { line in
                VStack(alignment: .leading, spacing: 6) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(line.nutrient.title).font(AppFont.headline(13))
                        Spacer(minLength: 4)
                        Text(line.text(.eaten)).font(AppFont.rowDetail).monospacedDigit()
                    }
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                    TargetBar(fill: line.fill(.eaten) ?? MacroLine.Fill(eaten: 0, plate: 0), color: line.nutrient.color, height: 5)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(line.spoken)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .feedback(self)
    }
}
