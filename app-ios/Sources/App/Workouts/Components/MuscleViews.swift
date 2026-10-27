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
        let shape = RoundedRectangle(cornerRadius: Theme.tinyCornerRadius)
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

/// A muscle's tile beside its name and detail lines, for an exercise's target muscles and a workout's muscle totals.
struct MuscleTileCard: View {
    let muscle: Muscle
    let details: [String]

    var body: some View {
        HStack(spacing: 10) {
            MuscleTile(muscle: muscle).frame(width: 52, height: 52)
            VStack(alignment: .leading, spacing: 2) {
                Text(muscle.displayName).font(AppFont.rowTitle)
                ForEach(details, id: \.self) { Text($0) }
                    .font(AppFont.rowDetail)
                    .foregroundStyle(Theme.textSecondary)
            }
            .padding(.trailing, 12)
        }
        .padding(4)
        .background(Theme.surface, in: .rect(cornerRadius: Theme.smallCornerRadius))
        .overlay { RoundedRectangle(cornerRadius: Theme.smallCornerRadius).strokeBorder(Theme.surfaceRaised) }
    }
}

/// The colored corner badge on a reps cell and the circles in the RIR picker.
struct RIRBadge: View {
    let rir: Int?

    var body: some View {
        Text(rir.map { $0 >= 6 ? "6+" : "\($0)" } ?? "?")
            .font(AppFont.badge)
            .foregroundStyle(Theme.textPrimary)
            .frame(minWidth: 18, minHeight: 18)
            .background(Theme.rir(rir), in: Circle())
    }
}

/// The set circle: the set number for standard sets, the type letter (W, D, M, F) otherwise. Set tables use the
/// regular size; target and summary lines use the compact one.
struct SetBadge: View {
    enum Size { case regular, compact }

    let type: SetType
    let number: Int
    var size = Size.regular

    var body: some View {
        Text(type.badge ?? "\(number)")
            .font(size == .regular ? AppFont.headline(15) : AppFont.badge)
            .frame(width: size == .regular ? 36 : 20, height: size == .regular ? 36 : 20)
            .background(Theme.surfaceRaised, in: .circle)
    }
}
