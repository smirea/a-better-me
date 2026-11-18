import Foundation
import GRDB

/// A row of the synced `body_weights` table: a weigh-in logged in the app. HealthKit samples are read live and never
/// copied here.
struct BodyWeight: SyncedRecord {
    static let table = "body_weights"

    var id: UUID
    var measuredAt: Date
    var weightKg: Double
    var source = BodyWeightSource.manual
    /// The scale's body fat percent, entered with the weight in Nutrition's weigh-in sheet.
    var bodyFatPercent: Double?

    init(weightKg: Double, measuredAt: Date = .now) {
        id = UUID()
        self.weightKg = weightKg
        self.measuredAt = measuredAt
    }

    init(row: Row) throws {
        id = try row.uuid("id")
        measuredAt = try row.instant("measured_at")
        guard let kg: Double = row["weight_kg"] else { throw RowDecodingError(description: "weight_kg is null") }
        weightKg = kg
        source = (row["source"] as String?).flatMap(BodyWeightSource.init(rawValue:)) ?? .manual
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

enum BodyWeightSource: String {
    case manual, healthKit = "healthkit"
}

extension BodyWeight {
    static let all = DatabaseQuery([BodyWeight]()) { db in
        try BodyWeight.fetchAll(db).sorted { $0.measuredAt > $1.measuredAt }
    }

    static let latest = DatabaseQuery(BodyWeight?.none) { db in try all.fetch(db).first }
}
