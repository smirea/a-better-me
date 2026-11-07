import Foundation
import os
import UIKit
import UserNotifications

/// What an exercise's suggestions were computed over: its planned sets and the weights its equipment can load. A
/// Targets edit, an added set, an Equipment or gym change, or a new bar choice changes it and refills.
struct SuggestionBasis: Equatable {
    var planned: [WorkoutSet]
    var loadable: LoadableWeights
}

/// The set table's reference column: the Smart Progression suggestion, or last time's log.
enum ReferenceColumn {
    case auto, previous
}

/// State of the in-progress workout that isn't history: typed values not yet logged, the rest timer, the exercise
/// on screen, and Smart Progression's suggestions and log. It outlives the full-screen view, so minimizing and
/// reopening keeps it. At most one session is in progress, so one shared instance holds it.
@MainActor @Observable
final class LiveSessionStore {
    static let shared = LiveSessionStore()

    /// Values typed into rows that aren't logged yet, by set or sub-row ID. A logged row edits its log instead.
    var drafts: [UUID: SetEntry] = [:]
    var currentExercise: BlockExercise.ID?
    /// `nil` until the header toggle is used; the editor then falls back to the Initial log fill setting.
    var referenceColumn: ReferenceColumn?
    /// Smart Progression per exercise, keyed by set or sub-row ID, and the Event Log of its fills.
    var suggestions: [BlockExercise.ID: [UUID: SetSuggestion]] = [:]
    var events: [BlockExercise.ID: [ProgressionEvent]] = [:]
    /// The planned sets each exercise's suggestions were computed over; a Targets edit or a new set changes it.
    var suggestionBasis: [BlockExercise.ID: SuggestionBasis] = [:]
    /// Rows Apply in session refilled, which show their suggestion even under the Previous values initial fill.
    var appliedRows: Set<UUID> = []
    /// The plate calculator's expanded view, kept while the keypad moves between rows and across launches.
    var platesExpanded = UserDefaults.standard.bool(forKey: platesExpandedKey) {
        didSet { UserDefaults.standard.set(platesExpanded, forKey: Self.platesExpandedKey) }
    }
    private static let platesExpandedKey = "workouts.platesExpanded"
    /// Warm-Up Automation runs once per session, when its live editor first opens.
    var didAutomateWarmUps: Set<WorkoutSession.ID> = []
    /// Set while Pause workout holds both clocks. Resume folds it into `WorkoutSession.pausedSeconds`.
    private(set) var pausedAt: Date?
    private var frozenRest: TimeInterval?
    private(set) var rest: LiveRest?
    /// What the restart pill "↺" goes back to: the rest the last checked set resolved to. It outlives Stop.
    private(set) var setRestSeconds: Int?
    private var restEndTask: Task<Void, Never>?
    /// How the rest that is running should end: the Vibrate and Play Sound settings when it started.
    private var alerts = RestSettings()

    private static let notificationID = "rest-timer"

    func startRest(seconds: Int, alerts: RestSettings, from start: Date = .now) {
        self.alerts = alerts
        setRestSeconds = seconds
        setRest(.starting(TimeInterval(seconds), at: start, now: .now))
    }

    func restartRest(seconds: Int) {
        setRest(.starting(TimeInterval(seconds), at: .now, now: .now))
    }

    func adjustRest(by seconds: TimeInterval) {
        guard let rest else { return }
        setRest(rest.adjusted(by: seconds, now: .now))
    }

    func stopRest() {
        rest = nil
        restEndTask?.cancel()
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [Self.notificationID])
    }

    func pause(at now: Date = .now) {
        guard pausedAt == nil else { return }
        pausedAt = now
        frozenRest = rest?.frozen(at: now)
        stopRest()
    }

    /// Ends the pause and returns its whole seconds, for the session's `pausedSeconds`. A frozen rest picks up where it stopped.
    func resume(at now: Date = .now) -> Int {
        guard let pausedAt else { return 0 }
        self.pausedAt = nil
        if let resumed = LiveRest.resumed(frozenRest, at: now) { setRest(resumed) }
        frozenRest = nil
        return Int(now.timeIntervalSince(pausedAt))
    }

    /// Drops an exercise's suggestions and log so the editor's next `blocks` change recomputes them over its new rows.
    func invalidateSuggestions(for id: BlockExercise.ID) {
        suggestions[id] = nil
        events[id] = nil
        suggestionBasis[id] = nil
    }

    /// Forgets everything when the session ends or is discarded.
    func reset() {
        stopRest()
        pausedAt = nil
        frozenRest = nil
        setRestSeconds = nil
        drafts = [:]
        currentExercise = nil
        referenceColumn = nil
        suggestions = [:]
        events = [:]
        suggestionBasis = [:]
        appliedRows = []
        didAutomateWarmUps = []
    }

    private func setRest(_ timer: LiveRest?) {
        guard let timer else { return stopRest() }
        rest = timer
        restEndTask?.cancel()
        restEndTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(timer.remaining(at: .now)))
            guard !Task.isCancelled, let self, self.rest == timer else { return }
            let haptic = RestEndHaptic.device(vibrate: self.alerts.vibrate, watchRecords: WorkoutHealth.shared.watchRecords)
            Self.log.info("Rest ended, haptic on \(String(describing: haptic), privacy: .public)")
            if haptic == .phone { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
            self.rest = nil
        }
        scheduleNotification(at: timer.endsAt)
    }

    static let log = Logger(subsystem: "com.stefan.a-better-me", category: "Rest")

    /// The haptic covers a phone in hand; the notification covers a locked phone or the app in the background. When the
    /// watch taps instead, a phone notification would reach the watch as a second tap. With Vibrate off the watch stays
    /// quiet, so the notification still carries Play Sound.
    private func scheduleNotification(at date: Date) {
        guard RestEndHaptic.device(vibrate: alerts.vibrate, watchRecords: WorkoutHealth.shared.watchRecords) != .watch else { return }
        let center = UNUserNotificationCenter.current()
        Task {
            guard (try? await center.requestAuthorization(options: [.alert, .sound])) == true, rest?.endsAt == date else { return }
            let content = UNMutableNotificationContent()
            content.title = "Rest is over"
            content.body = "Time for your next set."
            content.sound = alerts.playSound ? .default : nil
            let interval = max(1, date.timeIntervalSinceNow)
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
            try? await center.add(UNNotificationRequest(identifier: Self.notificationID, content: content, trigger: trigger))
        }
    }
}

extension WorkoutSession {
    /// Time on the workout clock: wall time minus every pause, including one still running.
    func elapsed(at now: Date, pausedAt: Date?) -> TimeInterval {
        max(0, now.timeIntervalSince(startedAt) - TimeInterval(pausedSeconds) - (pausedAt.map { now.timeIntervalSince($0) } ?? 0))
    }
}
