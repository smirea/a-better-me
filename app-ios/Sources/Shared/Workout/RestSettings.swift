import Foundation

struct RestSettings: Codable, Hashable {
    var enabled = true
    var playSound = true
    var vibrate = true
    var afterLastWarmUp = true
    var betweenExercises = false
    var betweenSides = false
    var scaling = RestScaling()
}

/// Percent of the resolved rest.
struct RestScaling: Codable, Hashable {
    var afterLastWarmUp = 75
    var betweenExercises = 100
    var betweenSides = 50
}

/// The device that taps once, lightly, when a rest ends.
enum RestEndHaptic: Equatable {
    case phone, watch

    /// The watch while it records the workout: its workout session keeps the app running on the wrist. Otherwise the
    /// phone. Both sides ask with the same fact (the phone's recorder is the watch, the watch holds the recording), so
    /// exactly one of them taps. Vibrate off taps neither.
    static func device(vibrate: Bool, watchRecords: Bool) -> RestEndHaptic? {
        guard vibrate else { return nil }
        return watchRecords ? .watch : .phone
    }
}
