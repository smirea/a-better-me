import SwiftUI

/// Every finished workout, newest first and grouped by day. A row opens its summary.
struct WorkoutHistoryView: View {
    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(SessionHistory.self) private var history
    private var sessions: [WorkoutSession] { history.sessions }
    @State private var selected: WorkoutSession?

    var body: some View {
        let days = Dictionary(grouping: sessions) { Calendar.current.startOfDay(for: $0.startedAt) }
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                ForEach(days.keys.sorted(by: >), id: \.self) { day in
                    Text(day.formatted(date: .abbreviated, time: .omitted))
                        .font(AppFont.title(18))
                        .padding(.top, 20)
                        .padding(.bottom, 4)
                    ForEach(days[day] ?? []) { session in
                        Button { selected = session } label: { HistoryRow(session: session) }
                            .foregroundStyle(Theme.textPrimary)
                    }
                }
            }
            .padding(.horizontal, 20)
        }
        .background(Theme.background)
        .overlay {
            if sessions.isEmpty {
                ContentUnavailableView("No Workouts Yet", systemImage: "clock.arrow.circlepath", description: Text("Finished workouts show up here."))
            }
        }
        .navigationTitle("Workout History")
        .navigationBarTitleDisplayMode(.inline)
        .fullScreenCover(item: $selected) { WorkoutSummaryView(session: $0) }
    }
}

private struct HistoryRow: View {
    let session: WorkoutSession
    @Environment(ExerciseCatalog.self) private var catalog

    var body: some View {
        let exercises = session.blocks.flatMap(\.exercises).filter(\.hasLoggedSets).compactMap { catalog.exercise($0.exerciseID) }
        let primary = exercises.flatMap(\.primaryMuscles).uniqued()
        let secondary = exercises.flatMap(\.secondaryMuscles).uniqued().filter { !primary.contains($0) }
        HStack(spacing: 14) {
            Image(systemName: "dumbbell.fill")
                .foregroundStyle(.black)
                .frame(width: 40, height: 40)
                .background(Theme.accent, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
            VStack(alignment: .leading, spacing: 4) {
                Text(session.name).font(AppFont.headline(16))
                Text(exercises.map(\.name).joined(separator: ", "))
                    .font(AppFont.caption())
                    .foregroundStyle(Theme.textSecondary)
                    .lineLimit(1)
                ScrollView(.horizontal) {
                    HStack(spacing: 4) {
                        ForEach(primary) { tag($0, primary: true) }
                        ForEach(secondary) { tag($0, primary: false) }
                    }
                }
                .scrollIndicators(.hidden)
            }
            Image(systemName: "chevron.right").foregroundStyle(Theme.textTertiary)
        }
        .padding(.vertical, 6)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(session.name), \(session.startedAt.formatted(date: .abbreviated, time: .shortened))")
    }

    private func tag(_ muscle: Muscle, primary: Bool) -> some View {
        let shape = RoundedRectangle(cornerRadius: 4)
        return Text(muscle.displayName)
            .font(AppFont.caption(11))
            .foregroundStyle(Theme.textSecondary)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background { if primary { shape.fill(Theme.surfaceRaised) } }
            .overlay { if !primary { shape.strokeBorder(Theme.surfaceRaised) } }
    }
}

private extension Array where Element: Hashable {
    func uniqued() -> [Element] {
        var seen = Set<Element>()
        return filter { seen.insert($0).inserted }
    }
}
