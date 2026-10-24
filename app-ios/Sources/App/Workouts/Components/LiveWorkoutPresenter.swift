import GRDB
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
    func start(_ session: WorkoutSession, in store: LocalStore) {
        store.insert(session)
        isExpanded = true
    }

    /// "Discard and Start New": every unfinished session goes, in the same transaction as the insert, since two devices
    /// that started workouts offline can both have one.
    func replaceInProgress(with session: WorkoutSession, in store: LocalStore) {
        store.write { db in
            let session = try session.atStartingGym(db)
            _ = try WorkoutSession.filter(Column("ended_at") == nil).deleteAll(db)
            try session.insert(db)
        }
        isExpanded = true
    }

    /// Only one session is in progress at a time. When one is, the root view's prompt (`resolvingWorkoutStart`) lets the
    /// owner resume it or discard it and start the new one. The check and the insert share one transaction, so two
    /// quick taps cannot start two.
    func startOrResume(_ makeSession: () -> WorkoutSession, in store: LocalStore) {
        let session = makeSession()
        let started = store.write { db in
            let session = try session.atStartingGym(db)
            guard try WorkoutSession.inProgress.fetch(db) == nil else { return (false, session) }
            try session.insert(db)
            return (true, session)
        }
        Task {
            let (didStart, session) = try await started.value
            if didStart { isExpanded = true } else { pendingStart = session }
        }
    }
}
