import SwiftUI

/// The workouts the watch can start: the program's next workout, then the library, as the phone last sent them.
struct HomeView: View {
    private var model: WatchModel { .shared }

    var body: some View {
        NavigationStack {
            List {
                if let home = model.home, !home.workouts.isEmpty {
                    let upNext = home.workouts.filter { $0.program != nil }
                    let library = home.workouts.filter { $0.program == nil }
                    if !upNext.isEmpty {
                        Section("Up Next") { ForEach(upNext, content: row) }
                    }
                    if !library.isEmpty {
                        Section("Library") { ForEach(library, content: row) }
                    }
                } else {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(model.home == nil ? "Open A Better Me on your iPhone" : "No workouts yet")
                            .font(AppFont.headline(15))
                        Text(model.home == nil ? "Your workouts show up here once the phone app has run." : "Create a workout on your iPhone to start it here.")
                            .font(AppFont.caption(12))
                            .foregroundStyle(Theme.textSecondary)
                    }
                    .listRowBackground(Color.clear)
                }
            }
            .navigationTitle("Workouts")
            .watchGlow()
            .onDebugAction(.start) { if let first = model.home?.workouts.first { model.start(first) } }
        }
    }

    private func row(_ option: WatchWorkoutOption) -> some View {
        NavigationLink {
            WorkoutPreview(option: option)
        } label: {
            VStack(alignment: .leading, spacing: 2) {
                Text(option.name).font(AppFont.headline(16)).foregroundStyle(Theme.accent)
                Text(option.program ?? "\(option.exercises.count) exercises · \(option.totalSets) sets")
                    .font(AppFont.caption(12))
                    .foregroundStyle(Theme.textSecondary)
                    .lineLimit(1)
            }
            .padding(.vertical, 4)
        }
        .accessibilityLabel(option.name)
    }
}

/// A workout's exercises before starting it, like MF's "review upcoming exercises".
private struct WorkoutPreview: View {
    let option: WatchWorkoutOption
    private var model: WatchModel { .shared }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                Text(option.name).font(AppFont.title(18)).foregroundStyle(Theme.accent)
                if let program = option.program {
                    Text(program).font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
                }
                ForEach(Array(option.exercises.enumerated()), id: \.offset) { _, name in
                    Text(name)
                        .font(AppFont.medium(14))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            Button {
                model.start(option)
            } label: {
                if model.startingTemplate == option.id {
                    ProgressView()
                } else {
                    Label("Start", systemImage: "play.fill").font(AppFont.headline(16))
                }
            }
            .buttonStyle(.glassProminent)
            .tint(Theme.accent)
            .disabled(model.startingTemplate != nil)
            .accessibilityLabel("Start \(option.name)")
        }
        .watchGlow()
    }
}
