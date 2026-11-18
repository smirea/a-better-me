import SwiftUI

extension StepGoal.Tier {
    var color: Color {
        switch self {
        case .met: Theme.goal
        case .near: Theme.coral
        case .far: Theme.destructive
        }
    }
}
