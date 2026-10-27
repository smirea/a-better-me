import SwiftUI

/// One muscle's average weekly sets and the lifts that contributed them, pushed from a Levels row.
struct MuscleLevelsView: View {
    let muscle: Muscle

    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(SessionHistory.self) private var history
    @AppStorage(LevelsPeriod.storageKey) private var period = LevelsPeriod.oneWeek
    @State private var shownExercise: ShownExercise?

    var body: some View {
        let weekly = WeeklySets.memoized(in: history, period: period, catalog: catalog)
        List {
            Section {
                VStack(spacing: 16) {
                    PeriodCaption(period: $period)
                    MuscleLevelRow(muscle: muscle, sets: weekly.sets(muscle), top: weekly.top)
                }
                .listRowBackground(Color.clear)
            }
            ThemedSection("Contributing Lifts") {
                ForEach(weekly.lifts(for: muscle), id: \.exerciseID) { id, sets in
                    if let exercise = catalog.exercise(id) {
                        Button { shownExercise = ShownExercise(id: id) } label: {
                            LiftRow(exercise: exercise, sets: sets, muscle: muscle)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .themedList()
        .detailTitle(muscle.displayName)
        .sheet(item: $shownExercise) { ExerciseDetailSheet(exerciseID: $0.id) }
    }
}

private struct ShownExercise: Identifiable {
    let id: ExerciseID
}

private struct LiftRow: View {
    let exercise: Exercise
    let sets: Double
    let muscle: Muscle

    var body: some View {
        HStack(spacing: 14) {
            ExerciseTile(exercise: exercise)
            VStack(alignment: .leading, spacing: 6) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(exercise.name).font(AppFont.rowTitle).lineLimit(2)
                    Text(WeeklySets.label(sets)).font(AppFont.caption(14)).foregroundStyle(Theme.textSecondary)
                }
                .accessibilityElement(children: .combine)
                MuscleTags(exercise: exercise, highlight: muscle)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.forward")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Theme.textTertiary)
        }
        .contentShape(.rect)
    }
}
