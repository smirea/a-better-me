import Foundation

/// The numbers a set row shows and logs, before it becomes a `SetLog`. Weights are kilograms, like the model.
struct SetEntry: Hashable {
    var weightKg: Double?
    var reps: Int?
    /// The F | P keypad's second count; volume and records ignore it.
    var partialReps: Int?
    var rir: Int?
    var durationSeconds: Int?
    var distanceMeters: Double?

    init(weightKg: Double? = nil, reps: Int? = nil, partialReps: Int? = nil, rir: Int? = nil, durationSeconds: Int? = nil, distanceMeters: Double? = nil) {
        self.weightKg = weightKg
        self.reps = reps
        self.partialReps = partialReps
        self.rir = rir
        self.durationSeconds = durationSeconds
        self.distanceMeters = distanceMeters
    }

    init(_ log: SetLog) {
        self.init(weightKg: log.weightKg, reps: log.reps, partialReps: log.partialReps, rir: log.rir, durationSeconds: log.durationSeconds, distanceMeters: log.distanceMeters)
    }

    var isEmpty: Bool { weightKg == nil && reps == nil && durationSeconds == nil && distanceMeters == nil }

    func log(at date: Date) -> SetLog {
        SetLog(weightKg: weightKg, reps: reps, partialReps: partialReps, rir: rir, durationSeconds: durationSeconds, distanceMeters: distanceMeters, completedAt: date)
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

extension SessionFlow {
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

    /// "Update Workout Plan" with View Changes' Undo: the undone kinds of change revert to `template`, so an undone
    /// modified exercise keeps the template's sets, an undone added one is dropped, an undone removed one comes back
    /// where the template had it, and an undone superset returns to the template's grouping. Logs are never touched.
    static func plan(from blocks: [WorkoutBlock], template: [WorkoutBlock], undoing undone: Set<WorkoutChanges.Kind>) -> [WorkoutBlock] {
        var plan = plan(from: blocks)
        guard !undone.isEmpty else { return plan }
        let changes = WorkoutChanges(before: template, after: plan)
        let templateItems = template.flatMap(\.exercises)
        let templateByID = Dictionary(uniqueKeysWithValues: templateItems.map { ($0.id, $0) })
        let templateOrder = Dictionary(uniqueKeysWithValues: templateItems.enumerated().map { ($1.id, $0) })

        if undone.contains(.modified) {
            let ids = Set(changes.modified.map(\.after.id))
            for b in plan.indices {
                for e in plan[b].exercises.indices where ids.contains(plan[b].exercises[e].id) {
                    plan[b].exercises[e] = templateByID[plan[b].exercises[e].id]!
                }
            }
        }
        var displaced: [BlockExercise] = []
        if undone.contains(.added) {
            let ids = Set(changes.added.map(\.id))
            for b in plan.indices { plan[b].exercises.removeAll { ids.contains($0.id) } }
        }
        if undone.contains(.regrouped) {
            let ids = Set(changes.regrouped.flatMap(\.exercises).map(\.id))
            for b in plan.indices {
                displaced += plan[b].exercises.filter { ids.contains($0.id) }
                plan[b].exercises.removeAll { ids.contains($0.id) }
            }
        }
        if undone.contains(.removed) { displaced += changes.removed }
        plan.removeAll { $0.exercises.isEmpty }

        for item in displaced.sorted(by: { templateOrder[$0.id] ?? .max < templateOrder[$1.id] ?? .max }) {
            guard let templateIndex = template.firstIndex(where: { $0.exercises.contains { $0.id == item.id } }) else {
                plan.append(WorkoutBlock(exercises: [item]))
                continue
            }
            let siblings = Set(template[templateIndex].exercises.map(\.id))
            if let b = plan.firstIndex(where: { $0.exercises.contains { siblings.contains($0.id) } }) {
                plan[b].exercises.append(item)
                plan[b].exercises.sort { templateOrder[$0.id] ?? .max < templateOrder[$1.id] ?? .max }
            } else {
                plan.insert(WorkoutBlock(id: template[templateIndex].id, exercises: [item]), at: min(templateIndex, plan.count))
            }
        }
        return plan
    }

    static func loggedExerciseCount(in blocks: [WorkoutBlock]) -> (logged: Int, total: Int) {
        let items = blocks.flatMap(\.exercises)
        return (items.count(where: \.hasLoggedSets), items.count)
    }
}

extension SessionFlow {
    /// Propagate Changes: the rows after `path` of its kind (main rows for a main row, sub-rows for a sub-row) that are
    /// still open and showed the value `path` had before the edit, so one typed weight or rep count carries forward.
    static func propagationTargets<Value: Equatable>(from path: RowPath, rows: [RowPath], isOpen: (RowPath) -> Bool, value: (RowPath) -> Value) -> [RowPath] {
        guard let index = rows.firstIndex(of: path) else { return [] }
        let edited = value(path)
        return rows[(index + 1)...].filter { (($0.sub == nil) == (path.sub == nil)) && isOpen($0) && value($0) == edited }
    }

    static func previousLog(for path: RowPath, in blocks: [WorkoutBlock], previous: [WorkoutSet]) -> SetLog? {
        guard let set = blocks[path.block].exercises[path.exercise].sets.previousSet(at: path.set, in: previous) else { return nil }
        guard let sub = path.sub else { return set.log }
        return set.subSets[safe: sub]?.log
    }

    /// What a row shows and logs: its log once checked, else what was typed, else the prefill. Smart Progression's
    /// suggestion fills it under the Smart Progression initial fill, or once Apply in session refilled the row.
    static func entry(
        for path: RowPath, in blocks: [WorkoutBlock], drafts: [UUID: SetEntry], previous: [WorkoutSet],
        suggestions: [BlockExercise.ID: [UUID: SetSuggestion]], appliedRows: Set<UUID>, settings: AppSettings
    ) -> SetEntry {
        if let log = blocks.log(at: path) { return SetEntry(log) }
        let id = blocks.rowID(at: path)
        if let draft = drafts[id] { return draft }
        let smartFill = settings.workout.progression.initialFill == .smartProgression || appliedRows.contains(id)
        let suggestion = smartFill ? suggestions[blocks[path.block].exercises[path.exercise].id]?[id] : nil
        return prefill(for: path, in: blocks, previous: previous, suggestion: suggestion, rirTracking: settings.workout.rirTracking, unit: settings.weightUnit)
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
/// exercise's scheme and automation (override else global), whether its muscles are still fresh this session, and
/// what its equipment loads in the session's gym.
struct WarmUpContext: Equatable {
    var loadable: LoadableWeights
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
        let loadable = context.simplifyPlates ? context.loadable.simplified : context.loadable
        switch mode {
        case .smart:
            let steps = SmartWarmUp.steps(workingWeight: working, reps: context.reps ?? 1, rir: context.rir, loadable: loadable, isFresh: context.isFresh)
            return steps.map { WarmUpRow(label: "\($0.percent)% of 1-RM", weightKg: unit.toKg($0.weight), reps: $0.reps) }
        case .scheme:
            let steps = WarmUpScheme.sets(workingWeight: working, loadable: loadable, steps: context.scheme)
            return steps.map { WarmUpRow(label: "\($0.percent)% of working weight", weightKg: unit.toKg($0.weight), reps: $0.reps) }
        }
    }
}
