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
