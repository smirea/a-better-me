import Feedback
import SwiftUI

/// The Workout tab: the Food Log's header row, then the shown day's workout, Active Program, Workout Library, and Your
/// Sections in the order Customize Sections saved.
struct WorkoutTab: View {
    /// The app's shown day, which the Food Log and the Pings tab share. The body only passes it on, so a day change
    /// re-renders the header and the day's row, not the sections.
    @Binding var day: CalendarDay

    @Observe(WorkoutTemplate.all) private var allTemplates
    @Observe(WorkoutTemplate.library) private var templates
    @Observe(WorkoutTemplate.archived) private var archivedTemplates
    @Observe(Program.library) private var programs
    @Observe(Program.archived) private var archivedPrograms
    @Observe(Program.active) private var activeProgram
    @Environment(SessionHistory.self) private var history
    @Observe(AppSettings.current) private var settings
    @State private var creatingWorkout = false
    @State private var creatingProgram = false
    @State private var creatingSection = false
    @AppStorage("workouts.collapsed.library") private var libraryCollapsed = false
    @State private var summary: WorkoutSession?
    @State private var path = NavigationPath()

    var body: some View {
        let days = history.memo(LoggedDaysKey()) { LoggedDays($0) }
        let finishedDays = activeProgram.map { program in history.memo(program.runCycle) { program.finishedDayIDs($0) } } ?? []
        let progress = activeProgram.map { DayRing(fraction: $0.cycleProgress(finishedDays: finishedDays), color: $0.color.swatch) }
        let templatesByID = Dictionary(allTemplates.map { ($0.id, $0) }) { first, _ in first }
        NavigationStack(path: $path) {
            // Above the scroll view, not in its top safe-area inset: there the strip's `scrollTo(id:)` never landed, and
            // it opened on its last day, a year out.
            VStack(spacing: 0) {
                WorkoutHeader(day: $day, days: days, progress: progress) { menu }
                ScrollView {
                    VStack(alignment: .leading, spacing: 28) {
                        ShownWorkoutDay(day: $day, days: days, program: activeProgram, templates: templatesByID, open: open)
                        ForEach(settings.workout.sections.visible) { section($0, templates: templatesByID, finishedDays: finishedDays) }
                    }
                    .padding(.horizontal, Theme.margin)
                    .padding(.vertical)
                }
            }
            .background(Theme.background)
            // The header row replaces the bar; the title still names the screen for VoiceOver and pushed screens' back button.
            .navigationTitle("Workout")
            .toolbarVisibility(.hidden, for: .navigationBar)
            .navigationDestination(for: WorkoutTemplate.ID.self) { WorkoutDetailView(templateID: $0) }
            .navigationDestination(for: ProgramRoute.self) { ProgramEditorView(programID: $0.programID, initialDayID: $0.dayID) }
            .navigationDestination(for: WorkoutTabRoute.self) { route in
                switch route {
                case .calendar:
                    MonthCalendar(weeks: days.weeks(minimumBack: 26, ahead: 26)) { pill($0, days: days, progress: progress) }
                        .background(Theme.background)
                        .detailTitle("Workout Calendar")
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
        .feedback(self)
    }

    /// A Workout Calendar day: it opens its summary or program day, as the shown day's row does.
    private func pill(_ day: CalendarDay, days: LoggedDays, progress: DayRing?) -> some View {
        let session = days.session(on: day)
        let target = DayPillTarget.of(day.date, session: session, program: activeProgram, now: .now, calendar: Self.calendar)
        return WorkoutDayPill(day: day, isLogged: session != nil, program: progress, hint: target?.hint ?? "") {
            if let target { open(target) }
        }
    }

    /// Program weekdays and "this week" start on Monday, like every day strip.
    fileprivate static let calendar: Calendar = {
        var calendar = Calendar.current
        calendar.firstWeekday = 2
        return calendar
    }()

    private func open(_ target: DayPillTarget) {
        switch target {
        case let .summary(session): summary = session
        case let .programDay(route): path.append(route)
        }
    }

    private var menu: some View {
        Menu {
            // The "+" sheet also creates these, but its shortcuts can be hidden, so the tab keeps a way in.
            Button("New Workout", systemImage: "dumbbell") { creatingWorkout = true }
            Button("New Program", systemImage: "point.topleft.down.to.point.bottomright.curvepath") { creatingProgram = true }
            Button("New Section", systemImage: "rectangle.split.1x2") { creatingSection = true }
            Button("Workout Calendar", systemImage: "calendar") { path.append(WorkoutTabRoute.calendar) }
            Button("Workout History", systemImage: "list.bullet.rectangle") { path.append(WorkoutTabRoute.history) }
            Button("Customize Sections", systemImage: "rectangle.3.group") { path.append(WorkoutTabRoute.customizeSections) }
            Button { path.append(WorkoutTabRoute.archive) } label: {
                Label("Archive", systemImage: "archivebox")
                Text(Self.archiveSummary(programs: archivedPrograms.count, workouts: archivedTemplates.count))
            }
        } label: {
            // Inside the label, so the whole circle opens the menu, not just the glyph.
            Label("Workout Tab Options", systemImage: "ellipsis").labelStyle(.iconOnly).frame(width: 48, height: 48).contentShape(.circle)
        }
    }

    @ViewBuilder
    private func section(_ section: WorkoutSection, templates byID: [UUID: WorkoutTemplate], finishedDays: Set<ProgramDay.ID>) -> some View {
        switch section {
        case .activeProgram:
            ActiveProgramSection(program: activeProgram, templates: byID, finishedDays: finishedDays)
        case .library:
            library(templates: byID)
        case .yourSections:
            // No sections yet draws nothing: Workout Options holds New Section, and Customize Sections explains them.
            let custom = settings.workout.sections.custom
            if !custom.isEmpty {
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
            SectionHeader("Workout Library") {
                if !templates.isEmpty || !libraryPrograms.isEmpty {
                    Button(libraryCollapsed ? "Expand" : "Collapse") { withAnimation { libraryCollapsed.toggle() } }
                }
            }
            if templates.isEmpty, libraryPrograms.isEmpty {
                Text("Workouts you create appear here. Tap + to build one.")
                    .font(AppFont.rowDetail)
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
        .feedback("Workout Library", data: (templates: templates.count, programs: libraryPrograms.count, collapsed: libraryCollapsed))
    }

    /// "1 program, 0 workouts", the ⋮ menu's Archive subtitle.
    static func archiveSummary(programs: Int, workouts: Int) -> String {
        "\(programs) \(programs == 1 ? "program" : "programs"), \(workouts) \(workouts == 1 ? "workout" : "workouts")"
    }
}

/// `navigationDestination(isPresented:)` on this path-driven stack spun the layout forever, so pushed screens are path
/// values.
private enum WorkoutTabRoute: Hashable {
    case calendar, history, archive, customizeSections
}

private struct LoggedDaysKey: Hashable {}

/// Calendar, the day strip, and the ⋯ menu, as on the Food Log and Pings. A pill's ring is the active program's cycle
/// on today and a full amber outline on any other logged day.
private struct WorkoutHeader<Options: View>: View {
    @Binding var day: CalendarDay
    let days: LoggedDays
    let progress: DayRing?
    @ViewBuilder let options: Options

    var body: some View {
        DayHeaderRow(day: $day) {
            DayStrip(selected: day) { shown in
                WorkoutDayPill(day: shown, isLogged: days.session(on: shown) != nil, program: progress, isSelected: shown == day) {
                    day = shown
                }
            }
        } menu: {
            options
        }
        .padding(.bottom, 6)
        .background(Theme.background)
        .feedback("WorkoutHeader")
    }
}

/// The shown day's workout: a logged day's last session opens its summary, and an unlogged day of this week opens the
/// program day it trains on (`DayPillTarget.of`), so a pill's tap selects the day without losing either.
private struct ShownWorkoutDay: View {
    @Binding var day: CalendarDay
    let days: LoggedDays
    let program: Program?
    let templates: [UUID: WorkoutTemplate]
    let open: (DayPillTarget) -> Void

    var body: some View {
        let target = DayPillTarget.of(day.date, session: days.session(on: day), program: program, now: .now, calendar: WorkoutTab.calendar)
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(NutritionFormat.dayTitle(day))
            switch target {
            case let .summary(session):
                Button { open(.summary(session)) } label: { SessionRow(session: session).card() }
                    .buttonStyle(.plain)
            case let .programDay(route):
                Button { open(.programDay(route)) } label: {
                    HStack {
                        if let program, let dayID = route.dayID,
                           let template = program.days.first(where: { $0.id == dayID })?.templateID.flatMap({ templates[$0] }) {
                            TemplateSummary(template: template, day: (program, dayID))
                        } else {
                            Text("Program Day").font(AppFont.headline()).frame(maxWidth: .infinity, alignment: .leading)
                        }
                        Image(systemName: "chevron.right").foregroundStyle(Theme.textTertiary)
                    }
                    .card()
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityHint("Opens the program day")
            case nil:
                Text(day < .today ? "No workout logged" : "No workout planned")
                    .font(AppFont.rowDetail)
                    .foregroundStyle(Theme.textSecondary)
            }
        }
        .feedback("Shown Day", data: day.description)
    }
}
