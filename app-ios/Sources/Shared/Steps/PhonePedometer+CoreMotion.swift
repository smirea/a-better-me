import CoreMotion
import Foundation

extension PhonePedometer {
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
}
