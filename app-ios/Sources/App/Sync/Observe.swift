import Feedback
import GRDB
import SwiftUI

/// What a screen observes: a fetch over the local database and the value shown until the first read lands.
struct DatabaseQuery<Value: Sendable & Equatable>: Sendable {
    let placeholder: Value
    let fetch: @Sendable (Database) throws -> Value

    init(_ placeholder: Value, _ fetch: @escaping @Sendable (Database) throws -> Value) {
        self.placeholder = placeholder
        self.fetch = fetch
    }
}

/// `@Observe(WorkoutTemplate.all) var templates`: the query's value, re-read whenever a local write or a sync changes
/// a table it reads. The first value is read synchronously, so the first frame shows the data.
@propertyWrapper
struct Observe<Value: Sendable & Equatable>: DynamicProperty {
    @Environment(LocalStore.self) private var store
    @State private var tracker = Tracker<Value>()
    private let query: DatabaseQuery<Value>

    init(_ query: DatabaseQuery<Value>) {
        self.query = query
    }

    var wrappedValue: Value { MainActor.assumeIsolated { tracker.value } ?? query.placeholder }

    func update() {
        MainActor.assumeIsolated { tracker.start(query, in: store) }
    }
}

/// Shake-to-feedback reports the observed value instead of skipping the wrapper.
extension Observe: FeedbackRepresentable {
    var feedbackValue: Any { wrappedValue }
}

@MainActor @Observable
private final class Tracker<Value: Sendable & Equatable> {
    nonisolated init() {}

    var value: Value?
    @ObservationIgnored private var cancellable: AnyDatabaseCancellable?

    func start(_ query: DatabaseQuery<Value>, in store: LocalStore) {
        guard cancellable == nil else { return }
        cancellable = ValueObservation.trackingConstantRegion(query.fetch).removeDuplicates().start(
            in: store.database.pool,
            scheduling: .immediate,
            onError: { LocalStore.log.error("Observation failed: \(String(describing: $0))") },
            onChange: { [weak self] in self?.value = $0 }
        )
    }
}
