import SwiftUI
import UIKit
import WidgetKit

struct LockScreenBanner: View {
    let phase: Phase

    var body: some View {
        VStack(alignment: .leading, spacing: phase.rest == nil ? 12 : 8) {
            switch phase {
            case .rest(_, let rest):
                RestHeader(rest: rest)
                Controls(phase: phase)
                if let next = phase.shownSet {
                    Text("Up next · \(next.exerciseName) · \(next.position)")
                        .font(AppFont.caption(12))
                        .foregroundStyle(Theme.textSecondary)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity)
                }
            case .finished(let status, let endedAt):
                FinishedSummary(status: status, endedAt: endedAt)
            case .set, .paused, .allDone:
                HStack(alignment: .top, spacing: 12) {
                    Thumbnail(set: phase.shownSet, size: 56)
                    Heading(phase: phase)
                    PhaseClock(phase: phase)
                        .font(AppFont.number(15))
                        .multilineTextAlignment(.trailing)
                        .frame(width: 64, alignment: .trailing)
                }
                Controls(phase: phase)
                ProgressLine(status: phase.status)
            }
        }
        .foregroundStyle(Theme.textPrimary)
    }
}

/// The caption over the title: "Set 2 of 4" over the exercise, or "Paused" or the set count over the workout.
struct Heading: View {
    let phase: Phase

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(caption)
                .font(AppFont.caption(13))
                .foregroundStyle(captionColor)
                .lineLimit(1)
            Text(phase.shownSet?.exerciseName ?? phase.status.name)
                .font(AppFont.headline(16))
                .foregroundStyle(Theme.textPrimary)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var caption: String {
        switch phase {
        case .set(_, let set): set.position
        case .rest: phase.shownSet.map { "Up next · \($0.position)" } ?? "Rest"
        case .paused: "Paused"
        case .allDone(let status): "All \(status.totalSets) sets logged"
        case .finished: "Workout complete"
        }
    }

    private var captionColor: Color {
        switch phase {
        case .paused: Theme.amber
        case .rest, .allDone: Theme.accent
        case .set, .finished: Theme.textSecondary
        }
    }
}

/// "REST" over −15, the countdown, and +15.
struct RestHeader: View {
    let rest: LiveRest

    var body: some View {
        VStack(spacing: 0) {
            Text("REST")
                .font(AppFont.display(15))
                .foregroundStyle(Theme.accent)
            HStack {
                RestStepButton(seconds: -15)
                RestCountdown(rest: rest)
                    .font(AppFont.number(40))
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                RestStepButton(seconds: 15)
            }
        }
    }
}

struct RestStepButton: View {
    let seconds: Int
    var width: CGFloat = 60

    var body: some View {
        Button(intent: LiveWorkoutIntent(.adjustRest(seconds: seconds))) {
            Text(seconds < 0 ? "−\(-seconds)" : "+\(seconds)")
                .font(AppFont.title(18))
                .foregroundStyle(Theme.textPrimary)
                .frame(width: width, height: 40)
                .background(Theme.surfaceRaised, in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(seconds < 0 ? "Rest \(-seconds) seconds less" : "Rest \(seconds) seconds more")
    }
}

/// Pause or resume on the left, the shown set's values in the middle, and the main action on the right: complete the
/// set, skip the rest, or open the app to finish. The Dynamic Island has no room for the banner's rest header, so during
/// a rest its row trades pause for −15 and +15.
struct Controls: View {
    let phase: Phase
    var inIsland = false

    var body: some View {
        HStack(spacing: 8) {
            if inIsland, phase.rest != nil {
                RestStepButton(seconds: -15, width: 48)
            } else if case .paused = phase {
                ControlButton(intent: LiveWorkoutIntent(.resume), systemImage: "play.fill", label: "Resume workout")
            } else {
                ControlButton(intent: LiveWorkoutIntent(.pause), systemImage: "pause.fill", label: "Pause workout")
            }
            Spacer(minLength: 0)
            if let set = phase.shownSet {
                StatPills(set: set, unit: phase.status.unit)
            }
            Spacer(minLength: 0)
            if inIsland, phase.rest != nil {
                RestStepButton(seconds: 15, width: 48)
            }
            mainAction
        }
    }

    @ViewBuilder private var mainAction: some View {
        if phase.rest != nil {
            ControlButton(intent: LiveWorkoutIntent(.skipRest), systemImage: "forward.fill", label: "Skip rest", prominent: true)
        } else if let set = phase.shownSet {
            ControlButton(
                intent: LiveWorkoutIntent(.log(rowID: set.id, values: set.values)),
                systemImage: "checkmark", label: "Complete set", prominent: true
            )
        } else {
            Link(destination: LiveActivityLink.liveWorkout) {
                Text("Finish")
                    .font(AppFont.headline(15))
                    .foregroundStyle(Theme.background)
                    .padding(.horizontal, 18)
                    .frame(height: 40)
                    .background(Theme.accent, in: Capsule())
            }
            .accessibilityLabel("Finish workout")
        }
    }
}

struct ControlButton: View {
    let intent: LiveWorkoutIntent
    let systemImage: String
    let label: String
    var prominent = false

    var body: some View {
        Button(intent: intent) {
            Image(systemName: systemImage)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(prominent ? Theme.background : Theme.textPrimary)
                .frame(width: 44, height: 40)
                .background(prominent ? Theme.accent : Theme.surfaceRaised, in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

/// MF's metric pills: the value over a small caps unit, with the RIR badge on the last pill.
struct StatPills: View {
    let set: LiveSet
    let unit: WeightUnit

    var body: some View {
        let stats = stats
        HStack(spacing: 6) {
            ForEach(stats.indices, id: \.self) { index in
                VStack(spacing: 0) {
                    Text(stats[index].value)
                        .font(AppFont.number(18))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    Text(stats[index].unit)
                        .font(AppFont.medium(10))
                        .foregroundStyle(Theme.textSecondary)
                }
                .padding(.horizontal, 10)
                .frame(minWidth: 52, minHeight: 40)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
                .overlay(alignment: .topTrailing) {
                    if index == stats.indices.last, let rir = set.values.rir {
                        RIRBadge(rir: rir).offset(x: 6, y: -6)
                    }
                }
            }
        }
    }

    private var stats: [(value: String, unit: String)] {
        let values = set.values
        return set.fields.compactMap { field in
            switch field {
            case .weight: (values.weightKg.map(weight) ?? "–", unit.rawValue.uppercased())
            case .reps: (values.reps.map(String.init) ?? "–", "REPS")
            case .duration: (values.durationSeconds.map { Duration.seconds($0).formatted(.time(pattern: .minuteSecond)) } ?? "–", "TIME")
            case .distance: distance(values.distanceMeters)
            case .rir: nil
            }
        }
    }

    /// One decimal at most, so 85 kg reads "187.4" in a pill sized for "140".
    private func weight(_ kg: Double) -> String {
        unit.fromKg(kg).formatted(.number.precision(.fractionLength(0...1)))
    }

    private func distance(_ meters: Double?) -> (String, String) {
        guard let meters else { return ("–", "M") }
        if meters < 1000 { return (meters.formatted(.number.precision(.fractionLength(0))), "M") }
        return ((meters / 1000).formatted(.number.precision(.fractionLength(0...2))), "KM")
    }
}

struct RIRBadge: View {
    let rir: Int

    var body: some View {
        Text(rir >= 6 ? "6+" : "\(rir)")
            .font(AppFont.title(11))
            .foregroundStyle(Theme.background)
            .frame(minWidth: 18, minHeight: 18)
            .background(Theme.rir(rir), in: Circle())
            .accessibilityLabel("\(rir) RIR")
    }
}

/// The exercise frame the app wrote to the app group, else the name's initials.
struct Thumbnail: View {
    let set: LiveSet?
    let size: CGFloat

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: size < 32 ? size / 2 : size * 0.2)
        content
            .frame(width: size, height: size)
            .background(Theme.surfaceRaised)
            .clipShape(shape)
    }

    @ViewBuilder private var content: some View {
        if let set, let url = ExerciseThumbnails.url(for: set.catalogID), let image = UIImage(contentsOfFile: url.path) {
            Image(uiImage: image).resizable().scaledToFit()
        } else if let set {
            Text(initials(set.exerciseName))
                .font(AppFont.title(size * 0.36))
                .foregroundStyle(Theme.textSecondary)
        } else {
            Image(systemName: "dumbbell.fill")
                .font(.system(size: size * 0.4))
                .foregroundStyle(Theme.accent)
        }
    }

    private func initials(_ name: String) -> String {
        String(name.split(separator: " ").prefix(2).compactMap(\.first)).uppercased()
    }
}

/// The rest countdown on the right of the Dynamic Island, else the workout clock.
struct PhaseClock: View {
    let phase: Phase

    var body: some View {
        switch phase {
        case .rest(_, let rest):
            RestCountdown(rest: rest).foregroundStyle(Theme.accent)
        case .finished(let status, let endedAt):
            Text(elapsed(from: status.pauseAdjustedStart, to: endedAt)).foregroundStyle(Theme.textSecondary)
        case .paused(let status):
            WorkoutClock(status: status).foregroundStyle(Theme.amber)
        case .set(let status, _), .allDone(let status):
            WorkoutClock(status: status).foregroundStyle(Theme.textSecondary)
        }
    }
}

/// Ticks on its own from `pauseAdjustedStart`, and holds still while paused.
struct WorkoutClock: View {
    let status: LiveWorkoutStatus

    var body: some View {
        Text(timerInterval: status.pauseAdjustedStart...Date.distantFuture, pauseTime: status.pausedAt, countsDown: false)
    }
}

struct RestCountdown: View {
    let rest: LiveRest

    var body: some View {
        Text(timerInterval: rest.startedAt...rest.endsAt, countsDown: true)
    }
}

struct ProgressLine: View {
    let status: LiveWorkoutStatus

    var body: some View {
        ProgressView(value: Double(status.completedSets), total: Double(max(status.totalSets, 1)))
            .tint(Theme.accent)
            .accessibilityLabel("\(status.completedSets) of \(status.totalSets) sets")
    }
}

struct FinishedSummary: View {
    let status: LiveWorkoutStatus
    let endedAt: Date

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "checkmark")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Theme.background)
                .frame(width: 56, height: 56)
                .background(Theme.green, in: RoundedRectangle(cornerRadius: 12))
            VStack(alignment: .leading, spacing: 2) {
                Text("WORKOUT COMPLETE")
                    .font(AppFont.display(13))
                    .foregroundStyle(Theme.green)
                Text(status.name)
                    .font(AppFont.headline(17))
                    .lineLimit(1)
                Text("\(elapsed(from: status.pauseAdjustedStart, to: endedAt)) · \(status.completedSets) of \(status.totalSets) sets")
                    .font(AppFont.caption(13))
                    .foregroundStyle(Theme.textSecondary)
            }
            Spacer(minLength: 0)
        }
    }
}

/// "42:10", or "1:02:10" past an hour.
func elapsed(from start: Date, to end: Date) -> String {
    let duration = Duration.seconds(max(0, end.timeIntervalSince(start)).rounded())
    return duration.formatted(.time(pattern: duration >= .seconds(3600) ? .hourMinuteSecond : .minuteSecond))
}
