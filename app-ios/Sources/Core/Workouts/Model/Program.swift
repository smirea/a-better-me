import Foundation
import GRDB

/// A row of the synced `programs` table: a cycle of days, each a template or a rest day. At most one program is meant to
/// be active; `LocalStore.activate` keeps it so and `Program.active` resolves a double state.
struct Program: Stamped {
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
        config = row.json("config", over: ProgramConfig())
        // Two devices patch `cycles` and `current_cycle` independently, so the reader clamps instead of a server check.
        // A deload adds one cycle on top of `cycles`.
        currentCycle = min(max(row["current_cycle"] ?? 1, 1), Self.totalCycles(cycles, deload: config.deload))
        isActive = row.flag("active")
        isArchived = row.flag("archived")
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
}

/// A day in the program's cycle. A rest day has no template; a workout day's name and exercises are its template's.
struct ProgramDay: Codable, Hashable, Identifiable {
    var id = UUID()
    var templateID: UUID?
    /// The cycle in which the owner ticked this rest day on the Workout tab. Optional, like every field added to a
    /// stored tree.
    var restDoneInCycle: Int?
}

/// Program Settings and how the program was made. Encoded whole into `programs.config`.
struct ProgramConfig: Codable, Hashable {
    var dayOrder = DayOrder.rolling
    var deload = Deload.none
    var periodization = false
    /// The Smart Generation answers. `nil` for a program built from scratch or imported.
    var generator: GeneratorInputs?
    /// When the current run began: activation, or the wrap after the last cycle. Sessions before it belong to an
    /// earlier run and count for nothing, while staying in history.
    var runStartedAt: Date?
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

/// Every split the wizard offers, across the 2 to 6 day counts. `noPreference` resolves to one of the others when the
/// program is generated.
enum ProgramSplit: String, Codable, CaseIterable {
    case noPreference, fullBody
    case upperLower, pushPull
    case upperLowerFull, pushPullLegs
    case upperLowerUpperLower, pushPullHingeSquat, pushPullLegsAccessories
    case upperLowerUpperLowerUpper, pushPullHingeSquatAccessories, pushPullLegsUpperLower
    case pushPullHingeSquatUpperLower, pushPullLegsPushPullLegs
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

