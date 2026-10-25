import SwiftUI

/// Pause or resume, and end, like the Workout app's controls page. The phone does both, so the watch only asks.
struct ControlsPage: View {
    let status: LiveWorkoutStatus
    @State private var confirmingEnd = false

    var body: some View {
        let paused = status.pausedAt != nil
        NavigationStack {
            VStack(spacing: 10) {
                Text(status.name).font(AppFont.headline(15)).foregroundStyle(Theme.accent).lineLimit(1)
                HStack(spacing: 10) {
                    control(paused ? "Resume" : "Pause", icon: paused ? "play.fill" : "pause.fill", tint: Theme.amber) {
                        WatchModel.shared.send(paused ? .resume : .pause)
                    }
                    control("End", icon: "xmark", tint: Theme.destructive) { confirmingEnd = true }
                }
            }
            .onDebugAction(.pause) { WatchModel.shared.send(.pause) }
            .onDebugAction(.resume) { WatchModel.shared.send(.resume) }
            .onDebugAction(.end) { WatchModel.shared.send(.finish) }
            .confirmationDialog("End workout?", isPresented: $confirmingEnd) {
                Button("End Workout", role: .destructive) { WatchModel.shared.send(.finish) }
            } message: {
                Text("Logged sets are kept. Open sets stay unlogged.")
            }
            .watchGlow()
        }
    }

    private func control(_ title: String, icon: String, tint: Color, action: @escaping () -> Void) -> some View {
        VStack(spacing: 4) {
            Button(action: action) {
                Image(systemName: icon)
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundStyle(tint)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(tint.opacity(0.25), in: RoundedRectangle(cornerRadius: Theme.cornerRadius))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(title)
            Text(title).font(AppFont.caption(12))
        }
    }
}
