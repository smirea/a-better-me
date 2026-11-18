import Foundation

#if os(iOS)
import ActivityKit

struct WorkoutActivityAttributes: ActivityAttributes {
    typealias ContentState = LiveWorkoutStatus

    var sessionID: UUID
}
#endif
