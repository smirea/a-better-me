import SwiftUI

/// "Workout Complete" right after finishing, or a past session's summary from history and the calendar.
/// `isFinishing` adds the bottom bar with Update Workout Plan and Done.
struct WorkoutSummaryView: View {
    let session: WorkoutSession
    var isFinishing = false

    var body: some View { ComingSoon(title: "Workout Complete") }
}
