import SwiftUI

/// The ⋮ that opens Exercise Options and Superset Options.
struct OptionsLabel: View {
    let title: String

    var body: some View {
        Image(systemName: "ellipsis")
            .rotationEffect(.degrees(90))
            .font(AppFont.headline())
            .foregroundStyle(Theme.textPrimary)
            .frame(width: 32, height: 44)
            .contentShape(Rectangle())
            .accessibilityLabel(title)
    }
}

/// The 2:3 exercise photo on workout rows. Superset members carry a small ⇄ badge.
struct ExerciseThumbnail: View {
    let exercise: Exercise?
    var inSuperset = false

    var body: some View {
        Group {
            if let exercise { ExerciseImage(exercise: exercise) } else { Theme.surfaceRaised }
        }
        .frame(width: 46, height: 64)
        .clipShape(RoundedRectangle(cornerRadius: 4))
        .overlay(alignment: .bottomTrailing) {
            if inSuperset {
                Image(systemName: "arrow.left.arrow.right")
                    .font(AppFont.title(9))
                    .foregroundStyle(Theme.textPrimary)
                    .frame(width: 18, height: 18)
                    .background(Theme.background, in: RoundedRectangle(cornerRadius: 4))
                    .offset(x: -3, y: -3)
            }
        }
    }
}

/// "8-12 reps", "8 reps", or "No rep target" for one set's line on a workout row.
extension SetTarget {
    var repsText: String {
        switch (repsMin, repsMax) {
        case let (min?, max?) where min != max: "\(min)-\(max) reps"
        case let (reps?, _), let (nil, reps?): "\(reps) reps"
        case (nil, nil): "No rep target"
        }
    }
}

extension Int {
    /// "1:30" for rest timers.
    var minuteSecond: String { Duration.seconds(self).formatted(.time(pattern: .minuteSecond)) }
}
