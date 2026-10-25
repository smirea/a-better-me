import Foundation

enum Neighbor {
    case previous, next
}

/// Every structural edit the builder's menus make to a workout. Rows find their exercise by ID, because a reorder can
/// land between opening a menu and choosing an item.
extension [WorkoutBlock] {
    var exerciseCount: Int { reduce(0) { $0 + $1.exercises.count } }

    mutating func add(_ pick: ExercisePick) {
        let items = pick.exerciseIDs.map(BlockExercise.init(adding:))
        if pick.asSuperset, items.count > 1 {
            append(WorkoutBlock(exercises: items))
        } else {
            append(contentsOf: items.map { WorkoutBlock(exercises: [$0]) })
        }
    }

    mutating func add(_ exerciseIDs: [ExerciseID], toBlock blockID: WorkoutBlock.ID) {
        guard let index = firstIndex(where: { $0.id == blockID }) else { return }
        self[index].exercises += exerciseIDs.map(BlockExercise.init(adding:))
    }

    /// Keeps the sets and targets, as MF's Swap does: only the movement changes.
    mutating func swap(_ id: BlockExercise.ID, to exerciseID: ExerciseID) {
        guard let at = locate(id) else { return }
        self[at.block].exercises[at.item].exerciseID = exerciseID
    }

    mutating func remove(_ id: BlockExercise.ID) {
        guard let at = locate(id) else { return }
        self[at.block].exercises.remove(at: at.item)
        if self[at.block].exercises.isEmpty { remove(at: at.block) }
    }

    /// The copy lands right after the original: inside its superset, or as its own block when it stands alone. A
    /// program exercise's copy keeps its week targets.
    mutating func duplicate(_ id: BlockExercise.ID) {
        guard let at = locate(id) else { return }
        let original = self[at.block].exercises[at.item]
        var copy = original.copy()
        copy.cycleTargets = original.cycleTargets?.map { CycleTargets(sets: $0.sets.map { $0.copyingTargets() }, skip: $0.skip) }
        if self[at.block].isSuperset {
            self[at.block].exercises.insert(copy, at: at.item + 1)
        } else {
            insert(WorkoutBlock(exercises: [copy]), at: at.block + 1)
        }
    }

    /// Only a standalone exercise next to another block can join it.
    func canSuperset(_ id: BlockExercise.ID, with neighbor: Neighbor) -> Bool {
        guard let at = locate(id), !self[at.block].isSuperset else { return false }
        return indices.contains(neighbor == .previous ? at.block - 1 : at.block + 1)
    }

    mutating func superset(_ id: BlockExercise.ID, with neighbor: Neighbor) {
        guard canSuperset(id, with: neighbor), let at = locate(id) else { return }
        let item = self[at.block].exercises[0]
        switch neighbor {
        case .previous: self[at.block - 1].exercises.append(item)
        case .next: self[at.block + 1].exercises.insert(item, at: 0)
        }
        remove(at: at.block)
    }

    /// Takes one exercise out of its superset and places it on its own right after the group.
    mutating func detach(_ id: BlockExercise.ID) {
        guard let at = locate(id), self[at.block].isSuperset else { return }
        let item = self[at.block].exercises.remove(at: at.item)
        insert(WorkoutBlock(exercises: [item]), at: at.block + 1)
    }

    mutating func ungroup(_ blockID: WorkoutBlock.ID) {
        guard let index = firstIndex(where: { $0.id == blockID }) else { return }
        let singles = self[index].exercises.map { WorkoutBlock(exercises: [$0]) }
        replaceSubrange(index...index, with: singles)
    }

    mutating func removeBlock(_ blockID: WorkoutBlock.ID) {
        removeAll { $0.id == blockID }
    }

    func copy() -> [WorkoutBlock] {
        map { WorkoutBlock(exercises: $0.exercises.map { $0.copy() }) }
    }
}

extension BlockExercise {
    /// A freshly added exercise has one set with no target, as in the reference.
    init(adding exerciseID: ExerciseID) {
        self.init(exerciseID: exerciseID, sets: [WorkoutSet()])
    }

    func copy() -> BlockExercise {
        BlockExercise(exerciseID: exerciseID, sets: sets.map { $0.copyingTargets() }, restSeconds: restSeconds, note: note)
    }

}

extension WorkoutSet {
    /// What the Targets sheet's "+" adds: the same type, targets, and rest, without anything logged.
    func copyingTargets() -> WorkoutSet {
        WorkoutSet(type: type, target: target, restSeconds: restSeconds, subSets: subSets.map { SubSet(target: $0.target) })
    }

    /// Targets as a non-optional value for editing. An all-empty target is stored as `nil`.
    var targets: SetTarget {
        get { target ?? SetTarget() }
        set { target = newValue == SetTarget() ? nil : newValue }
    }

    /// A drop set fails at its first weight, so its main row has no rep ceiling and 0 RIR. Drop and myo sets start with
    /// one sub-row.
    mutating func change(to newType: SetType) {
        type = newType
        if newType.hasSubSets, subSets.isEmpty { subSets = [SubSet()] }
        if newType == .drop {
            targets.repsMax = nil
            targets.rir = 0
        }
    }
}

extension SubSet {
    var targets: SetTarget {
        get { target ?? SetTarget() }
        set { target = newValue == SetTarget() ? nil : newValue }
    }
}

/// "Estimated workout time is N min". MF doesn't state its formula. This one lands within two minutes of the
/// reference's examples: setup per exercise, work per set, and rest after each set, which a superset takes once per round.
enum WorkoutEstimate {
    static let setupSeconds = 120
    static let workSeconds = 45
    static let subSetSeconds = 20

    static func minutes(_ blocks: [WorkoutBlock], rest: (BlockExercise, WorkoutSet) -> Int) -> Int {
        var seconds = 0
        for block in blocks {
            for item in block.exercises {
                seconds += setupSeconds + item.sets.reduce(0) { $0 + workSeconds + $1.subSets.count * subSetSeconds }
            }
            let rounds = block.exercises.map(\.sets.count).max() ?? 0
            for round in 0..<rounds {
                guard let last = block.exercises.last(where: { $0.sets.indices.contains(round) }) else { continue }
                seconds += rest(last, last.sets[round])
            }
        }
        return Int((Double(seconds) / 60).rounded())
    }
}

/// One Target Muscles card: how many exercises train the muscle and its set count from `WorkoutMetrics`.
struct MuscleTarget: Identifiable {
    let muscle: Muscle
    let exercises: Int
    let sets: Double

    var id: Muscle { muscle }

    @MainActor static func of(_ blocks: [WorkoutBlock], catalog: ExerciseCatalog) -> [MuscleTarget] {
        let sets = WorkoutMetrics.muscleSets(in: blocks, catalog: { catalog.exercise($0) }, loggedOnly: false)
        let exercises = blocks.flatMap(\.exercises).compactMap { catalog.exercise($0.exerciseID) }
        return of(sets: sets, exercises: exercises)
    }

    /// Cards for set counts worked out elsewhere, such as a program's averages over its cycles.
    static func of(sets: [Muscle: Double], exercises: [Exercise]) -> [MuscleTarget] {
        sets.map { muscle, count in
            let trained = exercises.count { $0.primaryMuscles.contains(muscle) || $0.secondaryMuscles.contains(muscle) }
            return MuscleTarget(muscle: muscle, exercises: trained, sets: count)
        }
        .sorted { ($0.sets, $1.muscle.displayName) > ($1.sets, $0.muscle.displayName) }
    }
}
