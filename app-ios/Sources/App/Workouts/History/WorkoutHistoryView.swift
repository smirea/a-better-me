import SwiftUI

/// Every finished workout, newest first and grouped by day. A row opens its summary.
struct WorkoutHistoryView: View {
    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(SessionHistory.self) private var history
    @State private var selected: WorkoutSession?

    var body: some View {
        let days = history.memo(HistoryDaysKey()) { HistoryDay.group($0, calendar: .current) }
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                ForEach(days, id: \.start) { day in
                    Text(day.start.formatted(date: .abbreviated, time: .omitted))
                        .font(AppFont.listTitle)
                        .padding(.top, 20)
                        .padding(.bottom, 4)
                    ForEach(day.sessions) { session in
                        Button { selected = session } label: { HistoryRow(session: session) }
                            .foregroundStyle(Theme.textPrimary)
                    }
                }
            }
            .padding(.horizontal, Theme.margin)
        }
        .background(Theme.background)
        .overlay {
            if days.isEmpty {
                ContentUnavailableView("No Workouts Yet", systemImage: "clock.arrow.circlepath", description: Text("Finished workouts show up here."))
            }
        }
        .detailTitle("Workout History")
        .fullScreenCover(item: $selected) { WorkoutSummaryView(session: $0) }
    }
}

/// One day of the history: its start and its sessions, kept in the order they were given.
struct HistoryDay {
    let start: Date
    let sessions: [WorkoutSession]

    /// Days newest first.
    static func group(_ sessions: [WorkoutSession], calendar: Calendar) -> [HistoryDay] {
        Dictionary(grouping: sessions) { calendar.startOfDay(for: $0.startedAt) }
            .map { HistoryDay(start: $0.key, sessions: $0.value) }
            .sorted { $0.start > $1.start }
    }
}

private struct HistoryDaysKey: Hashable {}

private struct HistoryRow: View {
    let session: WorkoutSession
    @Environment(ExerciseCatalog.self) private var catalog

    var body: some View {
        let exercises = session.blocks.flatMap(\.exercises).filter(\.hasLoggedSets).compactMap { catalog.exercise($0.exerciseID) }
        let primary = exercises.flatMap(\.primaryMuscles).uniqued()
        let secondary = exercises.flatMap(\.secondaryMuscles).uniqued().filter { !primary.contains($0) }
        HStack(spacing: 14) {
            Image(systemName: "dumbbell.fill")
                .foregroundStyle(Theme.onPrimary)
                .frame(width: 40, height: 40)
                .background(Theme.accent, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
            VStack(alignment: .leading, spacing: 4) {
                Text(session.name).font(AppFont.headline(16))
                Text(exercises.map(\.name).joined(separator: ", "))
                    .font(AppFont.rowDetail)
                    .foregroundStyle(Theme.textSecondary)
                    .lineLimit(1)
                MuscleTags(primary: primary, secondary: secondary)
            }
            Image(systemName: "chevron.right").foregroundStyle(Theme.textTertiary)
        }
        .padding(.vertical, 6)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(session.name), \(session.startedAt.formatted(date: .abbreviated, time: .shortened))")
    }
}

private extension Array where Element: Hashable {
    func uniqued() -> [Element] {
        var seen = Set<Element>()
        return filter { seen.insert($0).inserted }
    }
}
