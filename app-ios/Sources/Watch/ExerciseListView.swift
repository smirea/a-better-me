import SwiftUI

/// The workout's exercises by block, with supersets grouped; tapping one moves to it.
struct ExerciseListView: View {
    let workout: WatchWorkout
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let current = workout.currentRow.map { workout.blocks[$0.block].exercises[$0.exercise].id }
        List {
            VStack(alignment: .leading, spacing: 1) {
                Text(workout.name).font(AppFont.headline(16)).foregroundStyle(Theme.accent)
                WorkoutClock(workout: workout, size: 17)
                Text("\(workout.completedSets) of \(workout.totalSets) sets").font(AppFont.caption(11)).foregroundStyle(Theme.textSecondary)
            }
            .listRowBackground(Color.clear)
            ForEach(Array(workout.blocks.enumerated()), id: \.element.id) { _, block in
                Section {
                    ForEach(Array(block.exercises.enumerated()), id: \.element.id) { index, item in
                        row(item, member: block.isSuperset ? index : nil, isCurrent: item.id == current)
                    }
                } header: {
                    if block.isSuperset {
                        Label(block.exercises.count > 2 ? "Circuit" : "Superset", systemImage: "repeat")
                            .font(AppFont.headline(11))
                            .foregroundStyle(Theme.lavender)
                    }
                }
            }
        }
    }

    private func row(_ item: BlockExercise, member: Int?, isCurrent: Bool) -> some View {
        let done = item.sets.count(where: \.isDone)
        return Button {
            WatchModel.shared.act(.select(exerciseID: item.id))
            dismiss()
        } label: {
            HStack(spacing: 8) {
                if let member { MemberBadge(member: member) }
                VStack(alignment: .leading, spacing: 1) {
                    Text(workout.exercise(item.exerciseID).name).font(AppFont.medium(14)).lineLimit(2)
                    Text("\(done) of \(item.sets.count) sets")
                        .font(AppFont.caption(11))
                        .foregroundStyle(item.isDone ? Theme.green : Theme.textSecondary)
                }
                Spacer(minLength: 0)
                if item.isDone { Image(systemName: "checkmark.circle.fill").foregroundStyle(Theme.green) }
            }
            .padding(.vertical, 2)
        }
        .listRowBackground(
            RoundedRectangle(cornerRadius: Theme.smallCornerRadius)
                .fill(Theme.surface)
                .strokeBorder(isCurrent ? Theme.accent : .clear, lineWidth: 2)
        )
        .accessibilityLabel(workout.exercise(item.exerciseID).name)
    }
}
