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
