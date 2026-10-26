import SwiftUI

/// The Workout tab: the week strip (or the full calendar), then Active Program, Workout Library, and Your Sections in
/// the order Customize Sections saved.
struct WorkoutTab: View {
    @Observe(WorkoutTemplate.all) private var allTemplates
    @Observe(WorkoutTemplate.library) private var templates
    @Observe(WorkoutTemplate.archived) private var archivedTemplates
    @Observe(Program.library) private var programs
    @Observe(Program.archived) private var archivedPrograms
    @Observe(Program.active) private var activeProgram
    @Environment(SessionHistory.self) private var history
    private var sessions: [WorkoutSession] { history.sessions }
    @Environment(LocalStore.self) private var store
    @Environment(LiveWorkoutPresenter.self) private var presenter
    @Observe(AppSettings.current) private var settings
    @State private var showingCalendar = false
    @State private var creatingWorkout = false
    @State private var creatingProgram = false
    @State private var creatingSection = false
    @State private var libraryCollapsed = false
    @State private var summary: WorkoutSession?
    @State private var path = NavigationPath()

    var body: some View {
        let days = LoggedDays(sessions)
        let progress = activeProgram.map { DayPillProgress(fraction: $0.cycleProgress(finished: sessions), color: $0.color.swatch) }
        NavigationStack(path: $path) {
            Group {
                if showingCalendar {
                    MonthCalendar(days: days, progress: progress, target: { pillTarget($0, days: days) }, onOpen: open)
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 28) {
                            WeekStrip(days: days, progress: progress, target: { pillTarget($0, days: days) }, onOpen: open)
                            ForEach(settings.workout.sections.visible) { section($0) }
                        }
                        .padding(.horizontal, 20)
                        .padding(.bottom)
                    }
                }
            }
            .background(Theme.background)
            .screenTitle("Workout")
            .toolbar { toolbar }
            .navigationDestination(for: WorkoutTemplate.ID.self) { WorkoutDetailView(templateID: $0) }
            .navigationDestination(for: ProgramRoute.self) { ProgramEditorView(programID: $0.programID, initialDayID: $0.dayID) }
            .navigationDestination(for: WorkoutTabRoute.self) { route in
                switch route {
                case .history: WorkoutHistoryView()
                case .archive: ArchiveView()
                case .customizeSections: CustomizeSectionsView()
                }
            }
        }
        .sheet(item: $summary) { WorkoutSummaryView(session: $0) }
        .fullScreenCover(isPresented: $creatingWorkout) {
            CreateWorkoutView { path.append($0.id) }
        }
        .fullScreenCover(isPresented: $creatingProgram) {
            NewProgramWizard()
        }
        .newSectionAlert(isPresented: $creatingSection)
    }

    private func pillTarget(_ day: Date, days: LoggedDays) -> DayPillTarget? {
        DayPillTarget.of(day, session: days.session(on: day), program: activeProgram, now: .now, calendar: LoggedDays.calendar)
    }

    private func open(_ target: DayPillTarget) {
        switch target {
        case let .summary(session): summary = session
        case let .programDay(route): path.append(route)
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
            Menu("Create", systemImage: "plus") {
                Button("New Section", systemImage: "rectangle.split.1x2") { creatingSection = true }
                Button("New Program", systemImage: "point.topleft.down.to.point.bottomright.curvepath") { creatingProgram = true }
                Button("New Workout", systemImage: "dumbbell") { creatingWorkout = true }
            }
        }
        ToolbarSpacer(.fixed)
        ToolbarItem {
            Menu("More", systemImage: "ellipsis") {
                Button("Start Empty Workout", systemImage: "arrow.right.to.line") {
                    presenter.startOrResume({ .empty }, in: store)
                }
                Button("Workout History", systemImage: "list.bullet.rectangle") { path.append(WorkoutTabRoute.history) }
                Button("Customize Sections", systemImage: "rectangle.3.group") { path.append(WorkoutTabRoute.customizeSections) }
                Button { path.append(WorkoutTabRoute.archive) } label: {
                    Label("Archive", systemImage: "archivebox")
                    Text(Self.archiveSummary(programs: archivedPrograms.count, workouts: archivedTemplates.count))
                }
            }
        }
    }

    @ViewBuilder
    private func section(_ section: WorkoutSection) -> some View {
        let byID = Dictionary(allTemplates.map { ($0.id, $0) }) { first, _ in first }
        switch section {
        case .activeProgram:
            ActiveProgramSection(program: activeProgram, templates: byID, finished: sessions)
        case .library:
            library(templates: byID)
        case .yourSections:
            let custom = settings.workout.sections.custom
            if custom.isEmpty {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Your Sections").font(AppFont.title())
                    Label("You haven’t added new sections yet. You can add one by tapping + on this page", systemImage: "rectangle.split.1x2")
                        .font(AppFont.caption())
                        .foregroundStyle(Theme.textSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.cornerRadius))
                }
            } else {
                VStack(alignment: .leading, spacing: 28) {
                    ForEach(custom) { CustomSectionView(section: $0, library: templates) }
                }
            }
        }
    }

    private func library(templates byID: [UUID: WorkoutTemplate]) -> some View {
        let filed = settings.workout.sections.filedTemplateIDs
        let templates = templates.filter { !filed.contains($0.id) }
        let libraryPrograms = programs.filter { $0.id != activeProgram?.id }
        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Workout Library").font(AppFont.title())
                Spacer()
                if !templates.isEmpty || !libraryPrograms.isEmpty {
                    Button(libraryCollapsed ? "Expand" : "Collapse") { withAnimation { libraryCollapsed.toggle() } }
                        .font(AppFont.headline(15))
                        .underline()
                        .foregroundStyle(Theme.textPrimary)
                }
            }
            if templates.isEmpty, libraryPrograms.isEmpty {
                Text("Workouts you create appear here. Tap + to build one.")
                    .font(AppFont.caption())
                    .foregroundStyle(Theme.textSecondary)
            } else if !libraryCollapsed {
                ForEach(templates) { template in
                    NavigationLink(value: template.id) { TemplateCard(template: template) }
                        .buttonStyle(.plain)
                }
                ForEach(libraryPrograms) { program in
                    ProgramCard(program: program, templates: byID, accessory: .chevron)
                }
            }
        }
    }

    /// "1 program, 0 workouts", the ⋮ menu's Archive subtitle.
    static func archiveSummary(programs: Int, workouts: Int) -> String {
        "\(programs) \(programs == 1 ? "program" : "programs"), \(workouts) \(workouts == 1 ? "workout" : "workouts")"
    }
}

/// `navigationDestination(isPresented:)` on this path-driven stack spun the layout forever, so pushed screens are path
/// values.
private enum WorkoutTabRoute: Hashable {
    case history, archive, customizeSections
}
