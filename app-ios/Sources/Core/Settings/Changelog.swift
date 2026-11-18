import Foundation

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
        let tasks: [TaskLink]
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
            tasks = try container.decode([TaskLink].self, forKey: .tasks)
            build = try container.decode(String.self, forKey: .build)
            buildTimeLabel = Changelog.buildTime(build).map { made in
                made.formatted(CalendarDay(made) == date
                    ? .dateTime.hour().minute()
                    : .dateTime.month(.abbreviated).day().hour().minute())
            }
        }
    }

    /// A ProcrastiMate task the entry addressed. `title` is captured when the entry is written, since the app can't
    /// look it up; entries written with a bare id have none.
    struct TaskLink: Decodable, Identifiable, Sendable {
        let id: String
        let title: String?

        var label: String { title ?? "ProcrastiMate task" }
        var url: URL { Changelog.taskURL(id) }
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
