import SwiftData
import SwiftUI

/// Sits above the tab bar while a session is in progress and reopens it. Empty otherwise.
struct ActiveSessionBar: View {
    @Environment(LiveWorkoutPresenter.self) private var presenter
    @Query(filter: #Predicate<WorkoutSession> { $0.endedAt == nil }) private var sessions: [WorkoutSession]

    var body: some View {
        if let session = sessions.first {
            Button { presenter.isExpanded = true } label: {
                TimelineView(.periodic(from: .now, by: 1)) { context in
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 0) {
                            Text(session.name).font(AppFont.headline(15)).lineLimit(1)
                            Text(Duration.seconds(context.date.timeIntervalSince(session.startedAt)).formatted(.time(pattern: .hourMinuteSecond)))
                                .font(AppFont.caption())
                                .monospacedDigit()
                                .foregroundStyle(Theme.textSecondary)
                        }
                        Spacer()
                        if let rest = LiveSessionStore.shared.rest {
                            Label(
                                Duration.seconds(rest.remaining(at: context.date).rounded(.up)).formatted(.time(pattern: .minuteSecond)),
                                systemImage: "stopwatch.fill"
                            )
                            .font(AppFont.number(15))
                        }
                        Image(systemName: "chevron.up")
                    }
                    .padding(.horizontal, 16)
                    .contentShape(Rectangle())
                }
            }
            .foregroundStyle(Theme.textPrimary)
            .accessibilityLabel("Resume \(session.name)")
            #if DEBUG
            .task { SampleWorkout.expandIfRequested(presenter) }
            #endif
        }
    }
}
