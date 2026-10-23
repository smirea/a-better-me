import Foundation
import UIKit
import UserNotifications

struct RestTimer: Equatable {
    var startedAt: Date
    var duration: TimeInterval
    /// What the restart pill "↺" goes back to: the rest the checked set resolved to.
    var defaultSeconds: Int

    var endsAt: Date { startedAt.addingTimeInterval(duration) }

    func remaining(at date: Date) -> TimeInterval { max(0, endsAt.timeIntervalSince(date)) }
}

/// State of the in-progress workout that isn't history: typed values not yet logged, the rest timer, and the exercise
/// on screen. It outlives the full-screen view, so minimizing and reopening keeps it. At most one session is in
/// progress, so one shared instance holds it.
@MainActor @Observable
final class LiveSessionStore {
    static let shared = LiveSessionStore()

    /// Values typed into rows that aren't logged yet, by set or sub-row ID. A logged row edits its log instead.
    var drafts: [UUID: SetEntry] = [:]
    var currentExercise: BlockExercise.ID?
    private(set) var rest: RestTimer?
    private var restEndTask: Task<Void, Never>?

    private static let notificationID = "rest-timer"

    func startRest(seconds: Int) {
        guard seconds > 0 else { return stopRest() }
        setRest(RestTimer(startedAt: .now, duration: TimeInterval(seconds), defaultSeconds: seconds))
    }

    func restartRest(seconds: Int) {
        guard seconds > 0 else { return stopRest() }
        setRest(RestTimer(startedAt: .now, duration: TimeInterval(seconds), defaultSeconds: rest?.defaultSeconds ?? seconds))
    }

    /// The Rest Timer sheet's −15 and +15. Running out stops the timer.
    func adjustRest(by seconds: TimeInterval) {
        guard var timer = rest else { return }
        timer.duration += seconds
        if timer.remaining(at: .now) <= 0 { return stopRest() }
        setRest(timer)
    }

    func stopRest() {
        rest = nil
        restEndTask?.cancel()
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [Self.notificationID])
    }

    /// Forgets everything when the session ends or is discarded.
    func reset() {
        stopRest()
        drafts = [:]
        currentExercise = nil
    }

    private func setRest(_ timer: RestTimer) {
        rest = timer
        restEndTask?.cancel()
        restEndTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(timer.remaining(at: .now)))
            guard !Task.isCancelled, let self, self.rest == timer else { return }
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            self.rest = nil
        }
        scheduleNotification(at: timer.endsAt)
    }

    /// The haptic covers a phone in hand; the notification covers a locked phone or the app in the background.
    private func scheduleNotification(at date: Date) {
        let center = UNUserNotificationCenter.current()
        Task {
            guard (try? await center.requestAuthorization(options: [.alert, .sound])) == true, rest?.endsAt == date else { return }
            let content = UNMutableNotificationContent()
            content.title = "Rest is over"
            content.body = "Time for your next set."
            content.sound = .default
            let interval = max(1, date.timeIntervalSinceNow)
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
            try? await center.add(UNNotificationRequest(identifier: Self.notificationID, content: content, trigger: trigger))
        }
    }
}
