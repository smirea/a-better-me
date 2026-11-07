import Foundation
import HealthKit

/// The app's one `HKHealthStore`, as Apple recommends a single long-lived store.
enum HealthStore {
    static let shared = HKHealthStore()

    /// Every phone-side Health read, write, and request checks this instead of `isHealthDataAvailable()`.
    static let isAvailable = HKHealthStore.isHealthDataAvailable() && isOnInDevelopment

    #if DEBUG && targetEnvironment(simulator)
    static let launchArgument = "-health"
    private static let defaultsKey = "devHealth"

    /// Debug simulator builds leave Health off, so agents never meet its sheet: the app takes its denied path. Launch
    /// once with `-health on` (`scripts/run --health on`) to turn it on, and `-health off` to turn it off. The choice
    /// persists, so later launches from Xcode, device tools, or UI tests keep it.
    private static let isOnInDevelopment: Bool = {
        let arguments = ProcessInfo.processInfo.arguments
        if let index = arguments.firstIndex(of: launchArgument), index + 1 < arguments.count {
            UserDefaults.standard.set(arguments[index + 1] == "on", forKey: defaultsKey)
        }
        return UserDefaults.standard.bool(forKey: defaultsKey)
    }()
    #else
    private static let isOnInDevelopment = true
    #endif
}
