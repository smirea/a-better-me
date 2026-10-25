import SwiftUI
import WatchKit

/// The workout in three pages: controls, the current set or rest, and stats. It opens on the middle page.
struct WorkoutView: View {
    let snapshot: LiveWorkoutSnapshot

    private enum Page { case controls, main, stats }

    @State private var page = Page.main

    var body: some View {
        TabView(selection: $page) {
            ControlsPage(status: snapshot.status).tag(Page.controls)
            MainPage(snapshot: snapshot).tag(Page.main)
            StatsPage(status: snapshot.status).tag(Page.stats)
        }
        .tabViewStyle(.page)
        .onChange(of: snapshot.status.rest != nil) { page = .main }
        .onDebugAction(.pageControls) { page = .controls }
        .onDebugAction(.pageMain) { page = .main }
        .onDebugAction(.pageStats) { page = .stats }
    }
}

/// The current set, or rest while it runs. Rest ends here as soon as its time is up, before the phone says so.
private struct MainPage: View {
    let snapshot: LiveWorkoutSnapshot
    @State private var showingExercises = false
    @State private var restOver = false

    private var status: LiveWorkoutStatus { snapshot.status }

    var body: some View {
        NavigationStack {
            Group {
                if let rest = status.rest, !restOver {
                    RestView(rest: rest, next: status.current, unit: status.unit)
                } else if let set = status.current {
                    SetView(row: set, snapshot: snapshot)
                } else {
                    AllLoggedView()
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Exercises", systemImage: "list.bullet") { showingExercises = true }
                }
            }
            .sheet(isPresented: $showingExercises) { ExerciseListView(snapshot: snapshot) }
            .onDebugAction(.exercises) { showingExercises.toggle() }
            .watchGlow()
        }
        .task(id: status.rest) {
            restOver = false
            guard let rest = status.rest else { return }
            try? await Task.sleep(for: .seconds(max(0, rest.endsAt.timeIntervalSinceNow)))
            guard !Task.isCancelled else { return }
            restOver = true
            WKInterfaceDevice.current().play(.notification)
        }
    }
}

private struct AllLoggedView: View {
    @State private var confirming = false

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "checkmark.circle.fill").font(.system(size: 34)).foregroundStyle(Theme.accent)
            Text("Every set is logged").font(AppFont.headline(15)).multilineTextAlignment(.center)
            Button("Finish") { confirming = true }
                .buttonStyle(.glassProminent)
                .tint(Theme.accent)
        }
        .confirmationDialog("Finish workout?", isPresented: $confirming) {
            Button("Finish") { WatchModel.shared.send(.finish) }
        }
    }
}

extension View {
    /// MF's watch look: black, with the accent glowing up from the bottom edge.
    func watchGlow() -> some View {
        containerBackground(for: .navigation) {
            ZStack {
                Color.black
                RadialGradient(colors: [Theme.accent.opacity(0.4), .clear], center: .bottom, startRadius: 0, endRadius: 200)
            }
        }
    }
}
