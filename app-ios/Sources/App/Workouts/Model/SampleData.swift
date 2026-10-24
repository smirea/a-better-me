#if DEBUG
import Foundation
import GRDB

/// Launch with `-seedSampleData` to fill an empty store with two templates and ten weeks of progressing history,
/// so history, progression, and Levels can be checked in the simulator.
enum SampleData {
    static let launchArgument = "-seedSampleData"

    private static let upper: [(ExerciseID, startKg: Double, reps: Int)] = [
        ("19f5c6f170d8808bb424e98de4472a7e", 70, 8), // Barbell bench press
        ("30d5c6f170d880e7a00ee1e7319b720d", 55, 10), // Dual handle cable lat pulldown
        ("1a05c6f170d880c5ad11c99b302b1bf9", 40, 8), // Barbell overhead press
        ("1b15c6f170d88066b8c7cbfb822f1045", 25, 12), // Cable V-bar triceps pushdown
        ("1ec5c6f170d880e68b26fbc86bdd4d00", 30, 8), // Neutral grip machine-assisted pull-up
    ]
    private static let lower: [(ExerciseID, startKg: Double, reps: Int)] = [
        ("1a25c6f170d8803d8231d083fdd65458", 90, 6), // Barbell back squat
        ("1a35c6f170d880f7a755cd3780a63371", 110, 5), // Conventional deadlift
        ("1a25c6f170d88079a926dde776766181", 160, 10), // 45° leg press
    ]

    /// `-seedGroundworkRows` inserts one program and one gym and patches a workout setting, so a second simulator on
    /// the same server can prove the milestone 2 tables sync. `-dumpSyncedRows` writes what the store reads for them
    /// to `dump.json` next to the database, after every earlier write, so a script can compare the two devices.
    static let groundworkArgument = "-seedGroundworkRows"
    static let dumpArgument = "-dumpSyncedRows"
    static let dumpURL = LocalDatabase.directory.appending(path: "dump.json")

    @MainActor
    static func seedIfRequested(_ store: LocalStore) {
        let arguments = ProcessInfo.processInfo.arguments
        if arguments.contains(launchArgument) {
            store.write { db in
                guard try WorkoutTemplate.fetchCount(db) == 0 else { return }
                for record in records() { try record.insert(db) }
            }
        }
        if arguments.contains(groundworkArgument) {
            store.insert(Program(name: "Groundwork PPL", color: .teal, cycles: 6, days: [ProgramDay(), ProgramDay(templateID: nil)]))
            store.insert(GymProfile(name: "Garage", icon: "house", equipment: ["19e5c6f170d8801cac93cf6853bd86b8": GymEquipment(load: .weights(options: [WeightOption(kg: 20)]))]))
            store.updateSettings { $0.workout.rest.enabled = false }
            store.updateSettings { $0.workout.rest.scaling.afterLastWarmUp = 60 }
        }
        if arguments.contains(dumpArgument) {
            store.write { db in
                let dump = try [
                    "programs": RowJSON.text(Program.all.fetch(db).map(\.name)),
                    "programDays": RowJSON.text(Program.all.fetch(db).map(\.days.count)),
                    "gyms": RowJSON.text(GymProfile.all.fetch(db).map(\.name)),
                    "gymBarbellKg": RowJSON.text(GymProfile.all.fetch(db).map { $0.equipment["19e5c6f170d8801cac93cf6853bd86b8"]?.load }),
                    "workout": RowJSON.text(AppSettings.current.fetch(db).workout),
                ]
                try RowJSON.text(dump).write(to: dumpURL, atomically: true, encoding: .utf8)
            }
        }
    }

    private static func records() -> [any SyncedRecord] {
        let templates = [("Upper", upper), ("Lower", lower)].map { name, lifts in
            WorkoutTemplate(name: name, blocks: lifts.map { id, _, reps in
                WorkoutBlock(exercises: [BlockExercise(
                    exerciseID: id,
                    sets: [WorkoutSet(type: .warmUp)] + (0..<3).map { _ in WorkoutSet(target: SetTarget(repsMin: reps, repsMax: reps + 2, rir: 2)) },
                    restSeconds: 150
                )])
            })
        }
        var sessions: [WorkoutSession] = []
        let calendar = Calendar.current
        let start = calendar.date(byAdding: .weekOfYear, value: -10, to: .now)!
        for week in 0..<10 {
            for (day, (template, lifts)) in [(0, (templates[0], upper)), (2, (templates[1], lower)), (4, (templates[0], upper))] {
                let startedAt = calendar.date(byAdding: .day, value: week * 7 + day, to: start)!.addingTimeInterval(18 * 3600)
                var session = WorkoutSession(startingFrom: template)
                session.startedAt = startedAt
                session.blocks = zip(session.blocks, lifts).map { block, lift in
                    var block = block
                    let workingKg = (lift.startKg * (1 + 0.025 * Double(week)) / 2.5).rounded() * 2.5
                    for index in block.exercises[0].sets.indices {
                        let isWarmUp = block.exercises[0].sets[index].type == .warmUp
                        block.exercises[0].sets[index].log = SetLog(
                            weightKg: isWarmUp ? (workingKg * 0.5 / 2.5).rounded() * 2.5 : workingKg,
                            reps: isWarmUp ? 8 : lift.reps + (index == 1 ? 1 : 0),
                            rir: isWarmUp ? nil : max(0, 3 - index),
                            completedAt: startedAt.addingTimeInterval(Double(index) * 180)
                        )
                    }
                    return block
                }
                session.endedAt = startedAt.addingTimeInterval(55 * 60)
                sessions.append(session)
            }
        }
        return templates + sessions
    }
}
#endif
