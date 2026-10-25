import SwiftUI

/// The Workout app's controls page: pause or resume, end, undo the last set, add a set, and the exercise list.
struct ControlsPage: View {
    let workout: WatchWorkout
    @Binding var showingExercises: Bool
    let done: () -> Void
    @State private var confirmingEnd = false

    private var model: WatchModel { .shared }

    var body: some View {
        let paused = workout.pausedAt != nil
        NavigationStack {
            VStack(spacing: 6) {
                Button {
                    showingExercises = true
                } label: {
                    HStack(spacing: 6) {
                        VStack(alignment: .leading, spacing: 0) {
                            Text(workout.name).font(AppFont.headline(14)).foregroundStyle(Theme.accent).lineLimit(1)
                            WorkoutClock(workout: workout, size: 13).foregroundStyle(Theme.textSecondary)
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "list.bullet").font(.system(size: 15, weight: .semibold))
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Exercises")
                Grid(horizontalSpacing: 6, verticalSpacing: 6) {
                    GridRow {
                        control(paused ? "Resume" : "Pause", icon: paused ? "play.fill" : "pause.fill", tint: Theme.amber) {
                            model.act(paused ? .resume : .pause)
                            done()
                        }
                        control("End", icon: "xmark", tint: Theme.destructive) { confirmingEnd = true }
                    }
                    GridRow {
                        control("Undo Set", icon: "arrow.uturn.backward", tint: Theme.lavender, disabled: model.lastLoggedRow == nil) {
                            if let row = model.lastLoggedRow { model.act(.unlog(rowID: row)) }
                            done()
                        }
                        control("Add Set", icon: "plus", tint: Theme.green, disabled: addSetExercise == nil) {
                            if let exercise = addSetExercise { model.act(.addSet(exerciseID: exercise, setID: UUID())) }
                            done()
                        }
                    }
                }
            }
            .confirmationDialog("End workout?", isPresented: $confirmingEnd) {
                Button("Finish & Save") { model.act(.finish) }
                Button("Discard", role: .destructive) { model.act(.discard) }
            } message: {
                Text("Finishing keeps the logged sets. Discarding deletes the workout.")
            }
            .watchGlow()
        }
    }

    /// The exercise a new set goes to: the one on screen, else the last one logged.
    private var addSetExercise: BlockExercise.ID? {
        if let path = workout.currentRow { return workout.blocks[path.block].exercises[path.exercise].id }
        return workout.current ?? workout.blocks.last?.exercises.last?.id
    }

    private func control(_ title: String, icon: String, tint: Color, disabled: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 2) {
                Image(systemName: icon).font(.system(size: 19, weight: .semibold)).foregroundStyle(tint)
                Text(title).font(AppFont.medium(11)).foregroundStyle(Theme.textPrimary)
            }
            .frame(maxWidth: .infinity, minHeight: 50)
            .background(tint.opacity(0.2), in: RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .opacity(disabled ? 0.4 : 1)
        .accessibilityLabel(title)
    }
}
