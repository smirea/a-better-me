import Foundation

/// MF's rest-timer groups, each with its own default in Workout settings (`AppSettings`). `CodingKeyRepresentable`
/// makes a dictionary keyed by it encode as a JSON object instead of a flat key-value array.
enum RestCategory: String, CaseIterable, Identifiable, Codable, CodingKeyRepresentable {
    case compoundUpper, compoundLower, upperIsolation, lowerIsolation, core

    var id: String { rawValue }

    var defaultSeconds: Int {
        switch self {
        case .compoundUpper: 120
        case .compoundLower: 180
        case .upperIsolation, .lowerIsolation: 90
        case .core: 60
        }
    }

    var displayName: String {
        switch self {
        case .compoundUpper: "Compound Upper"
        case .compoundLower: "Compound Lower"
        case .upperIsolation: "Upper Isolation"
        case .lowerIsolation: "Lower Isolation"
        case .core: "Core"
        }
    }
}
