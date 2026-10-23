import SwiftUI

/// More > Exercises. Also the base of the exercise picker the builder and live session present.
struct ExerciseLibraryView: View {
    @Environment(ExerciseCatalog.self) private var catalog

    var body: some View {
        List(catalog.all) { exercise in
            HStack(spacing: 12) {
                ExerciseImage(exercise: exercise)
                    .frame(width: 44, height: 44)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
                VStack(alignment: .leading) {
                    Text(exercise.name).font(AppFont.medium())
                    Text(exercise.primaryMuscles.map(\.displayName).joined(separator: ", "))
                        .font(AppFont.caption())
                        .foregroundStyle(Theme.textSecondary)
                }
            }
        }
        .navigationTitle("Exercises")
    }
}
