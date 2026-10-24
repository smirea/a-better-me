import SwiftUI
import UIKit

extension ExerciseMetric {
    var displayName: String {
        switch self {
        case .weight: "Weight"
        case .assistanceWeight: "Weight (Assistance)"
        case .weightPerSide: "Weight per side"
        case .weightPerSidePersistent: "Weight per side (Persistent)"
        case .reps: "Reps"
        case .repsPerSide: "Reps per side"
        case .duration: "Duration"
        case .durationPerSide: "Duration per side"
        case .distanceShort: "Distance short"
        case .distanceShortPerSide: "Distance short per side"
        case .distanceLong: "Distance long"
        }
    }

    var summary: String {
        switch self {
        case .weight: "Track the load used for each set"
        case .assistanceWeight: "Track assisted or supported weight"
        case .weightPerSide: "Track the load used for each set per side"
        case .weightPerSidePersistent: "Track singular weight used on both sides"
        case .reps: "Track the number of repetitions performed"
        case .repsPerSide: "Track the number of repetitions performed per side"
        case .duration: "Track time for each set"
        case .durationPerSide: "Track time for each set per side"
        case .distanceShort: "Track short distances, like sprints or carries"
        case .distanceShortPerSide: "Track short distances per side"
        case .distanceLong: "Track long distances, like runs or rows"
        }
    }

    static let wizardOrder: [ExerciseMetric] = [
        .reps, .repsPerSide, .weight, .weightPerSide, .weightPerSidePersistent, .assistanceWeight,
        .duration, .durationPerSide, .distanceShort, .distanceShortPerSide, .distanceLong,
    ]
}

extension Laterality {
    var displayName: String { rawValue.capitalized }

    var summary: String {
        switch self {
        case .bilateral: "Both sides of the body work together at the same time"
        case .unilateral: "One side of the body works at a time"
        case .asymmetrical: "Both sides work at the same time, but each does something different"
        }
    }
}

extension Exercise {
    /// "Chest, Front Delts • Triceps": primary muscles, then secondary ones after the bullet.
    var muscleLine: String {
        let primary = primaryMuscles.map(\.displayName).joined(separator: ", ")
        let secondary = secondaryMuscles.map(\.displayName).joined(separator: ", ")
        return [primary, secondary].filter { !$0.isEmpty }.joined(separator: " • ")
    }

    /// "Weight x Reps", in the reference app's order: load before reps.
    var metricsLine: String {
        metrics.sorted { $0.isWeight && !$1.isWeight }.map(\.displayName).joined(separator: " x ")
    }
}

struct LibraryExerciseRow<Trailing: View>: View {
    let exercise: Exercise
    var search = ExerciseSearch("")
    var subtitle: String?
    @ViewBuilder var trailing: Trailing

    var body: some View {
        HStack(spacing: 12) {
            ExerciseTile(exercise: exercise)
            VStack(alignment: .leading, spacing: 2) {
                Text(search.highlighted(exercise.name))
                    .font(AppFont.medium(15))
                    .foregroundStyle(Theme.textPrimary)
                Text(exercise.muscleLine)
                    .font(AppFont.caption(12))
                    .foregroundStyle(Theme.textSecondary)
                if let subtitle {
                    Text(subtitle).font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            trailing
        }
        .contentShape(.rect)
    }
}

/// The 2:3 studio photo tile. Custom exercises have no media, so they show their initials stacked, as in the reference.
struct ExerciseTile: View {
    let exercise: Exercise
    var width: CGFloat = 30

    var body: some View {
        Group {
            if exercise.images.isEmpty {
                VStack(spacing: 0) {
                    ForEach(Array(exercise.name.split(separator: " ").prefix(2).enumerated()), id: \.offset) { _, word in
                        Text(word.prefix(1).uppercased())
                    }
                }
                .font(AppFont.headline(width * 0.4))
                .foregroundStyle(Theme.textSecondary)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Theme.surfaceRaised)
            } else {
                ExerciseImage(exercise: exercise)
            }
        }
        .frame(width: width, height: width * 1.5)
        .clipShape(.rect(cornerRadius: width / 5))
    }
}

struct EquipmentImage: View {
    @Environment(ExerciseCatalog.self) private var catalog
    let equipmentID: String

    var body: some View {
        if let image = ExerciseCatalog.image(catalog.equipment[equipmentID]?.image) {
            Image(uiImage: image).resizable().scaledToFit()
        } else {
            Image(systemName: "dumbbell").resizable().scaledToFit().foregroundStyle(Theme.textTertiary).padding(4)
        }
    }
}

/// An active filter turns white, like the reference's selected gym chip.
struct FilterChipLabel: View {
    let title: String
    let systemImage: String
    var isActive = false

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: systemImage).imageScale(.small)
            Text(title).lineLimit(1)
            Image(systemName: "chevron.down").imageScale(.small)
        }
        .font(AppFont.medium(13))
        .foregroundStyle(isActive ? Color.black : Theme.textPrimary)
        .padding(.horizontal, 12)
        .frame(height: 32)
        .background(isActive ? Theme.textPrimary : Theme.surfaceRaised, in: .capsule)
    }
}

extension View {
    func primaryPill() -> some View {
        buttonStyle(.glassProminent)
            .buttonSizing(.flexible)
            .controlSize(.large)
            .tint(Theme.textPrimary)
            .foregroundStyle(Color.black)
            .font(AppFont.headline())
    }

    func secondaryPill() -> some View {
        buttonStyle(.glass)
            .buttonSizing(.flexible)
            .controlSize(.large)
            .foregroundStyle(Theme.textPrimary)
            .font(AppFont.headline())
    }
}

struct SectionTitle: View {
    let title: String

    init(_ title: String) { self.title = title }

    var body: some View {
        Text(title).font(AppFont.title(18)).foregroundStyle(Theme.textPrimary)
    }
}

/// MF's 5-segment bar for Range of Motion and Stability.
struct RatingBar: View {
    let value: Int

    var body: some View {
        HStack(spacing: 3) {
            ForEach(1...5, id: \.self) { segment in
                Capsule().fill(segment <= value ? Theme.textPrimary : Theme.surfaceRaised).frame(width: 16, height: 4)
            }
        }
        .accessibilityHidden(true)
    }
}
