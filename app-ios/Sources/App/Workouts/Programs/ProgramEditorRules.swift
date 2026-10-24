import Foundation

/// Which weeks a targets save writes, from the week it was opened on: the Saving Options' Cycle Settings.
enum CycleScope: CaseIterable, Hashable {
    case thisWeek, thisAndLater, all

    func weeks(from week: Int, of count: Int) -> ClosedRange<Int> {
        switch self {
        case .thisWeek: week...week
        case .thisAndLater: week...max(week, count)
        case .all: 1...max(count, 1)
        }
    }
}

/// Which exercises a targets save writes: the Saving Options' Exercise Settings.
enum ExerciseScope: CaseIterable, Hashable {
    case thisExercise, day, program
}

/// One save from the week targets sheet: the sets and Skip Exercise of `exerciseID` in week `week`.
struct WeekTargetsEdit {
    var exerciseID: BlockExercise.ID
    var week: Int
    var sets: [WorkoutSet]
    var skip: Bool
}

/// Save is this week and this exercise, Save To All Weeks every week of this exercise, and More Options any pair.
struct SavingScope: Hashable {
    var cycles = CycleScope.thisWeek
    var exercises = ExerciseScope.thisExercise

    static let allWeeks = SavingScope(cycles: .all)

    /// Writes `edit` into one template's blocks. `isSourceDay` says whether the edited exercise lives in them. The
    /// edited exercise takes the sets whole; another exercise in scope takes their count, reps, and RIR onto its own
    /// sets, keeping its set types and weights. Without periodization there are no weeks, so the sets become the plain
    /// sets and Skip does not apply.
    func apply(_ edit: WeekTargetsEdit, to blocks: [WorkoutBlock], isSourceDay: Bool, weeks: Int, periodized: Bool) -> [WorkoutBlock] {
        let inScope: (BlockExercise) -> Bool = switch exercises {
        case .thisExercise: { $0.id == edit.exerciseID }
        case .day: { _ in isSourceDay }
        case .program: { _ in true }
        }
        let range = cycles.weeks(from: edit.week, of: weeks)
        return blocks.map { block in
            var block = block
            for index in block.exercises.indices where inScope(block.exercises[index]) {
                let isSource = block.exercises[index].id == edit.exerciseID
                block.exercises[index].write(edit, weeks: periodized ? range : nil, of: weeks, whole: isSource)
            }
            return block
        }
    }
}

private extension BlockExercise {
    mutating func write(_ edit: WeekTargetsEdit, weeks range: ClosedRange<Int>?, of count: Int, whole: Bool) {
        guard let range else {
            sets = whole ? edit.sets : sets.takingTargets(of: edit.sets)
            return
        }
        for week in range {
            let current = cycleTargets?[safe: week - 1]?.sets ?? sets
            let written = whole ? edit.sets.map { $0.copyingTargets() } : current.takingTargets(of: edit.sets)
            setWeekTargets(written, week: week, weeks: count)
            setSkipped(edit.skip, week: week, weeks: count)
        }
    }
}

extension [WorkoutSet] {
    /// This exercise's sets resized to `source`'s count, each taking `source`'s reps and RIR. A new set copies the
    /// last one.
    func takingTargets(of source: [WorkoutSet]) -> [WorkoutSet] {
        source.indices.map { index in
            var set = indices.contains(index) ? self[index].copyingTargets() : (last?.copyingTargets() ?? WorkoutSet())
            var targets = set.targets
            targets.repsMin = source[index].target?.repsMin
            targets.repsMax = source[index].target?.repsMax
            targets.rir = source[index].target?.rir
            set.targets = targets
            return set
        }
    }
}

/// One card in an exercise's row in the program editor.
struct WeekCard: Hashable, Identifiable {
    /// The cycle whose sets the card shows: for the single card of an unperiodized program, week 1's.
    var cycle: Int
    var title: String
    var isDeload: Bool

    var id: Int { cycle }
}

/// The program editor's pure rules: which cards an exercise shows, the Target Muscles averages, and the program-wide
/// rewrites Program Settings makes.
enum ProgramEditorRules {
    /// "Week 1" to "Week N" with the Deload card where the deload falls, or one "N Weeks" card plus the Deload card when
    /// periodization is off.
    static func cards(of program: Program) -> [WeekCard] {
        let deloadCycle = (1...program.totalCycles).first(where: program.isDeloadCycle)
        let deload = deloadCycle.map { WeekCard(cycle: $0, title: "Deload", isDeload: true) }
        guard program.config.periodization else {
            let firstWeek = program.config.deload == .firstCycle ? 2 : 1
            let noun = program.cycles == 1 ? program.cycleNoun : "\(program.cycleNoun)s"
            let single = WeekCard(cycle: firstWeek, title: "\(program.cycles) \(noun)", isDeload: false)
            return program.config.deload == .firstCycle ? [deload, single].compactMap { $0 } : [single, deload].compactMap { $0 }
        }
        return (1...program.totalCycles).map { cycle in
            WeekCard(cycle: cycle, title: program.cycleLabel(cycle), isDeload: program.isDeloadCycle(cycle))
        }
    }

    /// Sets per muscle averaged over every cycle the program runs, the deload included, summed over `templates`: one
    /// template for the Day toggle, every workout day for Week.
    static func averageMuscleSets(program: Program, templates: [WorkoutTemplate], exercise: (ExerciseID) -> Exercise?) -> [Muscle: Double] {
        let cycles = 1...program.totalCycles
        var total: [Muscle: Double] = [:]
        for template in templates {
            for cycle in cycles {
                let resolved = program.blocks(of: template, cycle: cycle)
                for (muscle, sets) in WorkoutMetrics.muscleSets(in: resolved, catalog: exercise, loggedOnly: false) {
                    total[muscle, default: 0] += sets
                }
            }
        }
        return total.mapValues { $0 / Double(cycles.count) }
    }

    /// Number of Weeks: a new week repeats the last week's targets, and a removed week drops the last one. An exercise
    /// without cycle targets uses its plain sets every week and stays as it is.
    static func settingWeeks(_ count: Int, from old: Int, in blocks: [WorkoutBlock]) -> [WorkoutBlock] {
        let count = max(count, 1)
        return blocks.map { block in
            var block = block
            for index in block.exercises.indices {
                guard var targets = block.exercises[index].cycleTargets else { continue }
                let plain = block.exercises[index].sets
                targets = Array(targets.prefix(old))
                while targets.count < old { targets.append(CycleTargets(sets: plain.map { $0.copyingTargets() })) }
                if count < targets.count {
                    targets = Array(targets.prefix(count))
                } else if let last = targets.last {
                    while targets.count < count { targets.append(CycleTargets(sets: last.sets.map { $0.copyingTargets() }, skip: last.skip)) }
                }
                block.exercises[index].cycleTargets = targets
            }
            return block
        }
    }

    /// Turning periodization off: week 1's targets become every week's. MF warns it cannot be undone.
    static func collapsingPeriodization(_ blocks: [WorkoutBlock]) -> [WorkoutBlock] {
        blocks.map { block in
            var block = block
            for index in block.exercises.indices {
                if let first = block.exercises[index].cycleTargets?.first { block.exercises[index].sets = first.sets }
                block.exercises[index].cycleTargets = nil
            }
            return block
        }
    }

    /// Day Order's Save: the days in `order`, with any day another device added meanwhile kept at the end.
    static func reordering(_ days: [ProgramDay], by order: [ProgramDay.ID]) -> [ProgramDay] {
        let placed = order.compactMap { id in days.first { $0.id == id } }
        return placed + days.filter { !order.contains($0.id) }
    }

    /// "Workout A" to "Workout Z" for a new workout day: the first letter no day uses.
    static func nextWorkoutName(taken: [String]) -> String {
        let letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".map(String.init)
        let name = letters.lazy.map { "Workout \($0)" }.first { !taken.contains($0) }
        return name ?? "Workout \(taken.count + 1)"
    }
}
