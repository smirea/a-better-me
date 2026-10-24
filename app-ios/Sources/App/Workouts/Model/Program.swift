import Foundation
import GRDB

/// A row of the synced `programs` table: a cycle of days, each a template or a rest day. At most one program is meant to
/// be active; `LocalStore.activateProgram` keeps it so and `Program.active` resolves a double state.
struct Program: SyncedRecord {
    static let table = "programs"

    var id: UUID
    var name: String
    var color: ProgramColor
    /// An SF Symbol name.
    var icon: String
    var cycles: Int
    var currentCycle = 1
    var isActive = false
    var isArchived = false
    var config = ProgramConfig()
    var days: [ProgramDay] = []
    var createdAt: Date
    var updatedAt: Date

    init(name: String, color: ProgramColor, icon: String = ProgramColor.defaultIcon, cycles: Int, days: [ProgramDay] = [], config: ProgramConfig = ProgramConfig()) {
        id = UUID()
        self.name = name
        self.color = color
        self.icon = icon
        self.cycles = max(cycles, 1)
        self.days = days
        self.config = config
        createdAt = .now
        updatedAt = .now
    }

    init(row: Row) throws {
        id = try row.uuid("id")
        name = row["name"]
        color = (row["color"] as String?).flatMap(ProgramColor.init(rawValue:)) ?? .blue
        icon = row["icon"] ?? ProgramColor.defaultIcon
        cycles = max(row["cycles"] ?? 1, 1)
        // Two devices patch `cycles` and `current_cycle` independently, so the reader clamps instead of a server check.
        currentCycle = min(max(row["current_cycle"] ?? 1, 1), cycles)
        isActive = row.flag("active")
        isArchived = row.flag("archived")
        config = row.json("config", over: ProgramConfig())
        days = row.json("days", over: [ProgramDay]())
        createdAt = try row.instant("created_at")
        updatedAt = try row.instant("updated_at")
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = key
        container["name"] = name
        container["color"] = color.rawValue
        container["icon"] = icon
        container["cycles"] = cycles
        container["current_cycle"] = currentCycle
        container["active"] = isActive ? 1 : 0
        container["archived"] = isArchived ? 1 : 0
        container["config"] = try RowJSON.text(config)
        container["days"] = try RowJSON.text(days)
        container["created_at"] = Instant.text(createdAt)
        container["updated_at"] = Instant.text(updatedAt)
    }

    /// The next day to train: the workout day after the newest finished session of this program's current cycle,
    /// skipping rest days, or the first workout day. `nil` when every day is a rest day.
    func upNext(after history: [WorkoutSession]) -> ProgramPosition? {
        let workoutDays = days.indices.filter { days[$0].templateID != nil }
        guard let first = workoutDays.first else { return nil }
        let latest = history
            .filter { $0.endedAt != nil && $0.program?.programID == id && $0.program?.cycle == currentCycle }
            .max { $0.startedAt < $1.startedAt }
        let lastIndex = latest.flatMap { session in days.firstIndex { $0.id == session.program?.dayID } }
        let next = lastIndex.flatMap { last in workoutDays.first { $0 > last } } ?? first
        return ProgramPosition(programID: id, dayID: days[next].id, cycle: currentCycle)
    }
}

/// A day in the program's cycle. A rest day has no template; a workout day's name and exercises are its template's.
struct ProgramDay: Codable, Hashable, Identifiable {
    var id = UUID()
    var templateID: UUID?
}

/// Program Settings and how the program was made. Encoded whole into `programs.config`.
struct ProgramConfig: Codable, Hashable {
    var dayOrder = DayOrder.rolling
    var deload = Deload.none
    var periodization = false
    /// The Smart Generation answers. `nil` for a program built from scratch or imported.
    var generator: GeneratorInputs?
}

/// `rolling`: an N-day cycle, the days numbered Day 1 to N. `weekly`: seven days, one per weekday from Monday.
enum DayOrder: String, Codable {
    case rolling, weekly
}

enum Deload: String, Codable {
    case none, firstCycle, lastCycle
}

struct GeneratorInputs: Codable, Hashable {
    var goal: TrainingGoal
    var daysPerWeek: Int
    var split: ProgramSplit
    var sessionLength: SessionLength
    var repProgression: RepProgression
    var muscleFocus: [Muscle: Emphasis] = [:]
    var gymID: UUID?
    var deload: Bool
    var experience: LiftingExperience
}

enum TrainingGoal: String, Codable {
    case hypertrophy, strength, both
}

enum ProgramSplit: String, Codable {
    case noPreference, fullBody, upperLowerFull, pushPullLegs
}

enum SessionLength: String, Codable {
    case upTo20, from20To40, from40To60, from60To90, from90To120, over120
}

enum RepProgression: String, Codable {
    case noPreference, constant = "static", linear, reverseLinear, undulating
}

enum Emphasis: String, Codable {
    case more, less
}

extension Muscle: CodingKeyRepresentable {}

/// MF's seven program colors. The raw values are ours.
enum ProgramColor: String, Codable, CaseIterable {
    case red, orange, yellow, green, teal, blue, purple

    static let defaultIcon = "dumbbell.fill"
}

/// Where a session sits in a program. The three session columns are all set or all null, so this is one optional.
struct ProgramPosition: Hashable {
    var programID: UUID
    var dayID: UUID
    var cycle: Int
}
