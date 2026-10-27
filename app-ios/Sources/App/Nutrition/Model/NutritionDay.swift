import Foundation
import GRDB

/// A row of the synced `nutrition_days` table, keyed by the day: what the owner said about it. A day without a row
/// reads as `NutritionDay(id:)`.
struct NutritionDay: SyncedRecord {
    static let table = "nutrition_days"

    enum Status: String, CaseIterable, Codable, Sendable {
        /// Logged as usual: the entries are the intake.
        case none
        /// Marked incomplete; the algorithms skip it.
        case partial
        /// Marked fasted; with no entries it counts as zero calories.
        case fasted

        var title: String {
            switch self {
            case .none: "Complete"
            case .partial: "Incomplete"
            case .fasted: "Fasted"
            }
        }

        var symbol: String {
            switch self {
            case .none: "checkmark.circle"
            case .partial: "circle.lefthalf.filled"
            case .fasted: "moon.zzz.fill"
            }
        }
    }

    var id: CalendarDay
    var status = Status.none
    /// The owner's amounts for the day, in place of the logged ones (`totals`).
    var override: NutrientAmounts?

    init(id: CalendarDay) {
        self.id = id
    }

    init(row: Row) throws {
        id = try row.day("id")
        status = (row["status"] as String?).flatMap(Status.init(rawValue:)) ?? .none
        override = try (row["override"] as String?).map { try RowJSON.decoder.decode(NutrientAmounts.self, from: Data($0.utf8)) }
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = key
        container["status"] = status.rawValue
        container["override"] = try override.map(RowJSON.text)
    }

    /// The day's totals everywhere they show: the entries' sum with the override's amounts in place of the logged
    /// ones. A nutrient the override leaves out keeps its logged amount, so a calorie-only edit never zeroes protein.
    func totals(_ entries: [FoodEntry]) -> NutrientAmounts {
        FoodLog.totals(entries).merging(override ?? [:]) { $1 }
    }
}

/// A day as the expenditure algorithm reads it (docs/research/macrofactor/algorithms.md).
enum DayIntake: Equatable, Sendable {
    case logged(NutrientAmounts)
    case fasted
    /// Skipped: marked partial, or nothing logged and not marked fasted.
    case skipped

    /// An override wins over everything, then a partial mark; a fasted day counts as zero only while nothing is logged.
    init(entries: [FoodEntry], day: NutritionDay?) {
        if let day, day.override != nil {
            self = .logged(day.totals(entries))
        } else if day?.status == .partial {
            self = .skipped
        } else if entries.isEmpty {
            self = day?.status == .fasted ? .fasted : .skipped
        } else {
            self = .logged(FoodLog.totals(entries))
        }
    }

    /// The calories the algorithm counts, nil for a skipped day.
    var energy: Double? {
        switch self {
        case let .logged(amounts): amounts[.energy] ?? 0
        case .fasted: 0
        case .skipped: nil
        }
    }
}
