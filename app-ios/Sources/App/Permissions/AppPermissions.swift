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
    }
}
