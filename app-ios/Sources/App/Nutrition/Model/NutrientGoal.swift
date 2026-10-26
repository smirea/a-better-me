import Foundation
import GRDB

/// A row of the synced `nutrient_goals` table: a nutrient's floor, target, and ceiling from a day on, keyed
/// `<day>/<nutrient>`. Days before a nutrient's first goal, and goals in `auto`, use the registry's defaults.
struct NutrientGoal: SyncedRecord {
    static let table = "nutrient_goals"

    enum Mode: Hashable, Sendable {
        case auto
        /// A nil bound is hidden.
        case custom(NutrientRange)
    }

    var nutrient: NutrientID
    var startsOn: CalendarDay
    var mode: Mode

    var id: String { Self.id(nutrient, from: startsOn) }

    static func id(_ nutrient: NutrientID, from day: CalendarDay) -> String { "\(day)/\(nutrient.rawValue)" }

    init(_ nutrient: NutrientID, from day: CalendarDay, mode: Mode) {
        self.nutrient = nutrient
        startsOn = day
        self.mode = mode
    }

    /// The range for `nutrient` on `day`: the latest goal on or before it, or the registry's default.
    static func range(
        _ nutrient: NutrientID, on day: CalendarDay, goals: [NutrientGoal], sex: BodySex, weightKg: Double?
    ) -> NutrientRange {
        let goal = goals.filter { $0.nutrient == nutrient && $0.startsOn <= day }.max { $0.startsOn < $1.startsOn }
        if case let .custom(range) = goal?.mode { return range }
        return NutrientRegistry.nutrient(nutrient)?.defaultRange(sex: sex, weightKg: weightKg) ?? NutrientRange()
    }

    init(row: Row) throws {
        nutrient = NutrientID(rawValue: row["nutrient"])
        startsOn = try row.day("starts_on")
        if row["mode"] as String? == "custom" {
            mode = .custom(NutrientRange(floor: row["floor"], target: row["target"], ceiling: row["ceiling"]))
        } else {
            mode = .auto
        }
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = id
        container["nutrient"] = nutrient.rawValue
        container["starts_on"] = startsOn.description
        switch mode {
        case .auto:
            container["mode"] = "auto"
            container["floor"] = Double?.none
            container["target"] = Double?.none
            container["ceiling"] = Double?.none
        case let .custom(range):
            container["mode"] = "custom"
            container["floor"] = range.floor
            container["target"] = range.target
            container["ceiling"] = range.ceiling
        }
    }
}
