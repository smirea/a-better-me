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
    }

    func applicationDidBecomeActive() {
        WatchModel.shared.requestState()
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
            if let workout = model.workout {
                if workout.isFinished {
                    SummaryView(workout: workout)
                } else {
                    WorkoutView(workout: workout)
                }
            } else {
                HomeView()
            }
        }
        .animation(.snappy, value: model.workout?.sessionID)
    }
}

extension View {
    /// Black, with the accent glowing up from the bottom edge like MF's watch app. Always On dims the glow.
    func watchGlow(_ color: Color = Theme.accent) -> some View {
        modifier(WatchGlow(color: color))
    }
}

private struct WatchGlow: ViewModifier {
    let color: Color
    @Environment(\.isLuminanceReduced) private var isLuminanceReduced

    func body(content: Content) -> some View {
        content.containerBackground(for: .navigation) {
            ZStack {
                Color.black
                RadialGradient(colors: [color.opacity(isLuminanceReduced ? 0.12 : 0.45), .clear], center: .bottom, startRadius: 0, endRadius: 210)
            }
        }
    }
}
