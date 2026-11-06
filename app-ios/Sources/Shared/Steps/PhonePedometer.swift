import CoreMotion
import Foundation

/// The phone's own step count from Core Motion. Unlike Health it stays readable while the phone is locked, and it
/// counts as the owner walks, while Health takes the phone's steps in batches. It counts only steps the phone felt.
enum PhonePedometer {
    /// Nil without a pedometer, without Motion access, or when Core Motion fails.
    static func steps(from start: Date, to end: Date) async -> Double? {
        guard CMPedometer.isStepCountingAvailable(), CMPedometer.authorizationStatus() == .authorized else { return nil }
        return await query(from: start, to: end)
    }

    /// Core Motion has no request call: the first query asks.
    static func requestAccess() async {
        guard CMPedometer.isStepCountingAvailable(), CMPedometer.authorizationStatus() == .notDetermined else { return }
        _ = await query(from: .now.addingTimeInterval(-60), to: .now)
    }

    private static func query(from start: Date, to end: Date) async -> Double? {
        let pedometer = CMPedometer()
        return await withCheckedContinuation { continuation in
            pedometer.queryPedometerData(from: start, to: end) { data, _ in
                withExtendedLifetime(pedometer) { continuation.resume(returning: data?.numberOfSteps.doubleValue) }
            }
        }
    }

    /// Health's daily counts with today raised to the phone's count when the phone has counted more.
    static func merge(_ phone: Double?, into health: [DatedValue], today: Date) -> [DatedValue] {
        guard let phone else { return health }
        guard let index = health.firstIndex(where: { $0.date == today }) else { return health + [DatedValue(date: today, value: phone)] }
        var merged = health
        merged[index].value = max(merged[index].value, phone)
        return merged
    }
}
