import SwiftData
import SwiftUI

extension View {
    /// Starts the session put in `pending`. At most one workout is in progress, so when one already is the owner picks:
    /// resume it, or discard it and start the new one. Every "Start Workout" goes through this.
    func startingWorkout(_ pending: Binding<WorkoutSession?>) -> some View {
        modifier(StartWorkoutModifier(pending: pending))
    }
}

private struct StartWorkoutModifier: ViewModifier {
    @Binding var pending: WorkoutSession?
    @Environment(LiveWorkoutPresenter.self) private var presenter
    @Environment(\.modelContext) private var context
    @Query(filter: #Predicate<WorkoutSession> { $0.endedAt == nil }) private var active: [WorkoutSession]

    func body(content: Content) -> some View {
        content
            .onChange(of: pending?.id) {
                guard let pending, active.isEmpty else { return }
                start(pending)
            }
            .alert(
                "Workout in progress",
                isPresented: Binding { pending != nil && !active.isEmpty } set: { if !$0 { pending = nil } }
            ) {
                Button("Resume \(active.first?.name ?? "Workout")") {
                    pending = nil
                    presenter.isExpanded = true
                }
                Button("Discard and Start New", role: .destructive) {
                    active.forEach(context.delete)
                    LiveSessionStore.shared.reset()
                    if let pending { start(pending) }
                }
                Button("Cancel", role: .cancel) { pending = nil }
            } message: {
                Text("Only one workout can be in progress. Resume it, or discard it to start \(pending?.name ?? "the new one").")
            }
    }

    private func start(_ session: WorkoutSession) {
        pending = nil
        presenter.start(session, in: context)
    }
}
