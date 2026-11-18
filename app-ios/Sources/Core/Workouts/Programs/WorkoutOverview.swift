import Foundation

/// What a workout row says about its plan: how many exercises and working sets, and the sets each muscle gets for the
/// body map (secondary muscles count half, as on Workout Complete).
struct WorkoutOverview {
    let exercises: Int
    let sets: Int
    let muscleSets: [Muscle: Double]

    init(blocks: [WorkoutBlock], catalog: (ExerciseID) -> Exercise?) {
        let items = blocks.flatMap(\.exercises)
        exercises = items.count
        sets = items.reduce(0) { total, item in total + item.sets.count { $0.type.isWorking } }
        muscleSets = WorkoutMetrics.muscleSets(in: blocks, catalog: catalog, loggedOnly: false)
    }

    /// "6 exercises · 18 sets".
    var line: String {
        guard exercises > 0 else { return "No exercises" }
        return "\(exercises) \(exercises == 1 ? "exercise" : "exercises") · \(sets) \(sets == 1 ? "set" : "sets")"
    }

    /// Finished sessions, all time, keyed both by the template they started from and by the program day they filed
    /// under. A program day row looks up its day id, because two days of one program can share a template; a library
    /// row looks up its template id.
    static func completions(in finished: [WorkoutSession]) -> [UUID: Int] {
        var counts: [UUID: Int] = [:]
        for session in finished where session.endedAt != nil {
            if let templateID = session.templateID { counts[templateID, default: 0] += 1 }
            if let dayID = session.program?.dayID { counts[dayID, default: 0] += 1 }
        }
        return counts
    }
}
