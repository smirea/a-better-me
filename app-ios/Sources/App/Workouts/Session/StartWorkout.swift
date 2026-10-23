import SwiftUI

extension View {
    /// The at-most-one-session prompt. `LiveWorkoutPresenter.startOrResume` parks a new session in `pendingStart` when
    /// one is already in progress; this asks the owner to resume the current workout or discard it and start the new one.
    func resolvingWorkoutStart() -> some View {
        modifier(ResolveWorkoutStart())
    }
}

private struct ResolveWorkoutStart: ViewModifier {
    @Environment(LiveWorkoutPresenter.self) private var presenter
    @Environment(LocalStore.self) private var store
    @Observe(WorkoutSession.inProgress) private var active

    func body(content: Content) -> some View {
        content.alert(
            "Workout in progress",
            isPresented: Binding { presenter.pendingStart != nil } set: { if !$0 { presenter.pendingStart = nil } }
        ) {
            Button("Resume \(active?.name ?? "Workout")") {
                presenter.pendingStart = nil
                presenter.isExpanded = true
            }
            Button("Discard and Start New", role: .destructive) {
                guard let pending = presenter.pendingStart else { return }
                presenter.pendingStart = nil
                LiveSessionStore.shared.reset()
                presenter.replaceInProgress(with: pending, in: store)
            }
            Button("Cancel", role: .cancel) { presenter.pendingStart = nil }
        } message: {
            Text("Only one workout can be in progress. Resume “\(active?.name ?? "it")”, or discard it to start “\(presenter.pendingStart?.name ?? "the new one")”.")
        }
    }
}
