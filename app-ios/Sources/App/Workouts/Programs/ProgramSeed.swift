#if DEBUG
import Foundation
import GRDB

/// The dev seed's (`DevSeed`) active program.
enum ProgramSeed {
    /// Gives the sample Upper and Lower templates program-owned copies, makes those an active program, and files this
    /// week's sample sessions under its first cycle, so the Cycle Workouts rings have a plan and progress. A second,
    /// inactive program gives the Workout Library a program card without deactivating the first.
    static func insertProgram(in db: Database) throws {
        let library = try WorkoutTemplate.fetchAll(db)
        guard let program = try insertProgram(
            "Upper Lower", id: "program", color: .blue, cycles: 4, days: ["Upper", "Lower", nil, "Upper"], isActive: true,
            library: library, in: db
        ) else { return }
        _ = try insertProgram(
            "Upper Lower Lite", id: "program/lite", color: .green, cycles: 3, days: ["Upper", nil, "Lower"], isActive: false,
            library: library, in: db
        )
        let calendar = Calendar.current
        for session in try WorkoutSession.fetchAll(db) where calendar.isDate(session.startedAt, equalTo: .now, toGranularity: .weekOfYear) {
            var filed = session
            let day = session.name == "Lower" ? program.days[1] : program.days[0]
            filed.program = ProgramPosition(programID: program.id, dayID: day.id, cycle: 1)
            try filed.updateChanges(db, from: session)
        }
    }

    /// A program whose days open its own copies of the named library templates, `nil` for a rest day. Nil when the
    /// library lacks one of them.
    private static func insertProgram(
        _ name: String, id: String, color: ProgramColor, cycles: Int, days layout: [String?], isActive: Bool,
        library: [WorkoutTemplate], in db: Database
    ) throws -> Program? {
        var program = Program(name: name, color: color, cycles: cycles)
        program.id = DevSeed.id(id)
        program.isActive = isActive
        var owned: [String: WorkoutTemplate] = [:]
        for templateName in layout.compactMap({ $0 }) where owned[templateName] == nil {
            guard let source = library.first(where: { $0.id == DevSeed.id("template/\(templateName)") }) else { return nil }
            var template = WorkoutTemplate(programID: program.id, name: source.name, blocks: source.blocks.copyingCycleTargets(), gymID: nil)
            template.id = DevSeed.id("\(id)/template/\(templateName)")
            owned[templateName] = template
        }
        for template in owned.values { try template.insert(db) }
        program.days = layout.enumerated().map { index, templateName in
            var day = ProgramDay(templateID: templateName.flatMap { owned[$0]?.id })
            day.id = DevSeed.id("\(id)/day/\(index)")
            return day
        }
        try program.insert(db)
        return program
    }
}
#endif
