import SwiftUI

/// The small 4 pt tags under exercise rows: filled for primary muscles, outlined for secondary ones.
/// `highlight` draws one muscle in white, as on the Levels muscle detail.
struct MuscleTags: View {
    let primary: [Muscle]
    let secondary: [Muscle]
    var highlight: Muscle?

    init(exercise: Exercise, highlight: Muscle? = nil) {
        self.init(primary: exercise.primaryMuscles, secondary: exercise.secondaryMuscles, highlight: highlight)
    }

    /// A workout's tags: every muscle its exercises train, as the Workout Library rows show them.
    init(primary: [Muscle], secondary: [Muscle], highlight: Muscle? = nil) {
        self.primary = primary
        self.secondary = secondary
        self.highlight = highlight
    }

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 4) {
                ForEach(primary) { tag($0, primary: true) }
                ForEach(secondary) { tag($0, primary: false) }
            }
        }
        .scrollIndicators(.hidden)
    }

    private func tag(_ muscle: Muscle, primary: Bool) -> some View {
        let color = muscle == highlight ? Theme.textPrimary : Theme.surfaceRaised
        let shape = RoundedRectangle(cornerRadius: 4)
        return Text(muscle.displayName)
            .font(AppFont.caption(11))
            .foregroundStyle(primary && muscle == highlight ? Theme.onPrimary : Theme.textSecondary)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background { if primary { shape.fill(color) } }
            .overlay { if !primary { shape.strokeBorder(color) } }
    }
}

/// The mini figure with one muscle highlighted, used by Target Muscles cards, the picker's muscle filter, and Levels rows.
struct MuscleTile: View {
    let muscle: Muscle

    var body: some View {
        if let crop = BodyFigure.shared.tiles[muscle] {
            BodyCrop(crop: crop) { region in
                switch region {
                case .silhouette: BodyFigure.silhouette
                case .muscle(muscle): Theme.muscle
                case .bone, .muscle: BodyFigure.muscleBase
                }
            }
            .background(Color(hex: 0x252525))
        } else {
            Image(systemName: "figure.stand").resizable().scaledToFit().foregroundStyle(Theme.textTertiary).padding(8)
        }
    }
}

/// The colored corner badge on a reps cell and the circles in the RIR picker.
struct RIRBadge: View {
    let rir: Int?

    var body: some View {
        Text(rir.map { $0 >= 6 ? "6+" : "\($0)" } ?? "?")
            .font(AppFont.headline(11))
            .foregroundStyle(.white)
            .frame(minWidth: 18, minHeight: 18)
            .background(Theme.rir(rir), in: Circle())
    }
}

/// The 36 pt set circle: the set number for standard sets, the type letter (W, D, M, F) otherwise.
struct SetBadge: View {
    let type: SetType
    let number: Int

    var body: some View {
        Text(type.badge ?? "\(number)")
            .font(AppFont.headline(15))
            .frame(width: 36, height: 36)
            .background(Theme.surfaceRaised, in: Circle())
    }
}
