import Feedback
import SwiftUI

/// What each merged PR changed, from `Changelog.json`, which the Bundle Changelog build phase writes from the
/// repository's `changelog/` entries (`scripts/changelog.ts`). Entries arrive newest first.
struct Changelog: Decodable, Sendable {
    /// The build this app is, or "dev" for a local or CI build.
    let build: String
    let entries: [Entry]

    struct Entry: Decodable, Identifiable, Sendable {
        let id: String
        let date: CalendarDay
        let title: String
        let description: String?
        let tasks: [String]
        /// The first TestFlight build that held the change.
        let build: String
    }

    struct Day: Identifiable, Sendable {
        let day: CalendarDay
        let title: String
        var entries: [Entry]

        var id: CalendarDay { day }
    }

    func days(today: CalendarDay = .today) -> [Day] {
        var days: [Day] = []
        for entry in entries {
            if days.last?.day == entry.date {
                days[days.count - 1].entries.append(entry)
            } else {
                days.append(Day(day: entry.date, title: Self.title(entry.date, today: today), entries: [entry]))
            }
        }
        return days
    }

    private static func title(_ day: CalendarDay, today: CalendarDay) -> String {
        switch day.days(to: today) {
        case 0: return "Today"
        case 1: return "Yesterday"
        default:
            let date = day.date(in: .current)
            return day.year == today.year
                ? date.formatted(.dateTime.weekday(.wide).month(.wide).day())
                : date.formatted(.dateTime.weekday(.wide).month(.wide).day().year())
        }
    }

    static func taskURL(_ id: String) -> URL {
        URL(string: "https://procrastimate.stf.lol/inbox?task=\(id)")!
    }

    @concurrent static func bundled() async -> (build: String, days: [Day]) {
        guard let url = Bundle.main.url(forResource: "Changelog", withExtension: "json") else {
            fatalError("Changelog.json is missing from the app. The App target's Bundle Changelog build phase writes it.")
        }
        do {
            let changelog = try JSONDecoder().decode(Changelog.self, from: Data(contentsOf: url))
            return (changelog.build, changelog.days())
        } catch {
            fatalError("Changelog.json does not decode: \(error)")
        }
    }
}

/// More > General > Changelog: one section per day, newest first. Each row leads with the build that first shipped it
/// and ends with a button that opens its task in ProcrastiMate.
struct ChangelogView: View {
    @State private var loaded: (build: String, days: [Changelog.Day])?

    var body: some View {
        Form {
            if let loaded {
                ForEach(loaded.days) { day in
                    ThemedSection(day.title) {
                        ForEach(day.entries) { ChangelogRow(entry: $0) }
                    }
                }
            }
        }
        .themedList()
        .detailTitle("Changelog", subtitle: loaded.map { "This build: \($0.build)" })
        .task { loaded = await Changelog.bundled() }
        .feedback(self)
    }
}

private struct ChangelogRow: View {
    let entry: Changelog.Entry
    @ScaledMetric(relativeTo: .caption2) private var buildWidth: CGFloat = 52

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            // A build number wraps after its day, year.MMdd over HHmmss, so the column stays narrow and every title
            // starts at one edge.
            Text(entry.build.replacing(/\.(?=\d+$)/, with: "\n"))
                .font(AppFont.caption(11))
                .foregroundStyle(Theme.textTertiary)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
                .frame(width: buildWidth, alignment: .leading)
                .accessibilityLabel("Build \(entry.build)")
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.title).font(AppFont.rowTitle).foregroundStyle(Theme.textPrimary)
                if let description = entry.description {
                    Text(description).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            TaskButton(tasks: entry.tasks)
        }
        .feedback("Changelog Entry", data: entry.id)
    }
}

/// Hidden without a task; several tasks open from a menu.
private struct TaskButton: View {
    let tasks: [String]

    var body: some View {
        if tasks.count == 1, let task = tasks.first {
            Link(destination: Changelog.taskURL(task)) { icon }
                .buttonStyle(.borderless)
                .accessibilityLabel("Open task in ProcrastiMate")
        } else if tasks.count > 1 {
            Menu {
                ForEach(Array(tasks.enumerated()), id: \.element) { index, task in
                    Link("Task \(index + 1)", destination: Changelog.taskURL(task))
                }
            } label: { icon }
                .buttonStyle(.borderless)
                .accessibilityLabel("Open one of \(tasks.count) tasks in ProcrastiMate")
        }
    }

    private var icon: some View {
        Image(systemName: "checklist").font(AppFont.rowTitle).foregroundStyle(Theme.accent)
    }
}
