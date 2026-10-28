import ActivityKit
import SwiftUI
import WidgetKit

/// The in-progress workout on the Lock Screen and in the Dynamic Island, after MF Workouts' Live Activity: the set to
/// do next with its values and a complete button, the rest countdown with −15 / +15 and skip, and a finished banner.
struct WorkoutLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutActivityAttributes.self) { context in
            ActivityBanner(phase: Phase(context))
                .activityBackgroundTint(Theme.background)
                .activitySystemActionForegroundColor(Theme.textPrimary)
                .widgetURL(LiveActivityLink.liveWorkout)
        } dynamicIsland: { context in
            let phase = Phase(context)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Thumbnail(set: phase.shownSet, size: 44)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    PhaseClock(phase: phase)
                        .font(AppFont.number(17))
                        .multilineTextAlignment(.trailing)
                        .frame(width: 64, alignment: .trailing)
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.center) {
                    Heading(phase: phase)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Controls(phase: phase, inIsland: true)
                        .padding(.top, 4)
                }
            } compactLeading: {
                if phase.rest != nil {
                    Image(systemName: "timer")
                        .foregroundStyle(Theme.accent)
                } else {
                    Thumbnail(set: phase.shownSet, size: 24)
                }
            } compactTrailing: {
                PhaseClock(phase: phase)
                    .font(AppFont.number(14))
                    .frame(width: 52)
            } minimal: {
                if let rest = phase.rest {
                    RestCountdown(rest: rest)
                        .font(AppFont.number(11))
                        .foregroundStyle(Theme.accent)
                        .minimumScaleFactor(0.6)
                } else {
                    Image(systemName: "dumbbell.fill")
                        .foregroundStyle(Theme.accent)
                }
            }
            .keylineTint(Theme.accent)
            .widgetURL(LiveActivityLink.liveWorkout)
        }
        .supplementalActivityFamilies([.small])
    }
}

/// The Lock Screen banner, or on a paired watch's Smart Stack (`.small`) the heading and clock, as MF Workouts shows
/// its Live Activity there. The small family has no room for the controls.
private struct ActivityBanner: View {
    let phase: Phase
    @Environment(\.activityFamily) private var family

    var body: some View {
        switch family {
        case .small:
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top, spacing: 8) {
                    Thumbnail(set: phase.shownSet, size: 32)
                    Spacer(minLength: 0)
                    PhaseClock(phase: phase).font(AppFont.number(15))
                }
                Heading(phase: phase)
            }
            .padding(12)
        default:
            LockScreenBanner(phase: phase).padding(16)
        }
    }
}

/// What the banner shows, derived once from the content state. A rest whose content went stale ran out while the app
/// was suspended, so it shows the set instead of a countdown stuck at 0:00.
enum Phase {
    case set(LiveWorkoutStatus, LiveSet)
    case rest(LiveWorkoutStatus, LiveRest)
    case paused(LiveWorkoutStatus)
    /// Every set is logged and the session is still open.
    case allDone(LiveWorkoutStatus)
    case finished(LiveWorkoutStatus, endedAt: Date)

    init(_ context: ActivityViewContext<WorkoutActivityAttributes>) {
        let status = context.state
        if let endedAt = status.endedAt {
            self = .finished(status, endedAt: endedAt)
        } else if status.pausedAt != nil {
            self = .paused(status)
        } else if let rest = status.rest, !context.isStale {
            self = .rest(status, rest)
        } else if let current = status.current {
            self = .set(status, current)
        } else {
            self = .allDone(status)
        }
    }

    var status: LiveWorkoutStatus {
        switch self {
        case .set(let status, _), .rest(let status, _), .paused(let status), .allDone(let status), .finished(let status, _): status
        }
    }

    var rest: LiveRest? {
        if case .rest(_, let rest) = self { rest } else { nil }
    }

    /// The set whose values the banner shows. During a rest `current` is already the set that follows it.
    var shownSet: LiveSet? {
        switch self {
        case .allDone, .finished: nil
        case .set, .rest, .paused: status.current
        }
    }
}
