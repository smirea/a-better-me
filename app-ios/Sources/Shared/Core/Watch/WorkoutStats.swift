import Foundation

/// A recording workout's live readings, which the watch sends the phone.
struct WorkoutStats: Codable, Equatable, Sendable {
    var heartRate: Double?
    var averageHeartRate: Double?
    var maxHeartRate: Double?
    var activeEnergyKcal: Double?
    var basalEnergyKcal: Double?
}
