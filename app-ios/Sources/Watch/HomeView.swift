import SwiftUI

/// The workouts the watch can start, with or without the phone: the program's next workout, then the library, as the
/// phone last sent them.
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
        List {
            VStack(alignment: .leading, spacing: 2) {
                Text(option.name).font(AppFont.title(18)).foregroundStyle(Theme.accent)
                Text(option.program ?? "\(option.totalSets) sets").font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
            }
            .listRowBackground(Color.clear)
            if let plan = option.plan {
                ForEach(plan.blocks) { block in
                    ForEach(Array(block.exercises.enumerated()), id: \.element.id) { index, item in
                        HStack(spacing: 8) {
                            if block.isSuperset { MemberBadge(member: index) }
                            VStack(alignment: .leading, spacing: 1) {
                                Text(plan.exercise(item.exerciseID).name).font(AppFont.medium(14)).lineLimit(2)
                                Text("\(item.sets.count) sets").font(AppFont.caption(11)).foregroundStyle(Theme.textSecondary)
                            }
                        }
                    }
                }
            } else {
                ForEach(Array(option.exercises.enumerated()), id: \.offset) { _, name in
                    Text(name).font(AppFont.medium(14))
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .bottomBar) {
                Button {
                    model.start(option)
                } label: {
                    Label("Start", systemImage: "play.fill").font(AppFont.headline(16)).frame(maxWidth: .infinity)
                }
                .buttonStyle(.glassProminent)
                .tint(Theme.accent)
                .disabled(option.plan == nil)
                .accessibilityLabel("Start \(option.name)")
            }
        }
        .watchGlow()
    }
}
