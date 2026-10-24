import Foundation
import GRDB

/// Program writes. A program and its day templates always change together, in one transaction.
extension LocalStore {
    /// Saves a generated or built program with its templates. `activate` makes it the one active program.
    func insertProgram(_ generated: GeneratedProgram, activate: Bool) {
        write { db in
            var program = generated.program
            program.isActive = activate
            if activate {
                program.config.runStartedAt = .now
                for other in try Program.fetchAll(db) where other.isActive {
                    var changed = other
                    changed.isActive = false
                    changed.updatedAt = .now
                    try changed.updateChanges(db, from: other)
                }
            }
            try program.insert(db)
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

    /// A copy named "<name> Copy" with fresh ids throughout, inactive and in the library.
    func duplicateProgram(_ program: Program, templates: [WorkoutTemplate]) {
        var copy = Program(name: "\(program.name) Copy", color: program.color, icon: program.icon, cycles: program.cycles, config: program.config)
        var copies: [WorkoutTemplate] = []
        copy.days = program.days.map { day in
            guard let source = templates.first(where: { $0.id == day.templateID }) else { return ProgramDay() }
            var template = WorkoutTemplate(name: source.name, notes: source.notes, blocks: source.blocks.copyingCycleTargets())
            template.programID = copy.id
            template.gymID = source.gymID
            copies.append(template)
            return ProgramDay(templateID: template.id)
        }
        insertProgram(GeneratedProgram(program: copy, templates: copies), activate: false)
    }

    func setProgramArchived(_ id: UUID, _ archived: Bool) {
        editProgram(id) {
            $0.isArchived = archived
            if archived { $0.isActive = false }
        }
    }

    /// Activate Program: a fresh run from cycle 1, replacing the active program.
    func activate(_ id: UUID) {
        editProgram(id) {
            $0.currentCycle = 1
            $0.config.runStartedAt = .now
            for index in $0.days.indices { $0.days[index].restDoneInCycle = nil }
        }
        activateProgram(id)
    }

    /// Deactivating moves the program to the library and resets its progress, as MF does.
    func deactivateProgram(_ id: UUID) {
        editProgram(id) {
            $0.isActive = false
            $0.currentCycle = 1
            for index in $0.days.indices { $0.days[index].restDoneInCycle = nil }
        }
    }

    /// The Active Program section's rest-day checkbox.
    func tickRestDay(_ dayID: ProgramDay.ID, in programID: UUID, done: Bool) {
        editProgram(programID) { program in
            guard let index = program.days.firstIndex(where: { $0.id == dayID }) else { return }
            program.days[index].restDoneInCycle = done ? program.currentCycle : nil
        }
    }

    /// The "Go to..." sheet: jump to any cycle, the deload included.
    func goToCycle(_ cycle: Int, in programID: UUID) {
        editProgram(programID) { $0.currentCycle = min(max(cycle, 1), $0.totalCycles) }
    }

    #if DEBUG
    /// `-seedGeneratedProgram` generates a 3x Full Body program and activates it, for driving the screens.
    static let seedGeneratedProgramArgument = "-seedGeneratedProgram"

    func seedGeneratedProgramIfRequested(catalog: ExerciseCatalog) {
        guard ProcessInfo.processInfo.arguments.contains(Self.seedGeneratedProgramArgument) else { return }
        let exercises = catalog.bundled
        let equipment = catalog.equipment
        write { db in
            guard try Program.fetchCount(db) == 0 else { return }
            let inputs = GeneratorInputs(goal: .hypertrophy, daysPerWeek: 3, split: .fullBody, sessionLength: .from40To60, repProgression: .noPreference, deload: true, experience: .intermediate)
            var profile = ProfileSettings()
            profile.assessment = ["benchPress10": AssessmentQuestion.yes, "overheadPress10": AssessmentQuestion.yes, "inclinePress10": AssessmentQuestion.yes]
            var rng = SystemRandomNumberGenerator()
            let generated = ProgramGenerator.generate(inputs, profile: profile, catalog: exercises, equipment: equipment, gym: nil, using: &rng)
            var program = generated.program
            program.isActive = true
            try program.insert(db)
            for template in generated.templates { try template.insert(db) }
        }
    }
    #endif

    /// Adds a workout day with an empty template, or a rest day, at the end of the cycle.
    func addProgramDay(to programID: UUID, rest: Bool, name: String, gymID: UUID?) {
        write { db in
            guard let existing = try Program.fetchOne(db, key: Program.key(programID)) else { return }
            var program = existing
            if rest {
                program.days.append(ProgramDay())
            } else {
                var template = WorkoutTemplate(name: name)
                template.programID = programID
                template.gymID = gymID
                try template.insert(db)
                program.days.append(ProgramDay(templateID: template.id))
            }
            program.updatedAt = .now
            try program.updateChanges(db, from: existing)
        }
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
            program.updatedAt = .now
            try program.updateChanges(db, from: existing)
        }
    }

    /// Turns a workout day into a rest day, deleting its template, or a rest day into a workout day with a new one.
    func toggleRestDay(_ dayID: ProgramDay.ID, in programID: UUID, name: String, gymID: UUID?) {
        write { db in
            guard let existing = try Program.fetchOne(db, key: Program.key(programID)),
                  let index = existing.days.firstIndex(where: { $0.id == dayID }) else { return }
            var program = existing
            if let templateID = program.days[index].templateID {
                _ = try WorkoutTemplate.deleteOne(db, key: WorkoutTemplate.key(templateID))
                program.days[index].templateID = nil
            } else {
                var template = WorkoutTemplate(name: name)
                template.programID = programID
                template.gymID = gymID
                try template.insert(db)
                program.days[index].templateID = template.id
            }
            program.updatedAt = .now
            try program.updateChanges(db, from: existing)
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
                var template = WorkoutTemplate(name: ProgramDayName.duplicate(of: source.name, taken: taken), notes: source.notes, blocks: source.blocks.copyingCycleTargets())
                template.programID = programID
                template.gymID = source.gymID
                try template.insert(db)
                day.templateID = template.id
            }
            program.days.append(day)
            program.updatedAt = .now
            try program.updateChanges(db, from: existing)
        }
    }

    /// Starts a program day as a session of the current cycle, through the one-session-at-a-time prompt.
    func startProgramDay(_ program: Program, template: WorkoutTemplate, presenter: LiveWorkoutPresenter) {
        guard let day = program.day(for: template.id) else { return }
        presenter.startOrResume({ program.session(startingFrom: template, dayID: day.id, gymID: template.gymID) }, in: self)
    }

    /// "Update Workout Plan" on finishing: a library workout takes the session's plan whole; a program day merges it
    /// into its week (`ProgramPlanUpdate`).
    func updateWorkoutPlan(_ templateID: UUID, from session: WorkoutSession) {
        write { db in
            guard let existing = try WorkoutTemplate.fetchOne(db, key: WorkoutTemplate.key(templateID)) else { return }
            var template = existing
            if let position = session.program, let program = try Program.fetchOne(db, key: Program.key(position.programID)) {
                template.blocks = ProgramPlanUpdate.blocks(of: existing, updatedBy: session, program: program)
            } else {
                template.blocks = SessionFlow.plan(from: session.blocks)
            }
            template.updatedAt = .now
            try template.updateChanges(db, from: existing)
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
            changed.currentCycle = next
            if next == 1 {
                changed.config.runStartedAt = .now
                for index in changed.days.indices { changed.days[index].restDoneInCycle = nil }
            }
            changed.updatedAt = .now
            try changed.updateChanges(db, from: program)
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
