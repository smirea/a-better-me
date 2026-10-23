#if DEBUG
import Foundation
import SwiftData

/// Launch with `-startSampleWorkout` (after `-seedSampleData`) to start the seeded "Upper" template with a drop set and
/// a superset, so the live workout can be driven in the simulator before the builder's Start Workout lands.
enum SampleWorkout {
    static let launchArgument = "-startSampleWorkout"
    private static var isRequested: Bool { ProcessInfo.processInfo.arguments.contains(launchArgument) }
    @MainActor private static var didExpand = false

    @MainActor
    static func startIfRequested(_ context: ModelContext) {
        guard isRequested,
              (try? context.fetchCount(FetchDescriptor<WorkoutSession>(predicate: #Predicate { $0.endedAt == nil }))) == 0,
              let template = try? context.fetch(FetchDescriptor<WorkoutTemplate>(predicate: #Predicate { $0.name == "Upper" })).first
        else { return }
        let session = WorkoutSession(startingFrom: template)
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
        context.insert(session)
        try? context.save()
    }

    @MainActor
    static func expandIfRequested(_ presenter: LiveWorkoutPresenter) {
        guard isRequested, !didExpand else { return }
        didExpand = true
        presenter.isExpanded = true
    }
}
#endif
