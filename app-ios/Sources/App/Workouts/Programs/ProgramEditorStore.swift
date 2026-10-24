import Foundation
import GRDB

/// The program editor's writes that `ProgramStore` lacks. Each changes the program and its templates in one transaction.
extension LocalStore {
    /// A week targets save: `scope` decides which weeks and exercises of the program's templates take `edit`.
    func applyWeekTargets(_ edit: WeekTargetsEdit, scope: SavingScope, sourceTemplateID: UUID, in programID: UUID) {
        editProgramTemplates(programID) { program, template in
            template.blocks = scope.apply(
                edit, to: template.blocks, isSourceDay: template.id == sourceTemplateID,
                weeks: program.cycles, periodized: program.config.periodization
            )
        }
    }

    /// Number of Weeks. The deload stays derived, so it follows the new last week on its own.
    func setProgramWeeks(_ count: Int, in programID: UUID) {
        let count = max(count, 1)
        editProgramTemplates(programID) { program, template in
            template.blocks = ProgramEditorRules.settingWeeks(count, from: program.cycles, in: template.blocks)
        } program: { program in
            program.cycles = count
            program.currentCycle = min(program.currentCycle, program.totalCycles)
        }
    }

    /// Periodization. Turning it off keeps week 1 for every week and cannot be undone; turning it on starts every
    /// week from the plain sets.
    func setPeriodization(_ on: Bool, in programID: UUID) {
        editProgramTemplates(programID) { _, template in
            if !on { template.blocks = ProgramEditorRules.collapsingPeriodization(template.blocks) }
        } program: { program in
            program.config.periodization = on
        }
    }

    func setDayGym(_ gymID: UUID?, templateIDs: [UUID]) {
        write { db in
            for id in templateIDs {
                guard let existing = try WorkoutTemplate.fetchOne(db, key: WorkoutTemplate.key(id)) else { continue }
                var template = existing
                template.gymID = gymID
                template.updatedAt = .now
                try template.updateChanges(db, from: existing)
            }
        }
    }

    func reorderProgramDays(_ order: [ProgramDay.ID], in programID: UUID) {
        editProgram(programID) { $0.days = ProgramEditorRules.reordering($0.days, by: order) }
    }

    /// Appends exercises to a day. A rest day becomes a workout day named `name` first.
    func appendBlocks(_ blocks: [WorkoutBlock], toDay dayID: ProgramDay.ID, in programID: UUID, name: String, gymID: UUID?) {
        write { db in
            try Self.append(blocks, toDay: dayID, in: programID, name: name, gymID: gymID, db)
        }
    }

    /// Move to a different day: the exercise leaves its template and joins the end of the other day as its own block.
    func moveExercise(_ id: BlockExercise.ID, from templateID: UUID, toDay dayID: ProgramDay.ID, in programID: UUID, name: String) {
        write { db in
            guard let existing = try WorkoutTemplate.fetchOne(db, key: WorkoutTemplate.key(templateID)),
                  let at = existing.blocks.locate(id) else { return }
            var source = existing
            let item = source.blocks[at.block].exercises[at.item]
            source.blocks.remove(id)
            source.updatedAt = .now
            try source.updateChanges(db, from: existing)
            try Self.append([WorkoutBlock(exercises: [item])], toDay: dayID, in: programID, name: name, gymID: existing.gymID, db)
        }
    }

    /// "Save & Go to Duplicate": `duplicateProgram` with the name the owner typed. Resolves with the copy's id.
    func duplicateProgram(_ program: Program, templates: [WorkoutTemplate], named name: String) -> Task<UUID, any Error> {
        var copy = Program(name: name, color: program.color, icon: program.icon, cycles: program.cycles, config: program.config)
        var copies: [WorkoutTemplate] = []
        copy.days = program.days.map { day in
            guard let source = templates.first(where: { $0.id == day.templateID }) else { return ProgramDay() }
            var template = WorkoutTemplate(name: source.name, notes: source.notes, blocks: source.blocks.copyingCycleTargets())
            template.programID = copy.id
            template.gymID = source.gymID
            copies.append(template)
            return ProgramDay(templateID: template.id)
        }
        return write { [copy, copies] db in
            try copy.insert(db)
            for template in copies { try template.insert(db) }
            return copy.id
        }
    }

    private func editProgramTemplates(
        _ programID: UUID,
        _ change: @escaping @Sendable (Program, inout WorkoutTemplate) -> Void,
        program changeProgram: (@Sendable (inout Program) -> Void)? = nil
    ) {
        write { db in
            guard let existing = try Program.fetchOne(db, key: Program.key(programID)) else { return }
            let templates = try WorkoutTemplate.filter(Column("program_id") == Program.key(programID)).fetchAll(db)
            for original in templates {
                var template = original
                change(existing, &template)
                guard template.blocks != original.blocks else { continue }
                template.updatedAt = .now
                try template.updateChanges(db, from: original)
            }
            guard let changeProgram else { return }
            var program = existing
            changeProgram(&program)
            program.updatedAt = .now
            try program.updateChanges(db, from: existing)
        }
    }

    nonisolated private static func append(_ blocks: [WorkoutBlock], toDay dayID: ProgramDay.ID, in programID: UUID, name: String, gymID: UUID?, _ db: Database) throws {
        guard let existing = try Program.fetchOne(db, key: Program.key(programID)),
              let index = existing.days.firstIndex(where: { $0.id == dayID }) else { return }
        if let templateID = existing.days[index].templateID,
           let original = try WorkoutTemplate.fetchOne(db, key: WorkoutTemplate.key(templateID)) {
            var template = original
            template.blocks += blocks
            template.updatedAt = .now
            try template.updateChanges(db, from: original)
            return
        }
        var template = WorkoutTemplate(name: name, blocks: blocks)
        template.programID = programID
        template.gymID = gymID
        try template.insert(db)
        var program = existing
        program.days[index].templateID = template.id
        program.updatedAt = .now
        try program.updateChanges(db, from: existing)
    }
}
