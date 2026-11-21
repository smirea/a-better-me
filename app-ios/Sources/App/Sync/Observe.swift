import Feedback
import GRDB
import SwiftUI

/// `@Observe(WorkoutTemplate.all) var templates`: the query's value, re-read whenever a local write or a sync changes
/// a table it reads. Small queries read synchronously for the first frame; pass `async: true` for whole-table or
/// repeated strip queries so they never block the main thread.
@propertyWrapper
struct Observe<Value: Sendable & Equatable>: DynamicProperty {
    @Environment(LocalStore.self) private var store
    @State private var tracker = Tracker<Value>()
    private let query: DatabaseQuery<Value>
    private let async: Bool

    init(_ query: DatabaseQuery<Value>, async: Bool = false) {
        self.query = query
        self.async = async
    }

    var wrappedValue: Value { MainActor.assumeIsolated { tracker.value } ?? query.placeholder }

    func update() {
        MainActor.assumeIsolated { tracker.start(query, in: store, async: async) }
    }
}

/// Shake-to-feedback reports the observed value instead of skipping the wrapper, capping large collections up front so
/// Feedback's mirror reflection doesn't walk thousands of rows on the main thread before truncating.
extension Observe: FeedbackRepresentable {
    var feedbackValue: Any { FeedbackSummary.capped(wrappedValue) }
}

@MainActor @Observable
private final class Tracker<Value: Sendable & Equatable> {
    nonisolated init() {}

    var value: Value?
    @ObservationIgnored private var cancellable: AnyDatabaseCancellable?

    func start(_ query: DatabaseQuery<Value>, in store: LocalStore, async: Bool) {
        guard cancellable == nil else { return }
        let observation = ValueObservation.trackingConstantRegion(query.fetch).removeDuplicates()
        if async {
            cancellable = observation.start(
                in: store.database.pool,
                scheduling: .async(onQueue: .main),
                onError: { LocalStore.log.error("Observation failed: \(String(describing: $0))") },
                onChange: { [weak self] value in MainActor.assumeIsolated { self?.value = value } }
            )
        } else {
            cancellable = observation.start(
                in: store.database.pool,
                scheduling: .immediate,
                onError: { LocalStore.log.error("Observation failed: \(String(describing: $0))") },
                onChange: { [weak self] in self?.value = $0 }
            )
        }
    }
}
