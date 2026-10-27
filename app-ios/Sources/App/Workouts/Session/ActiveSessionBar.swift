import SwiftUI

/// Sits above the tab bar while a session is in progress and reopens it. Empty otherwise.
struct ActiveSessionBar: View {
    @Environment(LiveWorkoutPresenter.self) private var presenter
    @Observe(WorkoutSession.inProgress) private var session

    var body: some View {
        if let session {
            Button { presenter.isExpanded = true } label: {
                TimelineView(.periodic(from: .now, by: 1)) { context in
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 0) {
                            Text(session.name).font(AppFont.rowTitle).lineLimit(1)
                            let store = LiveSessionStore.shared
                            Text(store.pausedAt != nil ? "Paused" : Duration.seconds(session.elapsed(at: context.date, pausedAt: nil)).formatted(.time(pattern: .hourMinuteSecond)))
                                .font(AppFont.rowDetail)
                                .monospacedDigit()
                                .foregroundStyle(Theme.textSecondary)
                        }
                        Spacer()
                        if let rest = LiveSessionStore.shared.rest {
                            Label(
                                rest.remaining(at: context.date).countdown,
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
