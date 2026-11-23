import Feedback
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
                ForEach(Array(days.enumerated()), id: \.element.start) { index, day in
                    FlatSection(day.start.formatted(date: .abbreviated, time: .omitted), divider: index > 0, spacing: 4) {
                        ForEach(day.sessions) { session in
                            Button { selected = session } label: { SessionRow(session: session) }
                                .foregroundStyle(Theme.textPrimary)
                        }
                    }
                    .padding(.top, 16)
                }
            }
            .padding(.horizontal, Theme.margin)
        }
        .background(Theme.background)
        .overlay {
            if days.isEmpty {
                ContentUnavailableView("No Workouts Yet", systemImage: "clock.arrow.circlepath")
            }
        }
        .detailTitle("Workout History")
        .fullScreenCover(item: $selected) { WorkoutSummaryView(session: $0) }
        .feedback(self)
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

/// A finished session: its name, the exercises it logged, and their muscles. The history lists them, and the Workout tab
/// shows one under its day strip.
struct SessionRow: View {
    let session: WorkoutSession
    @Environment(ExerciseCatalog.self) private var catalog
    @State private var details = ViewMemo<DetailsKey, Details>()

    private struct DetailsKey: Equatable {
        let blocks: [WorkoutBlock]
        let catalogRevision: Int
    }

    private struct Details {
        let names: String
        let primary: [Muscle]
        let secondary: [Muscle]
    }

    var body: some View {
        let details = details(DetailsKey(blocks: session.blocks, catalogRevision: catalog.revision)) {
            let exercises = session.blocks.flatMap(\.exercises).filter(\.hasLoggedSets).compactMap { catalog.exercise($0.exerciseID) }
            let primary = exercises.flatMap(\.primaryMuscles).uniqued()
            return Details(
                names: exercises.map(\.name).joined(separator: ", "),
                primary: primary,
                secondary: exercises.flatMap(\.secondaryMuscles).uniqued().filter { !primary.contains($0) }
            )
        }
        HStack(spacing: 14) {
            Image(systemName: "dumbbell.fill")
                .foregroundStyle(Theme.textPrimary)
                .frame(width: 40, height: 40)
                .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
            VStack(alignment: .leading, spacing: 4) {
                Text(session.name).font(AppFont.headline(16))
                Text(details.names)
                    .font(AppFont.rowDetail)
                    .foregroundStyle(Theme.textSecondary)
                    .lineLimit(1)
                MuscleTags(primary: details.primary, secondary: details.secondary)
            }
            Image(systemName: "chevron.right").foregroundStyle(Theme.textTertiary)
        }
        .padding(.vertical, 6)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(session.name), \(session.startedAt.formatted(date: .abbreviated, time: .shortened))")
        .feedback(self)
    }
}

private extension Array where Element: Hashable {
    func uniqued() -> [Element] {
        var seen = Set<Element>()
        return filter { seen.insert($0).inserted }
    }
}
