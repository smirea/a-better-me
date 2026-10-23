import SwiftUI

/// The full-screen live workout. The root view presents it over the tab bar while `LiveWorkoutPresenter.isExpanded`.
struct LiveWorkoutView: View {
    let session: WorkoutSession

    var body: some View { ComingSoon(title: session.name) }
}
