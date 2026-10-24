#if DEBUG
import Foundation
import GRDB

/// Launch with `-seedActiveProgram` after `-seedSampleData` to turn the sample Upper and Lower templates into an
/// active program and file this week's sample sessions under its first cycle, so the Cycle Workouts rings have a plan
/// and progress. It does nothing once a program exists.
enum DashboardSeed {
    static let launchArgument = "-seedActiveProgram"

    @MainActor
    static func seedIfRequested(_ store: LocalStore) {
        guard ProcessInfo.processInfo.arguments.contains(launchArgument) else { return }
        store.write { db in
            guard try Program.fetchCount(db) == 0 else { return }
            let templates = try WorkoutTemplate.fetchAll(db).sorted { $0.createdAt < $1.createdAt }
            guard templates.count >= 2 else { return }
            let days = [ProgramDay(templateID: templates[0].id), ProgramDay(templateID: templates[1].id), ProgramDay(), ProgramDay(templateID: templates[0].id)]
            var program = Program(name: "Upper Lower", color: .blue, cycles: 4, days: days)
            program.isActive = true
            try program.insert(db)
            let calendar = Calendar.current
            for session in try WorkoutSession.fetchAll(db) where calendar.isDate(session.startedAt, equalTo: .now, toGranularity: .weekOfYear) {
                var filed = session
                let day = days.first { $0.templateID == session.templateID } ?? days[0]
                filed.program = ProgramPosition(programID: program.id, dayID: day.id, cycle: 1)
                try filed.updateChanges(db, from: session)
            }
        }
    }
}
#endif
