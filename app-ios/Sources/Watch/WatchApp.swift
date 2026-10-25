import HealthKit
import SwiftUI
import WatchKit

@main
struct BetterMeWatchApp: App {
    @WKApplicationDelegateAdaptor private var delegate: WatchAppDelegate

    init() {
        AppFont.register()
    }

    var body: some Scene {
        WindowGroup {
            WatchRootView()
                .font(AppFont.body())
        }
    }
}

final class WatchAppDelegate: NSObject, WKApplicationDelegate {
    func applicationDidFinishLaunching() {
        WatchModel.shared.activate()
        #if DEBUG
        DebugAction.register()
        #endif
    }

    /// The phone's `startWatchApp(toHandle:)`: a workout started on the phone, and this watch records it.
    func handle(_ workoutConfiguration: HKWorkoutConfiguration) {
        WatchModel.shared.startRecording()
    }

    /// WatchConnectivity wakes the app with a refresh task for each delivery and expects it held until the content
    /// has arrived; the system log shows deliveries failing when no handler exists.
    func handle(_ backgroundTasks: Set<WKRefreshBackgroundTask>) {
        for task in backgroundTasks {
            if let task = task as? WKWatchConnectivityRefreshBackgroundTask {
                WatchModel.shared.hold(task)
            } else {
                task.setTaskCompletedWithSnapshot(false)
            }
        }
    }

    func handleActiveWorkoutRecovery() {
        WatchModel.shared.recover()
    }
}

struct WatchRootView: View {
    private var model: WatchModel { .shared }

    var body: some View {
        Group {
            if let summary = model.summary, model.snapshot.map({ $0.status.sessionID == summary.sessionID }) ?? true {
                SummaryView(summary: summary)
            } else if let snapshot = model.snapshot {
                WorkoutView(snapshot: snapshot)
            } else {
                HomeView()
            }
        }
        .task { await model.authorize() }
    }
}
