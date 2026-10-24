import Foundation
import GRDB

/// The one row of the synced `settings` table, id `settings`: the weight unit, the rest default per category, and the
/// four JSON settings trees. A column the row lacks (another device created it with one change) reads as its default,
/// so the row is only ever patched, never rewritten whole.
struct AppSettings: SyncedRecord {
    static let table = "settings"
    static let rowID = "settings"

    var id = rowID
    var weightUnit = WeightUnit.lb
    private var rest: [RestCategory: Int] = [:]
    var workout = WorkoutSettings()
    var profile = ProfileSettings()
    var dashboard = DashboardLayout()
    var shortcuts = ShortcutsLayout()

    init() {}

    init(row: Row) throws {
        id = row["id"]
        weightUnit = (row["weight_unit"] as String?).flatMap(WeightUnit.init(rawValue:)) ?? .lb
        for category in RestCategory.allCases {
            if let seconds: Int = row[category.column] { rest[category] = seconds }
        }
        workout = row.json("workout", over: WorkoutSettings())
        profile = row.json("profile", over: ProfileSettings())
        dashboard = row.json("dashboard", over: DashboardLayout())
        shortcuts = row.json("shortcuts", over: ShortcutsLayout())
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = id
        container["weight_unit"] = weightUnit.rawValue
        for category in RestCategory.allCases {
            container[category.column] = rest[category] ?? category.defaultSeconds
        }
        container["workout"] = try RowJSON.text(workout)
        container["profile"] = try RowJSON.text(profile)
        container["dashboard"] = try RowJSON.text(dashboard)
        container["shortcuts"] = try RowJSON.text(shortcuts)
    }

    func restSeconds(_ category: RestCategory) -> Int { rest[category] ?? category.defaultSeconds }

    mutating func setRestSeconds(_ seconds: Int, for category: RestCategory) { rest[category] = seconds }

    /// Rest Timer's Reset Defaults: the five durations and every other rest-timer setting. Each duration is written
    /// explicitly, because clearing the dictionary would patch NULL into the NOT NULL rest columns.
    mutating func resetRestTimer() {
        for category in RestCategory.allCases {
            rest[category] = category.defaultSeconds
        }
        workout.rest = RestSettings()
    }
}

extension RestCategory {
    var column: String {
        switch self {
        case .compoundUpper: "rest_compound_upper"
        case .compoundLower: "rest_compound_lower"
        case .upperIsolation: "rest_upper_isolation"
        case .lowerIsolation: "rest_lower_isolation"
        case .core: "rest_core"
        }
    }
}

/// The owner's profile: what the body figure, the generator, and exercise access read. Encoded whole into
/// `settings.profile`.
struct ProfileSettings: Codable, Hashable {
    var sex = BodySex.male
    var liftingExperience = LiftingExperience.intermediate
    /// Exercise Assessment answers by question id. The question and answer ids come from the research thread.
    var assessment: [String: String] = [:]
    var assessmentCompletedAt: Date?
    /// The manual fallback the live workout's Bodyweight Contribution uses when no `BodyWeight` row and no HealthKit
    /// sample exist. `currentBodyWeightKg` ranks it last.
    var bodyWeightKg: Double?
}

enum BodySex: String, Codable {
    case male, female
}

enum LiftingExperience: String, Codable, CaseIterable {
    case beginner, intermediate, advanced
}
