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

/// A workout's name, its exercises on two lines, and its muscle tags: the body of library rows, program day rows, and
/// the Up Next card.
struct TemplateSummary: View {
    let template: WorkoutTemplate
    var title: String?
    @Environment(ExerciseCatalog.self) private var catalog

    var body: some View {
        let items = template.blocks.flatMap(\.exercises)
        let exercises = items.compactMap { catalog.exercise($0.exerciseID) }
        let primary = Set(exercises.flatMap(\.primaryMuscles))
        let secondary = Set(exercises.flatMap(\.secondaryMuscles)).subtracting(primary)
        VStack(alignment: .leading, spacing: 6) {
            Text(title ?? template.name).font(AppFont.headline())
            if !items.isEmpty {
                Text(items.map { catalog.name($0.exerciseID) }.joined(separator: ", "))
                    .font(AppFont.caption())
                    .foregroundStyle(Theme.textSecondary)
                    .lineLimit(2)
                MuscleTags(primary: primary.sorted { $0.displayName < $1.displayName }, secondary: secondary.sorted { $0.displayName < $1.displayName })
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
    @State private var collapsed = false

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
    }

    private var header: some View {
        HStack(spacing: 12) {
            NavigationLink(value: ProgramRoute(programID: program.id)) {
                HStack(spacing: 12) {
                    ProgramIconTile(program: program)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(program.name).font(AppFont.headline())
                        Text(workoutCount).font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
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
                            TemplateSummary(template: template)
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
    }
}
