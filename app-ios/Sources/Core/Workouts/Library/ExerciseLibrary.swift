import Foundation

enum ExerciseLibrary {
    /// How many finished sessions completed at least one set of each exercise.
    static func performedCounts(_ sessions: [WorkoutSession]) -> [ExerciseID: Int] {
        var counts: [ExerciseID: Int] = [:]
        for session in sessions {
            let ids = Set(session.blocks.flatMap(\.exercises).filter { $0.sets.contains(where: \.isCompleted) }.map(\.exerciseID))
            for id in ids { counts[id, default: 0] += 1 }
        }
        return counts
    }
}
