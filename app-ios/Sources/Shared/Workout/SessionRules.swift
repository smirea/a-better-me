import Foundation

/// The parts of Workout settings that decide what follows a logged set, so the watch can run a workout with the
/// phone's rules.
struct FlowRules: Codable, Hashable, Sendable {
    var rest = RestSettings()
    var supersetAutoScroll = true
    var exerciseAutoNext = true
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
    static func afterCompleting(_ path: RowPath, in blocks: [WorkoutBlock], settings: FlowRules, rest: (BlockExercise, WorkoutSet) -> Int) -> Step {
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

    /// "Set 3 of 3", or "Superset 1 of 2 • Round 1 of 3", for `set`, else the exercise's first open set.
    static func subtitle(for path: (block: Int, exercise: Int), set: Int? = nil, in blocks: [WorkoutBlock]) -> String {
        let block = blocks[path.block]
        let item = block.exercises[path.exercise]
        let position = (set ?? item.sets.firstIndex { !$0.isDone } ?? item.sets.count - 1) + 1
        guard block.isSuperset else {
            return item.sets.isEmpty ? "No sets" : "Set \(position) of \(item.sets.count)"
        }
        let rounds = block.exercises.map(\.sets.count).max() ?? 0
        let kind = block.exercises.count > 2 ? "Circuit" : "Superset"
        return "\(kind) \(path.exercise + 1) of \(block.exercises.count) • Round \(max(1, position)) of \(rounds)"
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

    func locate(_ id: BlockExercise.ID) -> (block: Int, item: Int)? {
        for (blockIndex, block) in enumerated() {
            if let item = block.exercises.firstIndex(where: { $0.id == id }) { return (blockIndex, item) }
        }
        return nil
    }

    var allRows: [RowPath] {
        indices.flatMap { b in self[b].exercises.indices.flatMap { rows(block: b, exercise: $0) } }
    }

    func path(of id: UUID) -> RowPath? {
        allRows.first { rowID(at: $0) == id }
    }

    /// "Add Set": a copy of the exercise's last working set without its log, with `id`. Nothing changes once a set
    /// with `id` exists, so adding twice adds once. A copied drop or myo set's sub-rows get ids derived from `id`, so
    /// the watch and the phone, replaying the same event, name the same rows.
    mutating func addSet(to exerciseID: BlockExercise.ID, id: UUID) {
        guard let at = locate(exerciseID), path(of: id) == nil else { return }
        let last = self[at.block].exercises[at.item].sets.last { $0.type != .warmUp }
        var set = last?.planned ?? WorkoutSet()
        set.id = id
        set.subSets = set.subSets.enumerated().map { SubSet(id: id.derived($0.offset), target: $0.element.target) }
        self[at.block].exercises[at.item].sets.append(set)
    }

    func firstOpenRow(block: Int, exercise: Int) -> RowPath? {
        rows(block: block, exercise: exercise).first { log(at: $0) == nil }
    }
}

extension SessionFlow {
    /// The row to log next: the current exercise's first open row, else the next unfinished exercise's.
    static func currentRow(in blocks: [WorkoutBlock], current: BlockExercise.ID?) -> RowPath? {
        let currentID = current ?? initialExercise(in: blocks)
        if let currentID, let at = blocks.locate(currentID), let row = blocks.firstOpenRow(block: at.block, exercise: at.item) {
            return row
        }
        let start = currentID.flatMap { blocks.locate($0)?.block } ?? -1
        guard let next = nextIncomplete(after: start, in: blocks), let at = blocks.locate(next) else { return nil }
        return blocks.firstOpenRow(block: at.block, exercise: at.item)
    }

    /// The row after `path` once it is logged, following the same rest and auto-scroll rules as checking it.
    static func upNext(after path: RowPath, in blocks: [WorkoutBlock], rules: FlowRules) -> RowPath? {
        var logged = blocks
        logged.setLog(SetLog(completedAt: .now), at: path)
        let step = afterCompleting(path, in: logged, settings: rules) { _, _ in 0 }
        let exerciseID = step.next ?? logged[path.block].exercises[path.exercise].id
        guard let at = logged.locate(exerciseID) else { return nil }
        return logged.firstOpenRow(block: at.block, exercise: at.item)
            ?? nextIncomplete(after: at.block, in: logged).flatMap { logged.locate($0) }.flatMap { logged.firstOpenRow(block: $0.block, exercise: $0.item) }
    }
}

extension SetTarget {
    /// "8–10 reps · 2 RIR", or nil when the set has no target.
    func summary(unit: WeightUnit) -> String? {
        let reps: String? = switch (repsMin, repsMax) {
        case let (min?, max?) where min != max: "\(min)–\(max) reps"
        case let (min?, _): "\(min) reps"
        case let (nil, max?): "\(max) reps"
        default: nil
        }
        let parts = [
            weightKg.map { "\(unit.format(kg: $0)) \(unit.rawValue)" },
            reps,
            durationSeconds.map { Duration.seconds($0).formatted(.time(pattern: .minuteSecond)) },
            rir.map { "\($0 >= 6 ? "6+" : "\($0)") RIR" },
        ].compactMap { $0 }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}

extension Array {
    subscript(safe index: Int) -> Element? { indices.contains(index) ? self[index] : nil }
}

extension UUID {
    /// The `index`th id that belongs to this one, the same on every device.
    func derived(_ index: Int) -> UUID {
        var bytes = uuid
        bytes.14 ^= 0xA5
        bytes.15 ^= UInt8(truncatingIfNeeded: index + 1)
        return UUID(uuid: bytes)
    }
}
