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
        /// When `build` was archived, in local time, with the date when that local day isn't `date`. Formatted while
        /// decoding, off the main thread, so a row only reads it.
        let buildTimeLabel: String?

        private enum CodingKeys: String, CodingKey { case id, date, title, description, tasks, build }

        init(from decoder: any Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            id = try container.decode(String.self, forKey: .id)
            let date = try container.decode(CalendarDay.self, forKey: .date)
            self.date = date
            title = try container.decode(String.self, forKey: .title)
            description = try container.decodeIfPresent(String.self, forKey: .description)
            tasks = try container.decode([String].self, forKey: .tasks)
            build = try container.decode(String.self, forKey: .build)
            buildTimeLabel = Changelog.buildTime(build).map { made in
                made.formatted(CalendarDay(made) == date
                    ? .dateTime.hour().minute()
                    : .dateTime.month(.abbreviated).day().hour().minute())
            }
        }
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

    /// The web inbox for now. Opening the ProcrastiMate iOS app instead waits on ProcrastiMate shipping a link for it.
    static func taskURL(_ id: String) -> URL {
        URL(string: "https://procrastimate.stf.lol/inbox?task=\(id)")!
    }

    /// When a TestFlight build was archived: its number is the UTC time as `year.MMdd.HHmmss` with leading zeros
    /// dropped (`app-ios/scripts/archive`). Anything else, such as "dev", has no time.
    static func buildTime(_ build: String) -> Date? {
        guard let match = build.wholeMatch(of: /(\d{4})\.(\d{1,4})\.(\d{1,6})/),
              let year = Int(match.1), let monthDay = Int(match.2), let time = Int(match.3)
        else { return nil }
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = .gmt
        return utc.date(from: DateComponents(
            year: year, month: monthDay / 100, day: monthDay % 100,
            hour: time / 10000, minute: time / 100 % 100, second: time % 100
        ))
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

/// More > General > Changelog: one section per day, newest first, under a centered title between two rules. Entries
/// draw straight on the page, without the usual card, as the owner asked: a build and time line, the title across the
/// full width, the description, and links to the entry's tasks.
struct ChangelogView: View {
    @State private var loaded: (build: String, days: [Changelog.Day])?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                if let loaded {
                    ForEach(loaded.days) { day in
                        DayHeader(title: day.title)
                        ForEach(day.entries) { entry in
                            if entry.id != day.entries.first?.id {
                                Divider().overlay(Theme.separator).padding(.horizontal, Theme.margin)
                            }
                            ChangelogRow(entry: entry)
                        }
                    }
                }
            }
            .padding(.bottom, 24)
        }
        .background(Theme.background)
        .detailTitle("Changelog", subtitle: loaded.map { "This build: \($0.build)" })
        .task { loaded = await Changelog.bundled() }
        .feedback(self)
    }
}

private struct DayHeader: View {
    let title: String

    var body: some View {
        HStack(spacing: 12) {
            rule
            Text(title).font(AppFont.listTitle).foregroundStyle(Theme.textPrimary).fixedSize()
            rule
        }
        .padding(.top, 28)
        .padding(.bottom, 4)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
        .feedback("\(title) Header")
    }

    private var rule: some View {
        Rectangle().fill(Theme.textTertiary.opacity(0.5)).frame(height: 1).frame(maxWidth: .infinity)
    }
}

private struct ChangelogRow: View {
    let entry: Changelog.Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            BuildLine(entry: entry)
            Text(entry.title).font(AppFont.rowTitle).foregroundStyle(Theme.textPrimary)
            if let description = entry.description {
                Text(description).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
            }
            TaskLinks(tasks: entry.tasks).padding(.top, 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Theme.margin)
        .padding(.vertical, 12)
        .feedback("Changelog Entry", data: entry.id)
    }
}

/// The build that first shipped the entry, then when it was archived in local time. The build number stays whole,
/// since it is the name TestFlight and the screen's subtitle use, and its own digits are a UTC time. A build archived
/// on a later local day than the entry also names that day.
private struct BuildLine: View {
    let entry: Changelog.Entry

    var body: some View {
        HStack {
            Text(entry.build)
            Spacer()
            if let time = entry.buildTimeLabel { Text(time) }
        }
        .font(AppFont.caption(11))
        .foregroundStyle(Theme.textTertiary)
        .accessibilityElement(children: .combine)
    }
}

/// Nothing without a task; several are numbered.
private struct TaskLinks: View {
    let tasks: [String]

    var body: some View {
        if !tasks.isEmpty {
            HStack(spacing: 16) {
                ForEach(Array(tasks.enumerated()), id: \.element) { index, task in
                    Link(destination: Changelog.taskURL(task)) {
                        Label(tasks.count == 1 ? "Task" : "Task \(index + 1)", systemImage: "checklist")
                    }
                    .accessibilityLabel(tasks.count == 1 ? "Open task in ProcrastiMate" : "Open task \(index + 1) in ProcrastiMate")
                }
            }
            .font(AppFont.rowDetail)
            .foregroundStyle(Theme.accent)
        }
    }
}
