import Feedback
import SwiftUI

/// The pager's first page: the body heat map Levels draws, both sides at once since a page has no room for its rotate
/// button, beside today's Food Log summary against its targets.
struct OverviewFocus: View {
    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(SessionHistory.self) private var history
    @AppStorage(LevelsPeriod.storageKey) private var period = LevelsPeriod.oneWeek
    private var values = DashboardValues()

    var body: some View {
        let settings = values.nutritionSettings
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader("Overview")
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
            VStack(spacing: 10) {
                HStack(spacing: 2) {
                    BodyMap(values: sets, side: .front)
                    BodyMap(values: sets, side: .back)
                }
                .frame(height: 190)
                HStack(spacing: 6) {
                    Circle().fill(Theme.muscle).frame(width: 7, height: 7)
                    Text("Weekly sets, \(period.rawValue)")
                }
                .font(AppFont.rowDetail)
                .foregroundStyle(Theme.textSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            }
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
            Text("Today").font(AppFont.headline(14)).foregroundStyle(Theme.textSecondary)
            ForEach(lines) { line in
                VStack(alignment: .leading, spacing: 6) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(line.nutrient.title).font(AppFont.headline(13))
                        Spacer(minLength: 4)
                        Text(line.text(.eaten)).font(AppFont.rowDetail).monospacedDigit()
                    }
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                    ProgressView(value: line.fill(.eaten)?.eaten ?? 0).progressViewStyle(.bar(line.nutrient.color, height: 5))
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(line.spoken)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .feedback(self)
    }
}
