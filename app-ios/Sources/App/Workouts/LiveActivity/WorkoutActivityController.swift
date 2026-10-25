import ActivityKit
import Foundation
import Observation
import os
import UIKit

/// Mirrors `LiveWorkoutController.shared.snapshot` into the workout's Live Activity: requests it when a session is in
/// progress, updates it when the status changes, and ends it with the finished banner when the session ends. Its
/// buttons come back through `LiveWorkoutIntent`, which this installs.
@MainActor
final class WorkoutActivityController {
    static let shared = WorkoutActivityController()

    /// How long the finished banner stays on the Lock Screen.
    static let finishedLinger: TimeInterval = 60

    private static let log = Logger(subsystem: "com.stefan.a-better-me", category: "live-activity")

    private var store: LocalStore?
    private var catalog: ExerciseCatalog?
    private var activity: Activity<WorkoutActivityAttributes>?
    /// The last status sent to ActivityKit, so a snapshot change outside the status (the exercise list) costs nothing.
    private var shown: LiveWorkoutStatus?
    /// ActivityKit's update and end are async; chaining them keeps a quick log-then-rest from landing out of order.
    private var queue: Task<Void, Never>?

    func start(store: LocalStore, catalog: ExerciseCatalog) {
        guard self.store == nil else { return }
        self.store = store
        self.catalog = catalog
        LiveWorkoutIntent.handler = { [weak self] command in
            await self?.perform(command)
        }
        // A request made before the app reaches the foreground is refused, so a launch into a running session, or a
        // session started from the watch while the phone was locked, asks again here.
        NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { _ in
            MainActor.assumeIsolated {
                let controller = WorkoutActivityController.shared
                if controller.activity == nil { controller.receive(LiveWorkoutController.shared.snapshot?.status) }
            }
        }
        track()
    }

    private func track() {
        let status = withObservationTracking { LiveWorkoutController.shared.snapshot?.status } onChange: { [weak self] in
            Task { @MainActor in self?.track() }
        }
        receive(status)
    }

    private func receive(_ status: LiveWorkoutStatus?) {
        guard let status else {
            if let shown { end(after: shown) } else { endAll(except: nil) }
            return
        }
        guard status != shown || activity == nil else { return }
        writeThumbnails(for: status)
        if let activity, activity.attributes.sessionID == status.sessionID {
            enqueue(activity) { await $0.update(Self.content(status)) }
            shown = status
        } else {
            request(status)
        }
    }

    /// Adopts the session's activity from an earlier launch, else asks for a new one.
    private func request(_ status: LiveWorkoutStatus) {
        let existing = Activity<WorkoutActivityAttributes>.activities.first {
            $0.attributes.sessionID == status.sessionID && $0.activityState == .active
        }
        endAll(except: existing?.id)
        if let existing {
            activity = existing
            enqueue(existing) { await $0.update(Self.content(status)) }
            shown = status
            return
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        do {
            activity = try Activity.request(
                attributes: WorkoutActivityAttributes(sessionID: status.sessionID),
                content: Self.content(status)
            )
            shown = status
        } catch {
            Self.log.error("Live Activity request failed: \(String(describing: error))")
        }
    }

    /// A finished session leaves the finished banner up for a minute; a discarded one disappears at once.
    private func end(after last: LiveWorkoutStatus) {
        shown = nil
        guard let ending = activity else { return }
        activity = nil
        let session = try? store?.read { try WorkoutSession.fetchOne($0, key: WorkoutSession.key(last.sessionID)) }
        var final = last
        final.rest = nil
        final.pausedAt = nil
        final.endedAt = session?.endedAt
        let policy: ActivityUIDismissalPolicy = final.endedAt == nil ? .immediate : .after(.now + Self.finishedLinger)
        let content = ActivityContent(state: final, staleDate: nil)
        enqueue(ending) { await $0.end(content, dismissalPolicy: policy) }
    }

    private func endAll(except keep: Activity<WorkoutActivityAttributes>.ID?) {
        for stale in Activity<WorkoutActivityAttributes>.activities where stale.id != keep && stale.activityState == .active {
            enqueue(stale) { await $0.end(nil, dismissalPolicy: .immediate) }
        }
    }

    /// A rest's content goes stale when the rest runs out, so the banner falls back to the set even if the app is
    /// suspended and can't clear the rest itself.
    private static func content(_ status: LiveWorkoutStatus) -> ActivityContent<LiveWorkoutStatus> {
        ActivityContent(state: status, staleDate: status.rest?.endsAt)
    }

    /// `Activity` isn't `Sendable`, though ActivityKit's update and end are safe to call from any thread.
    private func enqueue(
        _ activity: Activity<WorkoutActivityAttributes>,
        _ work: @escaping @Sendable (Activity<WorkoutActivityAttributes>) async -> Void
    ) {
        nonisolated(unsafe) let activity = activity
        let previous = queue
        queue = Task {
            await previous?.value
            await work(activity)
        }
    }

    /// The intent's process may be suspended as soon as `perform` returns, so it waits for the command to reach the
    /// activity. A command that changes nothing (a stale row, rest adjust with no rest) waits out the bound.
    private func perform(_ command: LiveWorkoutCommand) async {
        let before = shown
        LiveWorkoutController.shared.perform(command)
        for _ in 0..<40 where shown == before {
            try? await Task.sleep(for: .milliseconds(25))
        }
        await queue?.value
    }

    // MARK: Thumbnails

    private func writeThumbnails(for status: LiveWorkoutStatus) {
        for catalogID in Set([status.current?.catalogID, status.upNext?.catalogID].compactMap(\.self)) {
            writeThumbnail(catalogID)
        }
    }

    private func writeThumbnail(_ catalogID: String) {
        guard let url = ExerciseThumbnails.url(for: catalogID), !FileManager.default.fileExists(atPath: url.path),
              let name = catalog?.exercise(catalogID)?.images.first,
              let source = Bundle.main.url(forResource: name, withExtension: "webp"),
              let image = UIImage(contentsOfFile: source.path) else { return }
        // A centered square, small enough for WidgetKit, which swaps larger images for a placeholder.
        let side = CGFloat(ExerciseThumbnails.pixelSize)
        let height = side * image.size.height / image.size.width
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let scaled = UIGraphicsImageRenderer(size: CGSize(width: side, height: side), format: format).image { _ in
            image.draw(in: CGRect(x: 0, y: (side - height) / 2, width: side, height: height))
        }
        do {
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            try scaled.jpegData(compressionQuality: 0.8)?.write(to: url, options: .atomic)
        } catch {
            Self.log.error("Writing the \(catalogID) thumbnail failed: \(String(describing: error))")
        }
    }
}
