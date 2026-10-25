import SwiftUI

/// Five zones as shares of maximum heart rate: below 60%, then one per 10% up to 90% and above.
enum HeartRateZone: Int, CaseIterable {
    case one = 1, two, three, four, five

    init(heartRate: Double, max: Double) {
        let share = heartRate / max
        self = switch share {
        case ..<0.6: .one
        case ..<0.7: .two
        case ..<0.8: .three
        case ..<0.9: .four
        default: .five
        }
    }

    var color: Color {
        switch self {
        case .one: Theme.textSecondary
        case .two: Theme.muscle
        case .three: Theme.green
        case .four: Theme.amber
        case .five: Theme.destructive
        }
    }
}
