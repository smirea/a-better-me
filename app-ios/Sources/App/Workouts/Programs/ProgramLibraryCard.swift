import Feedback
import SwiftUI

/// Opens the program editor, on a day when `dayID` is set. Every stack that shows program cards registers it.
struct ProgramRoute: Hashable {
    var programID: Program.ID
    var dayID: ProgramDay.ID?
}

extension ProgramColor {
    /// MF's program palette, sampled from its color step (`new-program-04-color-step.jpg`).
    var swatch: Color {
        switch self {
        case .red: Color(hex: 0xE5484D)
        case .orange: Color(hex: 0xEE7142)
        case .yellow: Color(hex: 0xF2AE35)
        case .green: Color(hex: 0x5C8F65)
        case .teal: Color(hex: 0x2F8996)
        case .blue: Color(hex: 0x356AE6)
        case .purple: Color(hex: 0x8A5CF0)
        }
    }

    var title: String { rawValue.capitalized }
}

/// The rounded icon tile in the program color.
struct ProgramIconTile: View {
    let program: Program
    var size: CGFloat = 44

    var body: some View {
        Image(systemName: program.icon)
            .font(.system(size: size * 0.42, weight: .semibold))
            .foregroundStyle(Theme.background)
            .frame(width: size, height: size)
            .background(program.color.swatch, in: RoundedRectangle(cornerRadius: size * 0.22))
    }
}

/// What a workout row says about its plan: how many exercises and working sets, and the sets each muscle gets for the
/// body map (secondary muscles count half, as on Workout Complete).
struct WorkoutOverview {
    let exercises: Int
    let sets: Int
    let muscleSets: [Muscle: Double]

    init(blocks: [WorkoutBlock], catalog: (ExerciseID) -> Exercise?) {
        let items = blocks.flatMap(\.exercises)
        exercises = items.count
        sets = items.reduce(0) { total, item in total + item.sets.count { $0.type != .warmUp } }
        muscleSets = WorkoutMetrics.muscleSets(in: blocks, catalog: catalog, loggedOnly: false)
    }

    /// "6 exercises · 18 sets".
    var line: String {
        guard exercises > 0 else { return "No exercises" }
        return "\(exercises) \(exercises == 1 ? "exercise" : "exercises") · \(sets) \(sets == 1 ? "set" : "sets")"
    }

    /// Finished sessions, all time, keyed both by the template they started from and by the program day they filed
    /// under. A program day row looks up its day id, because two days of one program can share a template; a library
    /// row looks up its template id.
    static func completions(in finished: [WorkoutSession]) -> [UUID: Int] {
        var counts: [UUID: Int] = [:]
        for session in finished where session.endedAt != nil {
            if let templateID = session.templateID { counts[templateID, default: 0] += 1 }
            if let dayID = session.program?.dayID { counts[dayID, default: 0] += 1 }
        }
        return counts
    }
}

private struct TemplateCompletionsKey: Hashable {}

/// The front and back figures at row size, each muscle tinted by its planned sets.
struct BodyThumbnail: View {
    let muscleSets: [Muscle: Double]

    static let size = CGSize(width: 54, height: 56)

    var body: some View {
        HStack(spacing: 2) {
            BodyMap(values: muscleSets, side: .front, fullAt: 4)
            BodyMap(values: muscleSets, side: .back, fullAt: 4)
        }
        .frame(width: Self.size.width, height: Self.size.height)
    }
}

/// A workout's body map, its name with a faint all-time "N completed", and "N exercises · M sets": the body of library
/// rows, program day rows, and the Up Next card. A program day row passes `day`: it then shows the program's current
/// cycle and counts that day's sessions instead of the template's.
struct TemplateSummary: View {
    let template: WorkoutTemplate
    var title: String?
    var day: (program: Program, id: ProgramDay.ID)?
    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(SessionHistory.self) private var history
    @State private var overviews = ViewMemo<OverviewKey, WorkoutOverview>()

    private struct OverviewKey: Equatable {
        let blocks: [WorkoutBlock]
        let program: Program?
        let catalogRevision: Int
    }

    var body: some View {
        let overview = overviews(OverviewKey(blocks: template.blocks, program: day?.program, catalogRevision: catalog.revision)) {
            let blocks = day.map { $0.program.blocks(of: template, cycle: $0.program.currentCycle) } ?? template.blocks
            return WorkoutOverview(blocks: blocks, catalog: catalog.exercise)
        }
        let completed = history.memo(TemplateCompletionsKey()) { WorkoutOverview.completions(in: $0) }[day?.id ?? template.id] ?? 0
        HStack(spacing: 12) {
            BodyThumbnail(muscleSets: overview.muscleSets)
            VStack(alignment: .leading, spacing: 4) {
                Text("\(Text(title ?? template.name).font(AppFont.headline()))  \(Text("\(completed) completed").font(AppFont.rowDetail).foregroundStyle(Theme.textTertiary))")
                Text(overview.line)
                    .font(AppFont.rowDetail)
                    .foregroundStyle(Theme.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// What a day row shows on its right: a chevron in the library and archive, a checkbox in the Active Program.
enum ProgramDayAccessory {
    case chevron
    case checkbox(finishedDays: Set<ProgramDay.ID>, tickRest: (ProgramDay, Bool) -> Void)
}

/// A program as the Workout tab, the Archive, and the library draw it: the icon tile, name, "N workouts", a collapse
/// chevron, and one row per day in order, rest days included.
struct ProgramCard: View {
    let program: Program
    let templates: [UUID: WorkoutTemplate]
    let accessory: ProgramDayAccessory
    @AppStorage private var collapsed: Bool

    init(program: Program, templates: [UUID: WorkoutTemplate], accessory: ProgramDayAccessory) {
        self.program = program
        self.templates = templates
        self.accessory = accessory
        _collapsed = AppStorage(wrappedValue: false, "workouts.collapsed.program.\(program.id.uuidString)")
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            if !collapsed {
                ForEach(program.days) { day in
                    Divider().overlay(Theme.separator)
                    row(day)
                }
            }
        }
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.cornerRadius))
        .feedback(self)
    }

    private var header: some View {
        HStack(spacing: 12) {
            NavigationLink(value: ProgramRoute(programID: program.id)) {
                HStack(spacing: 12) {
                    ProgramIconTile(program: program)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(program.name).font(AppFont.headline())
                        Text(workoutCount).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
                    }
                    Spacer(minLength: 0)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            Button(collapsed ? "Expand \(program.name)" : "Collapse \(program.name)", systemImage: collapsed ? "chevron.down" : "chevron.up") {
                withAnimation { collapsed.toggle() }
            }
            .labelStyle(.iconOnly)
            .font(AppFont.headline(15))
            .foregroundStyle(Theme.textPrimary)
            .frame(width: 32, height: 32)
            .buttonStyle(.plain)
        }
        .padding()
    }

    private var workoutCount: String {
        let count = program.workoutDays.count
        return count == 1 ? "1 workout" : "\(count) workouts"
    }

    @ViewBuilder
    private func row(_ day: ProgramDay) -> some View {
        let done: Bool = if case let .checkbox(finishedDays, _) = accessory { program.isDone(day, finishedDays: finishedDays) } else { false }
        Group {
            if let templateID = day.templateID {
                NavigationLink(value: ProgramRoute(programID: program.id, dayID: day.id)) {
                    HStack(spacing: 12) {
                        if let template = templates[templateID] {
                            TemplateSummary(template: template, day: (program, day.id))
                        } else {
                            Text("Workout").font(AppFont.headline()).frame(maxWidth: .infinity, alignment: .leading)
                        }
                        trailing(day, done: done)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            } else {
                HStack(spacing: 12) {
                    Image(systemName: "bed.double")
                        .font(.system(size: 20))
                        .foregroundStyle(Theme.textTertiary)
                        .frame(width: BodyThumbnail.size.width)
                    Text("Rest Day").font(AppFont.headline()).frame(maxWidth: .infinity, alignment: .leading)
                    trailing(day, done: done)
                }
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 14)
        .opacity(done ? 0.4 : 1)
    }

    @ViewBuilder
    private func trailing(_ day: ProgramDay, done: Bool) -> some View {
        switch accessory {
        case .chevron:
            if day.templateID != nil { Image(systemName: "chevron.right").foregroundStyle(Theme.textTertiary) }
        case let .checkbox(_, tickRest):
            if day.templateID == nil {
                Button(done ? "Untick rest day" : "Tick rest day", systemImage: done ? "checkmark.square.fill" : "square") {
                    tickRest(day, !done)
                }
                .labelStyle(.iconOnly)
                .font(.system(size: 20))
                .foregroundStyle(Theme.textSecondary)
                .buttonStyle(.plain)
            } else {
                Image(systemName: done ? "checkmark.square.fill" : "square")
                    .font(.system(size: 20))
                    .foregroundStyle(Theme.textSecondary)
                    .accessibilityLabel(done ? "Done" : "Not done")
            }
        }
    }
}

/// A standalone workout in the library row style: its summary and a chevron.
struct TemplateCard: View {
    let template: WorkoutTemplate

    var body: some View {
        HStack {
            TemplateSummary(template: template)
            Image(systemName: "chevron.right").foregroundStyle(Theme.textTertiary)
        }
        .card()
        .contentShape(Rectangle())
        .feedback(self)
    }
}
