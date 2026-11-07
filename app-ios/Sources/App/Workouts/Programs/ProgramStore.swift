import Foundation
import GRDB

/// Program writes. A program and its day templates always change together, in one transaction.
extension LocalStore {
    /// Saves a generated or built program with its templates, inactive.
    func insertProgram(_ generated: GeneratedProgram) {
        write { db in
            try generated.program.insert(db)
            for template in generated.templates { try template.insert(db) }
        }
    }

    /// Removes the program and its templates. Its sessions stay in history.
    func deleteProgram(_ id: UUID) {
        write { db in
            _ = try WorkoutTemplate.filter(Column("program_id") == Program.key(id)).deleteAll(db)
            _ = try Program.deleteOne(db, key: Program.key(id))
        }
    }

    /// Saves `Program.duplicated`, "<name> Copy" unless named. Resolves with the copy's id.
    @discardableResult
    func duplicateProgram(_ program: Program, templates: [WorkoutTemplate], named name: String? = nil) -> Task<UUID, any Error> {
        let copy = program.duplicated(named: name ?? "\(program.name) Copy", templates: templates)
        return write { db in
            try copy.program.insert(db)
            for template in copy.templates { try template.insert(db) }
            return copy.program.id
        }
    }

    func setProgramArchived(_ id: UUID, _ archived: Bool) {
        edit(Program.self, id: id) {
            $0.isArchived = archived
            if archived { $0.isActive = false }
        }
    }

    /// Activate Program: a fresh run from cycle 1, out of the archive, and every other program inactive.
    func activate(_ id: UUID) {
        write { db in
            for program in try Program.fetchAll(db) where program.id == id || program.isActive {
                var changed = program
                changed.isActive = program.id == id
                if program.id == id {
                    changed.isArchived = false
                    changed.startRun()
                }
                try changed.update(db, from: program)
            }
        }
    }

    /// Deactivating moves the program to the library and resets its progress, as MF does.
    func deactivateProgram(_ id: UUID) {
        edit(Program.self, id: id) {
            $0.isActive = false
            $0.resetProgress()
        }
    }

    /// The Active Program section's rest-day checkbox.
    func tickRestDay(_ dayID: ProgramDay.ID, in programID: UUID, done: Bool) {
        edit(Program.self, id: programID) { program in
            guard let index = program.days.firstIndex(where: { $0.id == dayID }) else { return }
            program.days[index].restDoneInCycle = done ? program.currentCycle : nil
        }
    }

    /// The "Go to..." sheet: jump to any cycle, the deload included.
    func goToCycle(_ cycle: Int, in programID: UUID) {
        edit(Program.self, id: programID) { $0.currentCycle = min(max(cycle, 1), $0.totalCycles) }
    }

    func addRestDay(to programID: UUID) {
        edit(Program.self, id: programID) { $0.days.append(ProgramDay()) }
    }

    /// Removes a day. A workout day's template goes with it.
    func removeProgramDay(_ dayID: ProgramDay.ID, from programID: UUID) {
        write { db in
            guard let existing = try Program.fetchOne(db, key: Program.key(programID)) else { return }
            var program = existing
            if let templateID = program.days.first(where: { $0.id == dayID })?.templateID {
                _ = try WorkoutTemplate.deleteOne(db, key: WorkoutTemplate.key(templateID))
            }
            program.days.removeAll { $0.id == dayID }
            try program.update(db, from: existing)
        }
    }

    /// Turns a workout day into a rest day, deleting its template, or a rest day into a workout day with a new one.
    func toggleRestDay(_ dayID: ProgramDay.ID, in programID: UUID) {
        write { db in
            guard let existing = try Program.fetchOne(db, key: Program.key(programID)),
                  let index = existing.days.firstIndex(where: { $0.id == dayID }) else { return }
            var program = existing
            if let templateID = program.days[index].templateID {
                _ = try WorkoutTemplate.deleteOne(db, key: WorkoutTemplate.key(templateID))
                program.days[index].templateID = nil
            } else {
                let template = WorkoutTemplate(programID: programID, name: "", gymID: nil)
                try template.insert(db)
                program.days[index].templateID = template.id
            }
            try program.update(db, from: existing)
        }
    }

    /// Copies a day to the end of the cycle, as MF does: "Workout C" becomes "Workout D", any other name gets " Copy".
    func duplicateProgramDay(_ dayID: ProgramDay.ID, in programID: UUID) {
        write { db in
            guard let existing = try Program.fetchOne(db, key: Program.key(programID)),
                  let index = existing.days.firstIndex(where: { $0.id == dayID }) else { return }
            var program = existing
            var day = ProgramDay()
            if let templateID = program.days[index].templateID, let source = try WorkoutTemplate.fetchOne(db, key: WorkoutTemplate.key(templateID)) {
                let taken = Set(try WorkoutTemplate.filter(Column("program_id") == Program.key(programID)).fetchAll(db).map(\.name))
                let template = WorkoutTemplate(
                    programID: programID, name: ProgramDayName.duplicate(of: source.name, taken: taken), notes: source.notes,
                    blocks: source.blocks.copyingCycleTargets(), gymID: source.gymID
                )
                try template.insert(db)
                day.templateID = template.id
            }
            program.days.append(day)
            try program.update(db, from: existing)
        }
    }

    /// Starts a program day as a session of the current cycle, through the one-session-at-a-time prompt.
    func startProgramDay(_ program: Program, template: WorkoutTemplate, presenter: LiveWorkoutPresenter) {
        guard let day = program.day(for: template.id) else { return }
        presenter.startOrResume({ program.session(startingFrom: template, dayID: day.id, gymID: template.gymID) }, in: self)
    }

    /// "Update Workout Plan" on finishing: a library workout takes the session's `plan` whole; a program day merges it
    /// into the session's week (`ProgramPlanUpdate`).
    func updateWorkoutPlan(_ templateID: UUID, plan: [WorkoutBlock], session: WorkoutSession) {
        write { db in
            guard let existing = try WorkoutTemplate.fetchOne(db, key: WorkoutTemplate.key(templateID)) else { return }
            var template = existing
            if let position = session.program, let program = try Program.fetchOne(db, key: Program.key(position.programID)) {
                template.blocks = ProgramPlanUpdate.blocks(of: existing, plan: plan, position: position, program: program)
            } else {
                template.blocks = plan
            }
            try template.update(db, from: existing)
        }
    }

    /// Called once when a session finishes. Moves its program to the next cycle when the session completed the current one.
    func advanceProgram(after session: WorkoutSession) {
        guard let position = session.program else { return }
        write { db in
            guard let program = try Program.fetchOne(db, key: Program.key(position.programID)) else { return }
            var finishedSession = session
            finishedSession.endedAt = finishedSession.endedAt ?? .now
            let finished = try WorkoutSession.finished.fetch(db).filter { $0.id != session.id }
            guard let next = ProgramAdvance.cycle(after: finishedSession, program: program, finished: finished) else { return }
            var changed = program
            if next == 1 { changed.startRun() } else { changed.currentCycle = next }
            try changed.update(db, from: program)
        }
    }
}

extension [WorkoutBlock] {
    /// `copy()` with each exercise's cycle targets kept, for duplicating program days.
    func copyingCycleTargets() -> [WorkoutBlock] {
        map { block in
            WorkoutBlock(exercises: block.exercises.map { item in
                var copy = item.copy()
                copy.cycleTargets = item.cycleTargets?.map { CycleTargets(sets: $0.sets.map { $0.copyingTargets() }, skip: $0.skip) }
                return copy
            })
        }
    }
}

enum ProgramDayName {
    /// "Workout C" with "Workout D" free gives "Workout D"; anything else gets " Copy".
    static func duplicate(of name: String, taken: Set<String>) -> String {
        if let last = name.last, last.isLetter, last.isUppercase, name.dropLast().hasSuffix(" "), let next = last.unicodeScalars.first.map({ Unicode.Scalar($0.value + 1) }), let scalar = next, Character(scalar).isLetter {
            let candidate = String(name.dropLast()) + String(Character(scalar))
            if !taken.contains(candidate) { return candidate }
        }
        return "\(name) Copy"
    }
}
