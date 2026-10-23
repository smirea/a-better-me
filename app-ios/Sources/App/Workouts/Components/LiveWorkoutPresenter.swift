import SwiftData
import SwiftUI

/// Whether the in-progress workout fills the screen. The builder starts workouts, the live session minimizes and
/// finishes them, and the root view presents them, so this one value in the environment is all they share.
@MainActor @Observable
final class LiveWorkoutPresenter {
    var isExpanded = false
    /// A session asked to start while another is in progress. The root view asks the owner to resume the current one
    /// or discard it and start this one.
    var pendingStart: WorkoutSession?

    /// Starts `session` and shows it. At most one session is in progress, so callers resolve an existing one first
    /// (the live session thread owns that prompt).
    func start(_ session: WorkoutSession, in context: ModelContext) {
        context.insert(session)
        isExpanded = true
    }
}
