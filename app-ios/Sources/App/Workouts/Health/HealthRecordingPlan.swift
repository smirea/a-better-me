import Foundation

/// What the recording device saves alongside the workout, worked out from the session's logged sets.
enum HealthRecordingPlan {
    static func plan(for session: WorkoutSession, endedAt: Date, name: (ExerciseID) -> String) -> WorkoutRecordingPlan {
        WorkoutRecordingPlan(
            sessionID: session.id, name: session.name, endedAt: endedAt,
            segments: segments(in: session.blocks, startedAt: session.startedAt, name: name),
            effort: effort(in: session.blocks)
        )
    }

    /// One segment per exercise with a logged set. Only completion times are logged, so an exercise's segment starts
    /// when the last set of anything before its first set was logged (or at the start) and ends at its own last set.
    /// Superset members interleave, so their segments overlap.
    static func segments(in blocks: [WorkoutBlock], startedAt: Date, name: (ExerciseID) -> String) -> [WorkoutRecordingPlan.Segment] {
        let logs = blocks.allRows.compactMap { path in
            blocks.log(at: path).map { (exercise: blocks[path.block].exercises[path.exercise], at: $0.completedAt) }
        }
        var segments: [WorkoutRecordingPlan.Segment] = []
        for item in blocks.flatMap(\.exercises) {
            let times = logs.filter { $0.exercise.id == item.id }.map(\.at)
            guard let first = times.min(), let last = times.max() else { continue }
            let before = logs.filter { $0.exercise.id != item.id && $0.at < first }.map(\.at).max()
            segments.append(.init(exercise: name(item.exerciseID), start: before ?? startedAt, end: last))
        }
        return segments.sorted { $0.start < $1.start }
    }

    /// Apple's 1-10 workout effort from the working sets' average RIR: 0 RIR is all out (10), and each rep in reserve
    /// takes a point off. Warm-ups don't count, and with no logged RIR there is no score.
    static func effort(in blocks: [WorkoutBlock]) -> Double? {
        let rirs = blocks.flatMap(\.exercises).flatMap(\.sets).filter { $0.type != .warmUp }
            .flatMap { [$0.log] + $0.subSets.map(\.log) }
            .compactMap { $0?.rir }
        guard !rirs.isEmpty else { return nil }
        let average = Double(rirs.reduce(0, +)) / Double(rirs.count)
        return min(10, max(1, (10 - average).rounded()))
    }
}
