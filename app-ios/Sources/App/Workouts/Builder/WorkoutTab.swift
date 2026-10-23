import SwiftData
import SwiftUI

/// The Workout tab: the week strip (or the full calendar) and the Workout Library. The reference's Active Program,
/// Your Sections, Archive, and Customize Sections wait for programs.
struct WorkoutTab: View {
    @Query(sort: \WorkoutTemplate.createdAt) private var templates: [WorkoutTemplate]
    @Query(filter: #Predicate<WorkoutSession> { $0.endedAt != nil }, sort: \WorkoutSession.startedAt)
    private var sessions: [WorkoutSession]
    @Environment(\.modelContext) private var context
    @Environment(LiveWorkoutPresenter.self) private var presenter
    @State private var showingCalendar = false
    @State private var creating = false
    @State private var libraryCollapsed = false
    @State private var summary: WorkoutSession?
    @State private var path = NavigationPath()

    var body: some View {
        let days = LoggedDays(sessions)
        NavigationStack(path: $path) {
            Group {
                if showingCalendar {
                    MonthCalendar(days: days) { summary = $0 }
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 28) {
                            WeekStrip(days: days) { summary = $0 }
                            library
                        }
                        .padding(.horizontal)
                        .padding(.bottom)
                    }
                }
            }
            .background(Theme.background)
            .screenTitle("Workout")
            .toolbar { toolbar }
            .navigationDestination(for: WorkoutTemplate.self) { WorkoutDetailView(template: $0) }
            .navigationDestination(for: WorkoutHistoryRoute.self) { _ in WorkoutHistoryView() }
        }
        .tint(Theme.textPrimary)
        .sheet(item: $summary) { WorkoutSummaryView(session: $0) }
        .fullScreenCover(isPresented: $creating) {
            CreateWorkoutView { path.append($0) }
        }
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem {
            Toggle("Calendar", systemImage: "calendar", isOn: $showingCalendar.animation())
                .toggleStyle(.button)
        }
        ToolbarSpacer(.fixed)
        ToolbarItem {
            Button("New Workout", systemImage: "plus") { creating = true }
        }
        ToolbarSpacer(.fixed)
        ToolbarItem {
            Menu("More", systemImage: "ellipsis") {
                Button("Start Empty Workout", systemImage: "arrow.right.to.line") {
                    presenter.startOrResume({ .empty }, in: context)
                }
                Button("Workout History", systemImage: "list.bullet.rectangle") { path.append(WorkoutHistoryRoute()) }
            }
        }
    }

    private var library: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Workout Library").font(AppFont.title())
                Spacer()
                if !templates.isEmpty {
                    Button(libraryCollapsed ? "Expand" : "Collapse") { withAnimation { libraryCollapsed.toggle() } }
                        .font(AppFont.headline(15))
                        .underline()
                        .foregroundStyle(Theme.textPrimary)
                }
            }
            if templates.isEmpty {
                Text("Workouts you create appear here. Tap + to build one.")
                    .font(AppFont.caption())
                    .foregroundStyle(Theme.textSecondary)
            } else if !libraryCollapsed {
                ForEach(templates) { template in
                    NavigationLink(value: template) { TemplateCard(template: template) }
                        .buttonStyle(.plain)
                }
            }
        }
    }
}

/// `navigationDestination(isPresented:)` on this path-driven stack spun the layout forever, so history is a path value.
private struct WorkoutHistoryRoute: Hashable {}

private struct TemplateCard: View {
    let template: WorkoutTemplate
    @Environment(ExerciseCatalog.self) private var catalog

    var body: some View {
        let items = template.blocks.flatMap(\.exercises)
        let exercises = items.compactMap { catalog.exercise($0.exerciseID) }
        let primary = Set(exercises.flatMap(\.primaryMuscles))
        let secondary = Set(exercises.flatMap(\.secondaryMuscles)).subtracting(primary)
        HStack {
            VStack(alignment: .leading, spacing: 6) {
                Text(template.name).font(AppFont.headline())
                if !items.isEmpty {
                    Text(items.map { catalog.name($0.exerciseID) }.joined(separator: ", "))
                        .font(AppFont.caption())
                        .foregroundStyle(Theme.textSecondary)
                        .lineLimit(2)
                }
                MuscleTags(primary: primary.sorted { $0.displayName < $1.displayName }, secondary: secondary.sorted { $0.displayName < $1.displayName })
            }
            Spacer()
            Image(systemName: "chevron.right").foregroundStyle(Theme.textTertiary)
        }
        .padding()
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.cornerRadius))
        .contentShape(Rectangle())
    }
}
