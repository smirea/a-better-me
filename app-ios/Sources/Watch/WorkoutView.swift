import SwiftUI
import WatchKit

/// The workout in three pages, like the Workout app: controls, the current set or rest, and stats. It opens on the
/// middle page and comes back to it whenever a rest starts or ends.
struct WorkoutView: View {
    let workout: WatchWorkout

    private enum Page { case controls, main, stats }

    @State private var page = Page.main
    @State private var showingExercises = false

    var body: some View {
        TabView(selection: $page) {
            ControlsPage(workout: workout, showingExercises: $showingExercises) { page = .main }.tag(Page.controls)
            MainPage(workout: workout, showingExercises: $showingExercises).tag(Page.main)
            StatsPage(workout: workout).tag(Page.stats)
        }
        .tabViewStyle(.page)
        .onChange(of: workout.rest) { page = .main }
        .sheet(isPresented: $showingExercises) { ExerciseListView(workout: workout) }
    }
}

/// The current set, or rest while it runs. The rest ends here on its own time, with a tap on the wrist.
private struct MainPage: View {
    let workout: WatchWorkout
    @Binding var showingExercises: Bool
    @State private var restOver = false

    var body: some View {
        NavigationStack {
            Group {
                if workout.pausedAt != nil {
                    PausedView(workout: workout)
                } else if let rest = workout.rest, !restOver {
                    RestView(workout: workout, rest: rest)
                } else if let path = workout.currentRow {
                    SetView(workout: workout, path: path) { showingExercises = true }
                } else {
                    AllLoggedView()
                }
            }
            .watchGlow(workout.rest != nil && !restOver ? Theme.lavender : Theme.accent)
        }
        .task(id: workout.rest) {
            restOver = false
            guard let rest = workout.rest else { return }
            let left = rest.endsAt.timeIntervalSinceNow
            if left > 10 {
                try? await Task.sleep(for: .seconds(left - 10))
                guard !Task.isCancelled else { return }
                WKInterfaceDevice.current().play(.click)
            }
            try? await Task.sleep(for: .seconds(max(0, rest.endsAt.timeIntervalSinceNow)))
            guard !Task.isCancelled else { return }
            restOver = true
            WKInterfaceDevice.current().play(.notification)
        }
    }
}

private struct PausedView: View {
    let workout: WatchWorkout

    var body: some View {
        VStack(spacing: 8) {
            Text("PAUSED").font(AppFont.display(13)).foregroundStyle(Theme.amber)
            WorkoutClock(workout: workout, size: 34)
            Button {
                WatchModel.shared.act(.resume)
            } label: {
                Label("Resume", systemImage: "play.fill").font(AppFont.headline(16)).frame(maxWidth: .infinity)
            }
            .buttonStyle(.glassProminent)
            .tint(Theme.amber)
        }
    }
}

private struct AllLoggedView: View {
    @State private var confirming = false

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "checkmark.seal.fill").font(.system(size: 36)).foregroundStyle(Theme.green)
            Text("Every set is logged").font(AppFont.headline(15)).multilineTextAlignment(.center)
            Button {
                confirming = true
            } label: {
                Label("Finish", systemImage: "flag.checkered").font(AppFont.headline(16)).frame(maxWidth: .infinity)
            }
            .buttonStyle(.glassProminent)
            .tint(Theme.accent)
        }
        .confirmationDialog("Finish workout?", isPresented: $confirming) {
            Button("Finish") { WatchModel.shared.act(.finish) }
        }
    }
}

/// The workout clock, frozen while paused.
struct WorkoutClock: View {
    let workout: WatchWorkout
    var size: CGFloat = 15

    var body: some View {
        Text(timerInterval: workout.pauseAdjustedStart...Date.distantFuture, pauseTime: workout.pausedAt, countsDown: false, showsHours: true)
            .font(AppFont.number(size))
            .monospacedDigit()
            .accessibilityLabel("Elapsed time")
    }
}
