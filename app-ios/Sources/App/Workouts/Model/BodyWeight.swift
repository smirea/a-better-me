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
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = key
        container["measured_at"] = Instant.text(measuredAt)
        container["weight_kg"] = weightKg
        container["source"] = source.rawValue
    }
}

enum BodyWeightSource: String {
    case manual, healthKit = "healthkit"
}

func currentBodyWeightKg(logged: [BodyWeight], health: (kg: Double, at: Date)?, manual: Double?) -> Double? {
    let newest = logged.max { $0.measuredAt < $1.measuredAt }
    switch (newest, health) {
    case let (weight?, sample?): return weight.measuredAt >= sample.at ? weight.weightKg : sample.kg
    case let (weight?, nil): return weight.weightKg
    case let (nil, sample?): return sample.kg
    case (nil, nil): return manual
    }
}
