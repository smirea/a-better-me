import Foundation
import GRDB

/// What `body_metrics` tracks besides the weigh-ins (and their scale body fat) in `body_weights`. The raw values are
/// the schema's `BODY_METRIC_KINDS`.
enum BodyMetricKind: String, Codable, CaseIterable, Sendable {
    case visualBodyFat = "visual_body_fat", steps
    case neck, shoulders, bust, chest, waist, hips
    case leftBicep = "left_bicep", rightBicep = "right_bicep", leftForearm = "left_forearm", rightForearm = "right_forearm"
    case leftWrist = "left_wrist", rightWrist = "right_wrist"
    case leftThigh = "left_thigh", rightThigh = "right_thigh", leftCalf = "left_calf", rightCalf = "right_calf"
    case leftAnkle = "left_ankle", rightAnkle = "right_ankle"
}

/// A row of the synced `body_metrics` table: one manual value per kind and day, keyed `<day>/<kind>`, so setting it again
/// replaces it. Visual body fat is a percent, steps a count, and every tape measurement centimeters.
struct BodyMetric: SyncedRecord {
    static let table = "body_metrics"

    var day: CalendarDay
    var kind: BodyMetricKind
    var value: Double
    var updatedAt: Date

    var id: String { Self.id(kind, on: day) }

    static func id(_ kind: BodyMetricKind, on day: CalendarDay) -> String { "\(day)/\(kind.rawValue)" }

    init(_ kind: BodyMetricKind, on day: CalendarDay, value: Double, at date: Date = .now) {
        self.day = day
        self.kind = kind
        self.value = value
        updatedAt = date
    }

    init(row: Row) throws {
        day = try row.day("day")
        let kind: String = row["kind"]
        guard let parsed = BodyMetricKind(rawValue: kind) else { throw RowDecodingError(description: "Unknown body metric: \(kind)") }
        self.kind = parsed
        guard let value: Double = row["value"] else { throw RowDecodingError(description: "value is null") }
        self.value = value
        updatedAt = try row.instant("updated_at")
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = id
        container["day"] = day.description
        container["kind"] = kind.rawValue
        container["value"] = value
        container["updated_at"] = Instant.text(updatedAt)
    }
}
