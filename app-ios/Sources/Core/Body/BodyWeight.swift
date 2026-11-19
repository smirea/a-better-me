import Foundation
import GRDB

/// A row of the synced `body_weights` table: a weigh-in logged in the app (`manual`), or the copy of an Apple Health
/// sample (`healthKit`) that `HealthMirror` keeps, whose id is the sample's UUID.
struct BodyWeight: SyncedRecord {
    static let table = "body_weights"

    var id: UUID
    var measuredAt: Date
    var weightKg: Double
    var source = BodySource.manual
    /// The scale's body fat percent, entered with the weight in Nutrition's weigh-in sheet.
    var bodyFatPercent: Double?

    init(id: UUID = UUID(), weightKg: Double, measuredAt: Date = .now, source: BodySource = .manual) {
        self.id = id
        self.weightKg = weightKg
        self.measuredAt = measuredAt
        self.source = source
    }

    init(row: Row) throws {
        id = try row.uuid("id")
        measuredAt = try row.instant("measured_at")
        guard let kg: Double = row["weight_kg"] else { throw RowDecodingError(description: "weight_kg is null") }
        weightKg = kg
        source = (row["source"] as String?).flatMap(BodySource.init(rawValue:)) ?? .manual
        bodyFatPercent = row["body_fat_percent"]
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = key
        container["measured_at"] = Instant.text(measuredAt)
        container["weight_kg"] = weightKg
        container["source"] = source.rawValue
        container["body_fat_percent"] = bodyFatPercent
    }
}

/// Who owns a `body_weights` or `body_metrics` row. A `healthKit` row follows Apple Health: `HealthMirror` rewrites it
/// when Health changes and deletes it when Health drops it, so the app never edits one.
enum BodySource: String, Sendable {
    case manual, healthKit = "healthkit"
}

extension BodyWeight {
    static let all = DatabaseQuery([BodyWeight]()) { db in
        try BodyWeight.fetchAll(db).sorted { $0.measuredAt > $1.measuredAt }
    }

    static let latest = DatabaseQuery(BodyWeight?.none) { db in try all.fetch(db).first }
}
