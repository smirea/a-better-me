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
