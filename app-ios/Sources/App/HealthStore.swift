import HealthKit

/// The app's one `HKHealthStore`, as Apple recommends a single long-lived store.
enum HealthStore {
    static let shared = HKHealthStore()
}
