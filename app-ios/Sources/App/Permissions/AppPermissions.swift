import AVFoundation
import HealthKit
import UserNotifications

/// Every permission the app uses, asked for together on first launch. It is the owner's own app, so everything is
/// granted up front rather than when a feature first needs it; the features still check and degrade when denied.
@MainActor
enum AppPermissions {
    static let healthShare: Set<HKSampleType> = HealthData.shareTypes.union(WorkoutRecording.shareTypes).union(DietaryHealth.shareTypes)
    static let healthRead: Set<HKObjectType> = HealthData.readTypes.union(WorkoutRecording.readTypes)

    /// The prompts after Health's sheet, one at a time since the system shows one alert at once. Each returns
    /// immediately once answered, so calling this on every launch costs nothing. Live Activities have no request API:
    /// iOS asks when the first one starts.
    static func requestRest() async {
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])
        _ = await AVCaptureDevice.requestAccess(for: .video)
        _ = await AVAudioApplication.requestRecordPermission()
        setSettled(true)
    }

    /// Clears the settled mark as a launch starts, so a launch that ends with a prompt still up leaves it cleared.
    static func launchStarted() {
        setSettled(false)
    }

    #if DEBUG && targetEnvironment(simulator)
    /// `scripts/run` reads this key from the app's defaults to decide whether to answer the prompts again, and
    /// `PermissionsGrant` waits for this Darwin notification; both repeat the strings. Guessing from a fresh install or
    /// a quiet screen missed prompts that a slow launch on a busy Mac showed late.
    static let settledKey = "devPermissionsSettled"
    static let settledNotification = "com.stefan.a-better-me.permissions-settled"
    #endif

    private static func setSettled(_ settled: Bool) {
        #if DEBUG && targetEnvironment(simulator)
        UserDefaults.standard.set(settled, forKey: settledKey)
        guard settled else { return }
        CFNotificationCenterPostNotification(CFNotificationCenterGetDarwinNotifyCenter(), CFNotificationName(settledNotification as CFString), nil, nil, true)
        #endif
    }
}
