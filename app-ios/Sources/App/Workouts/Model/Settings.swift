import Foundation
import GRDB

/// The one row of the synced `settings` table, id `settings`: the weight unit and the rest default per category. A
/// column the row lacks (another device created it with one change) reads as the category's default, so the row is
/// only ever patched, never rewritten whole.
struct AppSettings: SyncedRecord {
    static let table = "settings"
    static let rowID = "settings"

    var id = rowID
    var weightUnit = WeightUnit.kg
    private var rest: [RestCategory: Int] = [:]

    init() {}

    init(row: Row) throws {
        id = row["id"]
        weightUnit = (row["weight_unit"] as String?).flatMap(WeightUnit.init(rawValue:)) ?? .kg
        for category in RestCategory.allCases {
            if let seconds: Int = row[category.column] { rest[category] = seconds }
        }
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = id
        container["weight_unit"] = weightUnit.rawValue
        for category in RestCategory.allCases {
            container[category.column] = rest[category]
        }
    }

    func restSeconds(_ category: RestCategory) -> Int { rest[category] ?? category.defaultSeconds }

    mutating func setRestSeconds(_ seconds: Int, for category: RestCategory) { rest[category] = seconds }
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
