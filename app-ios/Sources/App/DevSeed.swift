#if DEBUG
import CryptoKit
import Foundation
import GRDB

/// Debug simulator builds fill each empty area of the store at launch with enough history to show what a few months of
/// use looks like: 30 workouts, an active program, 45 days of food and weigh-ins, a food library, and a nutrition plan.
/// Lists then hold 20 to 50 rows, so a screen that only works with three rows shows it. Launch with `-noSeed` for an
/// empty store, or with `-seedSampleData` to seed a Debug build on a device.
enum DevSeed {
    static let disableArgument = "-noSeed"
    static let deviceArgument = "-seedSampleData"

    static var isEnabled: Bool {
        let process = ProcessInfo.processInfo
        // Hosted unit tests launch the app too; they use their own stores and must not wait on a seed.
        guard process.environment["XCTestConfigurationFilePath"] == nil else { return false }
        if process.arguments.contains(deviceArgument) { return true }
        #if targetEnvironment(simulator)
        return !process.arguments.contains(disableArgument)
        #else
        return false
        #endif
    }

    /// Seeded rows get ids derived from a fixed key, so reinstalling the app while the worktree's server still holds an
    /// earlier seed overwrites those rows on sync instead of duplicating every list.
    static func id(_ key: String) -> UUID {
        Array(SHA256.hash(data: Data("dev-seed/\(key)".utf8)).prefix(16)).withUnsafeBufferPointer {
            NSUUID(uuidBytes: $0.baseAddress) as UUID
        }
    }

    @MainActor
    static func run(_ store: LocalStore) {
        guard isEnabled else { return }
        store.write { try seed(in: $0) }
    }

    /// Fills each empty area, so running it again changes nothing.
    static func seed(in db: Database) throws {
        if try WorkoutTemplate.fetchCount(db) == 0 { try SampleData.insert(in: db) }
        if try Program.fetchCount(db) == 0 { try DashboardSeed.insertProgram(in: db) }
        if try Recipe.fetchCount(db) == 0, try FoodFavorite.fetchCount(db) == 0 { try LibrarySeed.insert(in: db) }
        if try FoodEntry.fetchCount(db) == 0, try BodyWeight.fetchCount(db) == 0 {
            try DashboardSeed.insertNutrition(in: db)
            try FoodLogSeed.insert(in: db)
        }
    }
}
#endif
