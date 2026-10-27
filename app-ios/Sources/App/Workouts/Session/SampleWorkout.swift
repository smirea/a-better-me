#if DEBUG
import Foundation
import GRDB

/// Launch with `-startSampleWorkout` (the dev seed makes it) to start the seeded "Upper" template with a drop set and
/// a superset, so the live workout can be driven in the simulator before the builder's Start Workout lands.
enum SampleWorkout {
    static let launchArgument = "-startSampleWorkout"
    private static var isRequested: Bool { ProcessInfo.processInfo.arguments.contains(launchArgument) }
    @MainActor private static var didExpand = false

    @MainActor
    static func startIfRequested(_ store: LocalStore) {
        guard isRequested else { return }
        store.write { db in
            guard try WorkoutSession.inProgress.fetch(db) == nil,
                  let template = try WorkoutTemplate.filter(Column("name") == "Upper").fetchOne(db) else { return }
            var session = WorkoutSession(startingFrom: template)
            var blocks = session.blocks
            if !blocks.contains(where: \.isSuperset), let last = blocks.indices.last, last > 0 {
                blocks[last - 1].exercises += blocks[last].exercises
                blocks.remove(at: last)
            }
            if var bench = blocks.first?.exercises.first, let lastSet = bench.sets.indices.last, bench.sets[lastSet].type != .drop {
                bench.sets[lastSet].type = .drop
                bench.sets[lastSet].subSets = [SubSet()]
                blocks[0].exercises[0] = bench
            }
            session.blocks = blocks
            try session.insert(db)
        }
    }

    @MainActor
    static func expandIfRequested(_ presenter: LiveWorkoutPresenter) {
        guard isRequested, !didExpand else { return }
        didExpand = true
        presenter.isExpanded = true
    }
}
#endif
