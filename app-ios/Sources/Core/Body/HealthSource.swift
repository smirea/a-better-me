import Foundation

/// An app that writes to Apple Health, by its bundle id and the name Health shows for it.
struct HealthSource: Hashable, Sendable {
    var bundle: String
    var name: String

    /// Which app's copy stands for a session several apps recorded, best first. Garmin's band carries the most (calories,
    /// steps, heart-rate zones) and its sleep starts when the owner falls asleep; WHOOP starts the night early (9:22 PM
    /// against Garmin's 12:24 AM on 2026-11-19) and copies Garmin's workouts as its own, so it ranks below the Watch and
    /// iPhone. Apps not named here come after, by bundle id. See docs/decisions/health.md.
    var rank: Int {
        if bundle.hasPrefix("com.garmin.") { return 0 }
        if bundle.hasPrefix("com.apple.health") { return 1 }
        if bundle.lowercased().contains("whoop") { return 2 }
        return 3
    }

    /// This app and its watch app. Their workouts are `workout_sessions`, so Health's copies of them are not mirrored.
    /// The app writes no sleep outside the simulator seed, so its sleep samples are read like any app's.
    var isThisApp: Bool { bundle.hasPrefix("com.stefan.a-better-me") }

    static func ranked(_ a: HealthSource, _ b: HealthSource) -> Bool { (a.rank, a.bundle) < (b.rank, b.bundle) }
}

extension Date {
    /// The instant as the database stores it, to the millisecond, so a copy compares equal to its stored row.
    var storedInstant: Date { Date(timeIntervalSince1970: (timeIntervalSince1970 * 1000).rounded() / 1000) }
}
