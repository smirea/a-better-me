import Foundation

/// How a program's cycles map onto an exercise's targets. `cycleTargets` holds the training weeks, index 0 for week 1.
/// The deload is never stored: it is derived from the week next to it, so toggling Deload in Program Settings or
/// building a program from scratch needs no rewrite.
extension Program {
    /// The training weeks plus the deload cycle when there is one.
    var totalCycles: Int { cycles + (config.deload == .none ? 0 : 1) }

    func isDeloadCycle(_ cycle: Int) -> Bool {
        switch config.deload {
        case .none: false
        case .firstCycle: cycle == 1
        case .lastCycle: cycle == cycles + 1
        }
    }

    /// The training week a cycle number trains, or `nil` for the deload cycle.
    func week(ofCycle cycle: Int) -> Int? {
        if isDeloadCycle(cycle) { return nil }
        return config.deload == .firstCycle ? cycle - 1 : cycle
    }

    /// Seven days make a weekly program, which the UI calls weeks; any other length is a cycle.
    var isWeekly: Bool { days.count == 7 }

    var cycleNoun: String { isWeekly ? "Week" : "Cycle" }

    /// "Week 3", "Cycle 3", or "Deload".
    func cycleLabel(_ cycle: Int) -> String {
        week(ofCycle: cycle).map { "\(cycleNoun) \($0)" } ?? "Deload"
    }

    /// The finished sessions of this program's current run and cycle. Day and cycle ids repeat across runs, so the run
    /// boundary is what keeps a reactivated or wrapped program from counting last run's sessions.
    func sessions(ofCurrentCycle finished: [WorkoutSession]) -> [WorkoutSession] {
        let since = config.runStartedAt ?? .distantPast
        return finished.filter {
            $0.endedAt != nil && $0.program?.programID == id && $0.program?.cycle == currentCycle && $0.startedAt >= since
        }
    }

    /// The days with a finished session in the current run and cycle. It reads only the history and `runCycle`, so
    /// screens memoize it on that key.
    func finishedDayIDs(_ finished: [WorkoutSession]) -> Set<ProgramDay.ID> {
        Set(sessions(ofCurrentCycle: finished).compactMap { $0.program?.dayID })
    }

    var runCycle: RunCycle { RunCycle(programID: id, cycle: currentCycle, runStartedAt: config.runStartedAt) }

    struct RunCycle: Hashable {
        let programID: UUID
        let cycle: Int
        let runStartedAt: Date?
    }

    /// A workout day is done once a session of it in the current cycle has finished; a rest day once it was ticked
    /// this cycle. `finished` is the finished-session history.
    func isDone(_ day: ProgramDay, finished: [WorkoutSession]) -> Bool {
        isDone(day, finishedDays: finishedDayIDs(finished))
    }

    func isDone(_ day: ProgramDay, finishedDays: Set<ProgramDay.ID>) -> Bool {
        guard day.templateID != nil else { return day.restDoneInCycle == currentCycle }
        return finishedDays.contains(day.id)
    }

    /// Up Next: the first day in order that is not done, rest days included (research spec milestone-2.md §2.3).
    func nextDay(finished: [WorkoutSession]) -> ProgramDay? {
        let finishedDays = finishedDayIDs(finished)
        return days.first { !isDone($0, finishedDays: finishedDays) }
    }

    /// The sets `item` trains in `cycle`, or `nil` when the exercise is skipped that cycle.
    func sets(of item: BlockExercise, cycle: Int) -> [WorkoutSet]? {
        guard let week = week(ofCycle: cycle) else {
            let neighbor = config.deload == .firstCycle ? 1 : cycles
            return weekSets(of: item, week: neighbor).map(DeloadRule.apply)
        }
        return weekSets(of: item, week: week)
    }

    /// Week `week` of `item`: its cycle targets when they reach that far, else its plain sets.
    func weekSets(of item: BlockExercise, week: Int) -> [WorkoutSet]? {
        guard let targets = item.cycleTargets, let entry = targets[safe: week - 1] else { return item.sets }
        return entry.skip ? nil : entry.sets
    }

    /// A template's blocks with `cycle` resolved: cycle targets swapped in, skipped exercises dropped, the deload
    /// derived. What a session of that cycle starts from.
    func blocks(of template: WorkoutTemplate, cycle: Int) -> [WorkoutBlock] {
        template.blocks.compactMap { block in
            var block = block
            block.exercises = block.exercises.compactMap { item in
                guard let sets = sets(of: item, cycle: cycle) else { return nil }
                var item = item
                item.sets = sets
                item.cycleTargets = nil
                return item
            }
            return block.exercises.isEmpty ? nil : block
        }
    }

    /// Starts `template` as day `dayID` of this program's current cycle.
    func session(startingFrom template: WorkoutTemplate, dayID: ProgramDay.ID, gymID: UUID?) -> WorkoutSession {
        var resolved = template
        resolved.blocks = blocks(of: template, cycle: currentCycle)
        return WorkoutSession(startingFrom: resolved, at: ProgramPosition(programID: id, dayID: dayID, cycle: currentCycle), gymID: gymID ?? template.gymID)
    }

    var workoutDays: [ProgramDay] { days.filter { $0.templateID != nil } }

    /// The week strip's progress arc: the workout days done in the current cycle and run over the cycle's workout days.
    /// Rest days count for nothing, as they do for the advance.
    func cycleProgress(finishedDays: Set<ProgramDay.ID>) -> Double {
        let workoutDays = workoutDays
        guard !workoutDays.isEmpty else { return 0 }
        return Double(workoutDays.count { finishedDays.contains($0.id) }) / Double(workoutDays.count)
    }

    /// For a seven-day program, the program day `date` falls on: Day 1 on the weekday the current run started, the
    /// program's creation when it has no run yet. `nil` for any other length, which keeps rolling by day order.
    func weekdayDay(on date: Date, calendar: Calendar) -> ProgramDay? {
        guard isWeekly else { return nil }
        let start = calendar.startOfDay(for: config.runStartedAt ?? createdAt)
        let offset = calendar.dateComponents([.day], from: start, to: calendar.startOfDay(for: date)).day ?? 0
        return days[(offset % 7 + 7) % 7]
    }

    func day(for templateID: UUID) -> ProgramDay? { days.first { $0.templateID == templateID } }
}

extension BlockExercise {
    /// Writes `sets` as week `week`'s targets, growing `cycleTargets` from the plain sets when it is shorter.
    mutating func setWeekTargets(_ sets: [WorkoutSet], week: Int, weeks: Int) {
        var targets = cycleTargets ?? []
        while targets.count < max(weeks, week) { targets.append(CycleTargets(sets: targets.last?.sets ?? self.sets)) }
        targets[week - 1].sets = sets
        cycleTargets = targets
        if week == 1 { self.sets = sets }
    }

    mutating func setSkipped(_ skipped: Bool, week: Int, weeks: Int) {
        var targets = cycleTargets ?? []
        while targets.count < max(weeks, week) { targets.append(CycleTargets(sets: targets.last?.sets ?? sets)) }
        targets[week - 1].skip = skipped
        cycleTargets = targets
    }
}

/// When a finished program session moves the program to its next cycle: once every workout day of the current cycle
/// has a finished session, the cycle after it, wrapping to cycle 1 after the last one.
enum ProgramAdvance {
    static func cycle(after session: WorkoutSession, program: Program, finished: [WorkoutSession]) -> Int? {
        guard let position = session.program, position.programID == program.id, position.cycle == program.currentCycle else { return nil }
        let done = program.finishedDayIDs(finished + [session])
        let required = Set(program.workoutDays.map(\.id))
        guard !required.isEmpty, required.isSubset(of: done) else { return nil }
        return program.currentCycle >= program.totalCycles ? 1 : program.currentCycle + 1
    }
}

/// "Update Workout Plan" for a program session: the session's sets become that week's targets, an exercise the
/// session dropped is skipped that week, and an exercise it added joins the template for every week. Other weeks
/// stay as they were. A deload session changes nothing, because the deload derives from its neighbor week.
enum ProgramPlanUpdate {
    static func blocks(of template: WorkoutTemplate, updatedBy session: WorkoutSession, program: Program) -> [WorkoutBlock] {
        guard let position = session.program else { return template.blocks }
        return blocks(of: template, plan: SessionFlow.plan(from: session.blocks), position: position, program: program)
    }

    /// `plan` is the session's blocks already reduced to a plan (logs stripped, undone changes reverted).
    static func blocks(of template: WorkoutTemplate, plan: [WorkoutBlock], position: ProgramPosition, program: Program) -> [WorkoutBlock] {
        guard let week = program.week(ofCycle: position.cycle) else { return template.blocks }
        let plan = plan.flatMap(\.exercises)
        let planned = Dictionary(plan.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        let periodized = program.config.periodization
        var blocks = template.blocks
        for b in blocks.indices {
            for e in blocks[b].exercises.indices {
                let id = blocks[b].exercises[e].id
                if let item = planned[id] {
                    blocks[b].exercises[e].restSeconds = item.restSeconds
                    if periodized {
                        blocks[b].exercises[e].setWeekTargets(item.sets, week: week, weeks: program.cycles)
                        blocks[b].exercises[e].setSkipped(false, week: week, weeks: program.cycles)
                    } else {
                        blocks[b].exercises[e].sets = item.sets
                    }
                } else if periodized {
                    blocks[b].exercises[e].setSkipped(true, week: week, weeks: program.cycles)
                }
            }
        }
        let known = Set(blocks.flatMap(\.exercises).map(\.id))
        for item in plan where !known.contains(item.id) {
            var added = item
            added.note = nil
            blocks.append(WorkoutBlock(exercises: [added]))
        }
        return blocks
    }
}
