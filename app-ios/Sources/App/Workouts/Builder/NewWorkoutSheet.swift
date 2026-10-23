import SwiftUI

/// Presented by the tab bar's "+" button. The reference's Shortcuts sheet, cut to Empty Workout and New Workout: its
/// Weight, Photos, Metrics, and History shortcuts belong to the nutrition half, and Up Next and New Program to programs.
struct NewWorkoutSheet: View {
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(LiveWorkoutPresenter.self) private var presenter
    @State private var creating = false
    @State private var startingEmpty = false

    var body: some View {
        NavigationStack {
            List {
                Button {
                    startingEmpty = true
                    dismiss()
                } label: {
                    Label("Empty Workout", systemImage: "arrow.right.to.line")
                }
                Button { creating = true } label: {
                    Label("New Workout", systemImage: "dumbbell")
                }
            }
            .font(AppFont.headline())
            .foregroundStyle(Theme.textPrimary)
            .navigationTitle("Shortcuts")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
        }
        .tint(Theme.textPrimary)
        .onDisappear {
            // The root view can't present the live workout's cover while this sheet is still on screen.
            if startingEmpty { presenter.startOrResume({ .empty }, in: store) }
        }
        .presentationDetents([.height(240)])
        .fullScreenCover(isPresented: $creating) {
            CreateWorkoutView { _ in dismiss() }
        }
    }
}

extension WorkoutSession {
    /// "Empty" is the reference's name for a workout started without a template.
    static var empty: WorkoutSession { WorkoutSession(name: "Empty") }
}
