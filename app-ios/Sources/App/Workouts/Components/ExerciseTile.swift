import SwiftUI

/// The 2:3 studio photo tile for an exercise, at one of two sizes. Until a photo is on disk, and for custom exercises,
/// which have none, it shows the name's initials stacked, as in the reference.
struct ExerciseTile: View {
    enum Size {
        case small, regular

        var width: CGFloat {
            switch self {
            case .small: 30
            case .regular: 44
            }
        }
    }

    enum Badge { case superset, done }

    let exercise: Exercise?
    var size = Size.regular
    var badge: Badge?
    var frame = 0

    var body: some View {
        AssetImage(path: exercise?.images[safe: frame].map { "ExerciseImages/\($0).webp" }, contentMode: .fill) {
            initials
        }
        .frame(width: size.width, height: size.width * 1.5)
        .clipShape(.rect(cornerRadius: Theme.tinyCornerRadius))
        .overlay(alignment: badge == .superset ? .bottomTrailing : .center) {
            switch badge {
            case .superset:
                Image(systemName: "arrow.left.arrow.right")
                    .font(AppFont.title(9))
                    .foregroundStyle(Theme.textPrimary)
                    .frame(width: 18, height: 18)
                    .background(Theme.background, in: .rect(cornerRadius: Theme.tinyCornerRadius))
                    .offset(x: -3, y: -3)
            case .done:
                Image(systemName: "checkmark.circle.fill")
                    .font(.title3)
                    .foregroundStyle(Theme.onPrimary, Theme.textPrimary)
            case nil:
                EmptyView()
            }
        }
    }

    private var initials: some View {
        VStack(spacing: 0) {
            ForEach(Array((exercise?.name ?? "").split(separator: " ").prefix(2).enumerated()), id: \.offset) { _, word in
                Text(word.prefix(1).uppercased())
            }
        }
        .font(AppFont.headline(size.width * 0.4))
        .foregroundStyle(Theme.textSecondary)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.surfaceRaised)
    }
}
