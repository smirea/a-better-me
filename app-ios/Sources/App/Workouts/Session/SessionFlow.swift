import Foundation

/// The numbers a set row shows and logs, before it becomes a `SetLog`. Weights are kilograms, like the model.
struct SetEntry: Hashable {
    var weightKg: Double?
    var reps: Int?
    var rir: Int?
    var durationSeconds: Int?
    var distanceMeters: Double?

    init(weightKg: Double? = nil, reps: Int? = nil, rir: Int? = nil, durationSeconds: Int? = nil, distanceMeters: Double? = nil) {
        self.weightKg = weightKg
        self.reps = reps
        self.rir = rir
        self.durationSeconds = durationSeconds
        self.distanceMeters = distanceMeters
    }

    init(_ log: SetLog) {
        self.init(weightKg: log.weightKg, reps: log.reps, rir: log.rir, durationSeconds: log.durationSeconds, distanceMeters: log.distanceMeters)
    }

    var isEmpty: Bool { weightKg == nil && reps == nil && durationSeconds == nil && distanceMeters == nil }

    func log(at date: Date) -> SetLog {
        SetLog(weightKg: weightKg, reps: reps, rir: rir, durationSeconds: durationSeconds, distanceMeters: distanceMeters, completedAt: date)
    }

    /// "Previous values" initial fill: last time's numbers for this row, else its targets. RIR comes from the target
    /// first while RIR Tracking populates it from the plan, else from the previous log. A target weight is a planned
    /// load, such as a calculated warm-up, so it beats the previous log.
    static func prefill(target: SetTarget?, previous: SetLog?, rirTracking: Bool) -> SetEntry {
        let rir = rirTracking ? (target?.rir ?? previous?.rir) : (previous?.rir ?? target?.rir)
        if let weightKg = target?.weightKg {
            return SetEntry(weightKg: weightKg, reps: target?.repsMax ?? target?.repsMin, rir: rir)
        }
        return SetEntry(
            weightKg: previous?.weightKg ?? target?.weightKg,
            reps: previous?.reps ?? target?.repsMax ?? target?.repsMin,
            rir: rir,
            durationSeconds: previous?.durationSeconds ?? target?.durationSeconds,
            distanceMeters: previous?.distanceMeters
        )
    }
}

extension WorkoutSet {
    /// The main row and every drop or myo sub-row are logged.
    var isDone: Bool { isCompleted && subSets.allSatisfy { $0.log != nil } }

    /// The set as a plan: targets and structure without anything lifted.
    var planned: WorkoutSet {
        var set = self
        set.log = nil
        set.subSets = subSets.map { SubSet(id: $0.id, target: $0.target) }
        return set
    }
}

extension BlockExercise {
    var isDone: Bool { !sets.isEmpty && sets.allSatisfy(\.isDone) }
    var hasLoggedSets: Bool { sets.contains(where: \.isCompleted) }
}

/// A row in the set table: a set's main row, or one of its drop or myo sub-rows.
struct RowPath: Hashable {
    var block: Int
    var exercise: Int
    var set: Int
    var sub: Int?
}

/// The live workout's rules for rest and moving between exercises, apart from the views.
enum SessionFlow {
    struct Step: Equatable {
        var restSeconds: Int?
        /// The exercise the screen moves to, or `nil` to stay.
        var next: BlockExercise.ID?
    }

    /// What follows checking the row at `path` in `blocks`, which already holds the new log. `rest` resolves the full
    /// rest for a set before scaling; `settings` decides whether and how much of it runs, and where the screen goes.
    static func afterCompleting(_ path: RowPath, in blocks: [WorkoutBlock], settings: WorkoutSettings, rest: (BlockExercise, WorkoutSet) -> Int) -> Step {
        let block = blocks[path.block]
        let item = block.exercises[path.exercise]
        let set = item.sets[path.set]
        // A drop or myo set rests only after its last sub-row, so the drops follow the main row without a timer.
        if set.type.hasSubSets, (path.sub ?? -1) < set.subSets.count - 1 { return Step() }

        func timer(_ seconds: Int?) -> Int? { settings.rest.enabled ? seconds : nil }

        if block.isSuperset {
            let laterMember = block.exercises.dropFirst(path.exercise + 1).first {
                $0.sets.indices.contains(path.set) && !$0.sets[path.set].isDone
            }
            if let laterMember { return Step(next: settings.supersetAutoScroll ? laterMember.id : nil) }
            if let first = block.exercises.first(where: { !$0.isDone }) {
                let seconds = scaledRest(after: path.set, in: item, settings: settings.rest, rest: rest)
                return Step(restSeconds: timer(seconds), next: settings.supersetAutoScroll ? first.id : nil)
            }
        } else if !item.isDone {
            return Step(restSeconds: timer(scaledRest(after: path.set, in: item, settings: settings.rest, rest: rest)))
        }
        let between = settings.rest.betweenExercises ? scaled(rest(item, set), percent: settings.rest.scaling.betweenExercises) : nil
        return Step(restSeconds: timer(between), next: settings.exerciseAutoNext ? nextIncomplete(after: path.block, in: blocks) : nil)
    }

    /// Warm-ups run back to back; the last one rests its scaled share of the working rest, or not at all.
    private static func scaledRest(after index: Int, in item: BlockExercise, settings: RestSettings, rest: (BlockExercise, WorkoutSet) -> Int) -> Int? {
        let set = item.sets[index]
        let seconds = rest(item, set)
        guard set.type == .warmUp else { return seconds }
        if item.sets[safe: index + 1]?.type == .warmUp { return nil }
        return settings.afterLastWarmUp ? scaled(seconds, percent: settings.scaling.afterLastWarmUp) : nil
    }

    private static func scaled(_ seconds: Int, percent: Int) -> Int {
        Int((Double(seconds) * Double(percent) / 100).rounded(.down))
    }

    /// The first unfinished exercise after `block`, wrapping around to the start.
    static func nextIncomplete(after block: Int, in blocks: [WorkoutBlock]) -> BlockExercise.ID? {
        let order = Array(blocks.indices.dropFirst(block + 1)) + Array(blocks.indices.prefix(block + 1))
        for index in order {
            if let item = blocks[index].exercises.first(where: { !$0.isDone && !$0.sets.isEmpty }) { return item.id }
        }
        return nil
    }

    /// Where a reopened workout starts: the first unfinished exercise.
    static func initialExercise(in blocks: [WorkoutBlock]) -> BlockExercise.ID? {
        blocks.flatMap(\.exercises).first { !$0.isDone }?.id ?? blocks.first?.exercises.first?.id
    }

    /// "Set 3 of 3", or "Superset 1 of 2 • Round 1 of 3".
    static func subtitle(for path: (block: Int, exercise: Int), in blocks: [WorkoutBlock]) -> String {
        let block = blocks[path.block]
        let item = block.exercises[path.exercise]
        let position = (item.sets.firstIndex { !$0.isDone } ?? item.sets.count - 1) + 1
        guard block.isSuperset else {
            return item.sets.isEmpty ? "No sets" : "Set \(position) of \(item.sets.count)"
        }
        let rounds = block.exercises.map(\.sets.count).max() ?? 0
        let kind = block.exercises.count > 2 ? "Circuit" : "Superset"
        return "\(kind) \(path.exercise + 1) of \(block.exercises.count) • Round \(max(1, position)) of \(rounds)"
    }

    /// The sets of the last logged performance of `exerciseID`. `history` holds past sessions' blocks, newest first.
    static func previousSets(of exerciseID: ExerciseID, in history: [[WorkoutBlock]]) -> [WorkoutSet] {
        for blocks in history {
            if let item = blocks.flatMap(\.exercises).first(where: { $0.exerciseID == exerciseID && $0.hasLoggedSets }) {
                return item.sets
            }
        }
        return []
    }

    /// "Log All Sets": every unlogged row that has numbers is logged with them. Rows with nothing to log stay open.
    static func logAll(_ blocks: [WorkoutBlock], at date: Date, entry: (UUID) -> SetEntry) -> [WorkoutBlock] {
        var blocks = blocks
        for b in blocks.indices {
            for e in blocks[b].exercises.indices {
                for s in blocks[b].exercises[e].sets.indices {
                    var set = blocks[b].exercises[e].sets[s]
                    let value = entry(set.id)
                    if set.log == nil, !value.isEmpty { set.log = value.log(at: date) }
                    for i in set.subSets.indices where set.subSets[i].log == nil {
                        let value = entry(set.subSets[i].id)
                        if !value.isEmpty { set.subSets[i].log = value.log(at: date) }
                    }
                    blocks[b].exercises[e].sets[s] = set
                }
            }
        }
        return blocks
    }

    /// "Update Workout Plan": the session's structure and targets without its logs.
    static func plan(from blocks: [WorkoutBlock]) -> [WorkoutBlock] {
        blocks.map { block in
            var block = block
            block.exercises = block.exercises.map { item in
                var item = item
                item.sets = item.sets.map(\.planned)
                return item
            }
            return block
        }
    }

    static func loggedExerciseCount(in blocks: [WorkoutBlock]) -> (logged: Int, total: Int) {
        let items = blocks.flatMap(\.exercises)
        return (items.count(where: \.hasLoggedSets), items.count)
    }
}

extension [WorkoutBlock] {
    func contains(_ path: RowPath) -> Bool {
        guard let item = self[safe: path.block]?.exercises[safe: path.exercise], let set = item.sets[safe: path.set] else { return false }
        return path.sub.map { set.subSets.indices.contains($0) } ?? true
    }

    func rowID(at path: RowPath) -> UUID {
        let set = self[path.block].exercises[path.exercise].sets[path.set]
        return path.sub.map { set.subSets[$0].id } ?? set.id
    }

    func log(at path: RowPath) -> SetLog? {
        let set = self[path.block].exercises[path.exercise].sets[path.set]
        return path.sub.map { set.subSets[$0].log } ?? set.log
    }

    func target(at path: RowPath) -> SetTarget? {
        let set = self[path.block].exercises[path.exercise].sets[path.set]
        return path.sub.map { set.subSets[$0].target } ?? set.target
    }

    mutating func setLog(_ log: SetLog?, at path: RowPath) {
        if let sub = path.sub {
            self[path.block].exercises[path.exercise].sets[path.set].subSets[sub].log = log
        } else {
            self[path.block].exercises[path.exercise].sets[path.set].log = log
        }
    }

    /// Every row of one exercise in table order: each set's main row followed by its sub-rows.
    func rows(block: Int, exercise: Int) -> [RowPath] {
        self[block].exercises[exercise].sets.enumerated().flatMap { index, set in
            [RowPath(block: block, exercise: exercise, set: index)]
                + set.subSets.indices.map { RowPath(block: block, exercise: exercise, set: index, sub: $0) }
        }
    }
}

extension SessionFlow {
    /// The log of the matching row in the last performance.
    static func previousLog(for path: RowPath, in blocks: [WorkoutBlock], previous: [WorkoutSet]) -> SetLog? {
        guard let set = blocks[path.block].exercises[path.exercise].sets.previousSet(at: path.set, in: previous) else { return nil }
        guard let sub = path.sub else { return set.log }
        return set.subSets[safe: sub]?.log
    }

    /// The initial fill of one row: the Smart Progression suggestion when there is one, else Previous values.
    static func prefill(for path: RowPath, in blocks: [WorkoutBlock], previous: [WorkoutSet], suggestion: SetSuggestion?, rirTracking: Bool, unit: WeightUnit) -> SetEntry {
        var entry = SetEntry.prefill(target: blocks.target(at: path), previous: previousLog(for: path, in: blocks, previous: previous), rirTracking: rirTracking)
        if let suggestion {
            entry.weightKg = suggestion.prefill.weight.map(unit.toKg)
            entry.reps = suggestion.prefill.reps
            entry.rir = suggestion.prefill.rir
        }
        return entry
    }

    /// The prefilled values of every row, for "Log All Sets".
    static func prefills(for blocks: [WorkoutBlock], history: [[WorkoutBlock]], suggestions: [BlockExercise.ID: [UUID: SetSuggestion]], rirTracking: Bool, unit: WeightUnit) -> [UUID: SetEntry] {
        var values: [UUID: SetEntry] = [:]
        for (b, block) in blocks.enumerated() {
            for (e, item) in block.exercises.enumerated() {
                let previous = previousSets(of: item.exerciseID, in: history)
                for path in blocks.rows(block: b, exercise: e) {
                    let id = blocks.rowID(at: path)
                    values[id] = prefill(for: path, in: blocks, previous: previous, suggestion: suggestions[item.id]?[id], rirTracking: rirTracking, unit: unit)
                }
            }
        }
        return values
    }
}

/// What the Warm Up sheet and Warm-Up Automation calculate from: the first working set as it would be logged, the
/// exercise's scheme and automation (override else global), and whether its muscles are still fresh this session.
struct WarmUpContext: Hashable {
    var workingWeightKg: Double?
    var reps: Int?
    var rir: Int?
    var isFresh = true
    var scheme = WarmUpStep.standard
    var automation = WarmUpAutomation.smart
    var simplifyPlates = true
}

enum WarmUpMode: Hashable {
    case smart, scheme
}

/// One calculated warm-up: "40% of 1-RM" or "40% of working weight", in kilograms like the model.
struct WarmUpRow: Hashable {
    var label: String
    var weightKg: Double
    var reps: Int
}

extension SessionFlow {
    static func warmUps(_ context: WarmUpContext, mode: WarmUpMode, unit: WeightUnit) -> [WarmUpRow] {
        guard let workingWeightKg = context.workingWeightKg, workingWeightKg > 0 else { return [] }
        let working = unit.fromKg(workingWeightKg)
        let increment = WarmUpScheme.increment(for: unit)
        switch mode {
        case .smart:
            let steps = SmartWarmUp.steps(
                workingWeight: working, reps: context.reps ?? 1, rir: context.rir, increment: increment, unit: unit,
                isFresh: context.isFresh, simplifyPlates: context.simplifyPlates
            )
            return steps.map { WarmUpRow(label: "\($0.percent)% of 1-RM", weightKg: unit.toKg($0.weight), reps: $0.reps) }
        case .scheme:
            let steps = WarmUpScheme.sets(workingWeight: working, increment: increment, steps: context.scheme)
            return steps.map { WarmUpRow(label: "\($0.percent)% of working weight", weightKg: unit.toKg($0.weight), reps: $0.reps) }
        }
    }
}
