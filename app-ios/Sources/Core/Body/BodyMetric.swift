import Foundation
import GRDB

/// What `body_metrics` tracks besides the weigh-ins (and their scale body fat) in `body_weights`. The raw values are
/// the schema's `BODY_METRIC_KINDS`. Steps, flights climbed, and walking distance are the day's activity totals, which
/// `HealthMirror` copies from Apple Health.
enum BodyMetricKind: String, Codable, CaseIterable, Sendable {
    case visualBodyFat = "visual_body_fat", steps, flightsClimbed = "flights_climbed", walkingDistance = "walking_distance"
    case neck, shoulders, bust, chest, waist, hips
    case leftBicep = "left_bicep", rightBicep = "right_bicep", leftForearm = "left_forearm", rightForearm = "right_forearm"
    case leftWrist = "left_wrist", rightWrist = "right_wrist"
    case leftThigh = "left_thigh", rightThigh = "right_thigh", leftCalf = "left_calf", rightCalf = "right_calf"
    case leftAnkle = "left_ankle", rightAnkle = "right_ankle"
}

/// A row of the synced `body_metrics` table: one value per kind and day, keyed `<day>/<kind>`, so setting it again
/// replaces it. Visual body fat is a percent, steps and flights climbed counts, walking distance meters, and every tape
/// measurement centimeters.
struct BodyMetric: Stamped {
    static let table = "body_metrics"

    var day: CalendarDay
    var kind: BodyMetricKind
    var value: Double
    var source = BodySource.manual
    var updatedAt: Date

    var id: String { Self.id(kind, on: day) }

    static func id(_ kind: BodyMetricKind, on day: CalendarDay) -> String { "\(day)/\(kind.rawValue)" }

    init(_ kind: BodyMetricKind, on day: CalendarDay, value: Double, source: BodySource = .manual, at date: Date = .now) {
        self.day = day
        self.kind = kind
        self.value = value
        self.source = source
        updatedAt = date
    }

    init(row: Row) throws {
        day = try row.day("day")
        let kind: String = row["kind"]
        guard let parsed = BodyMetricKind(rawValue: kind) else { throw RowDecodingError(description: "Unknown body metric: \(kind)") }
        self.kind = parsed
        guard let value: Double = row["value"] else { throw RowDecodingError(description: "value is null") }
        self.value = value
        source = (row["source"] as String?).flatMap(BodySource.init(rawValue:)) ?? .manual
        updatedAt = try row.instant("updated_at")
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = id
        container["day"] = day.description
        container["kind"] = kind.rawValue
        container["value"] = value
        container["source"] = source.rawValue
        container["updated_at"] = Instant.text(updatedAt)
    }
}

extension BodyMetricKind {
    /// "Left Bicep" from `leftBicep`.
    var title: String {
        String(describing: self).replacing(/([a-z])([A-Z])/) { "\($0.1) \($0.2)" }.capitalized
    }

    /// The day's totals Apple Health counts, which no screen lists as a measurement.
    static let activity: [BodyMetricKind] = [.steps, .flightsClimbed, .walkingDistance]

    var isLength: Bool { self != .visualBodyFat && !Self.activity.contains(self) }

    /// The sections Data Visibility and All Body Metrics list the kinds under; the activity totals live in Insights instead.
    var group: BodyMetricGroup? {
        switch self {
        case .visualBodyFat: .weightAndBodyFat
        case .steps, .flightsClimbed, .walkingDistance: nil
        case .neck, .shoulders, .bust, .chest, .waist, .hips: .upperBody
        case .leftBicep, .rightBicep, .leftForearm, .rightForearm, .leftWrist, .rightWrist: .arms
        case .leftThigh, .rightThigh, .leftCalf, .rightCalf, .leftAnkle, .rightAnkle: .legs
        }
    }
}

enum BodyMetricGroup: String, CaseIterable {
    case weightAndBodyFat = "Weight & Body Fat", upperBody = "Upper Body", arms = "Arms", legs = "Legs", ratios = "Ratios"

    var kinds: [BodyMetricKind] { BodyMetricKind.allCases.filter { $0.group == self } }
}
