import SwiftUI

/// The workout's exercises; tapping one makes it the phone's current exercise.
struct ExerciseListView: View {
    let snapshot: LiveWorkoutSnapshot
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let status = snapshot.status
        List {
            VStack(alignment: .leading, spacing: 2) {
                Text(status.name).font(AppFont.headline(16)).foregroundStyle(Theme.accent)
                Text(timerInterval: status.pauseAdjustedStart...Date.distantFuture, pauseTime: status.pausedAt, countsDown: false, showsHours: true)
                    .font(AppFont.title(17))
                Text("\(status.completedSets) of \(status.totalSets) sets").font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
            }
            .listRowBackground(Color.clear)
            ForEach(snapshot.exercises) { exercise in
                let isCurrent = exercise.id == status.current?.blockExerciseID
                Button {
                    WatchModel.shared.send(.select(exerciseID: exercise.id))
                    dismiss()
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        if snapshot.exercises.count { $0.block == exercise.block } > 1 {
                            Label("Superset", systemImage: "repeat").font(AppFont.caption(10)).foregroundStyle(Theme.textSecondary)
                        }
                        Text(exercise.name).font(AppFont.medium(14))
                        Text("\(exercise.completedSets) of \(exercise.totalSets) sets")
                            .font(AppFont.caption(11))
                            .foregroundStyle(exercise.completedSets == exercise.totalSets ? Theme.green : Theme.textSecondary)
                    }
                    .padding(.vertical, 2)
                }
                .listRowBackground(
                    RoundedRectangle(cornerRadius: Theme.smallCornerRadius)
                        .fill(Theme.surface)
                        .strokeBorder(isCurrent ? Theme.accent : .clear, lineWidth: 2)
                )
            }
        }
    }
}
