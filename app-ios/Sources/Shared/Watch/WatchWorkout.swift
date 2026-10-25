import Foundation

/// A workout the watch runs on its own once it starts, so the phone can stay in a locker. It is the session's blocks
/// plus everything the phone would look up to log a set: names and fields, each set's rest, each row's prefill and
/// previous log, and the flow rules. The phone sends one for the workout in progress and one per workout on the
/// watch's home list; the watch applies its own `WatchEvent`s to it and sends them back for the phone to apply.
struct WatchWorkout: Codable, Hashable, Sendable {
    struct Exercise: Codable, Hashable, Sendable {
        var name: String
        var fields: [LiveField]
        /// The totals its equipment loads in the session's gym, ascending, for the Digital Crown. Empty steps by the
        /// unit's plate increment.
        var loadableWeightsKg: [Double] = []
    }

    var sessionID: UUID
    var templateID: UUID?
    var name: String
    var program: ProgramPosition?
    var gymID: UUID?
    var startedAt: Date
    var pausedSeconds = 0
    var pausedAt: Date?
    var endedAt: Date?
    var blocks: [WorkoutBlock]
    var current: BlockExercise.ID?
    var rest: LiveRest?
    /// The rest left when Pause froze it, which Resume picks up again.
    var frozenRest: TimeInterval?
    var rules: FlowRules
    var unit: WeightUnit
    var exercises: [ExerciseID: Exercise]
    /// Each set's full rest, by set id, before the flow rules scale it.
    var restSeconds: [UUID: Int]
    /// What each open row logs if checked untouched, by row id: what was typed on the phone, else its prefill.
    var prefill: [UUID: LiveValues]
    /// Last time's log of each row, by row id.
    var previous: [UUID: LiveValues]
}

/// One thing the owner did on the watch. Events are applied in order on the watch at once and on the phone whenever
/// they arrive; each names the rows it acts on, so applying one twice, or after the phone changed, converges.
struct WatchEvent: Codable, Hashable, Sendable, Identifiable {
    enum Kind: Codable, Hashable, Sendable {
        /// A workout started on the watch, as it started: the phone inserts this session.
        case start(WatchWorkout)
        case log(rowID: UUID, values: LiveValues)
        case unlog(rowID: UUID)
        /// A copy of the exercise's last working set, with the id the watch gave it.
        case addSet(exerciseID: BlockExercise.ID, setID: UUID)
        case select(exerciseID: BlockExercise.ID)
        case adjustRest(seconds: Int)
        case skipRest
        case pause
        case resume
        case finish
        case discard
    }

    var id = UUID()
    var sessionID: UUID
    var at: Date
    var kind: Kind
}

extension WatchWorkout {
    var isFinished: Bool { endedAt != nil }

    var pauseAdjustedStart: Date { startedAt.addingTimeInterval(TimeInterval(pausedSeconds)) }

    func elapsed(at date: Date) -> TimeInterval {
        let end = endedAt ?? pausedAt ?? date
        return max(0, end.timeIntervalSince(pauseAdjustedStart))
    }

    var currentRow: RowPath? { SessionFlow.currentRow(in: blocks, current: current) }

    var upNextRow: RowPath? { currentRow.flatMap { SessionFlow.upNext(after: $0, in: blocks, rules: rules) } }

    var completedSets: Int { blocks.allRows.count { blocks.log(at: $0) != nil } }

    var totalSets: Int { blocks.allRows.count }

    var volumeKg: Double {
        blocks.allRows.compactMap { blocks.log(at: $0) }.reduce(0) { $0 + ($1.weightKg ?? 0) * Double($1.reps ?? 0) }
    }

    func exercise(_ id: ExerciseID) -> Exercise {
        exercises[id] ?? Exercise(name: "Exercise", fields: [.weight, .reps])
    }

    /// The row as the set screen shows it: its log once checked, else its prefill.
    func set(at path: RowPath) -> LiveSet {
        let item = blocks[path.block].exercises[path.exercise]
        let set = item.sets[path.set]
        let rowID = blocks.rowID(at: path)
        let info = exercise(item.exerciseID)
        let values = blocks.log(at: path).map(LiveValues.init) ?? prefill[rowID] ?? LiveValues()
        return LiveSet(
            id: rowID, blockExerciseID: item.id, catalogID: item.exerciseID, exerciseName: info.name,
            position: SessionFlow.subtitle(for: (path.block, path.exercise), set: path.set, in: blocks),
            setType: set.type, isSubRow: path.sub != nil, fields: info.fields, values: values,
            target: blocks.target(at: path).flatMap { $0.summary(unit: unit) }, previous: previous[rowID].map { $0.summary(unit: unit) }
        )
    }

    /// Applies one event. A row that is gone, or already in the state the event asks for, is left alone.
    mutating func apply(_ event: WatchEvent) {
        let at = event.at
        switch event.kind {
        case .start, .discard:
            return
        case .log(let rowID, let values):
            guard let path = blocks.path(of: rowID), blocks.log(at: path) == nil else { return }
            blocks.setLog(SetLog(values, at: at), at: path)
            prefill[rowID] = nil
            let step = SessionFlow.afterCompleting(path, in: blocks, settings: rules) { [restSeconds] _, set in restSeconds[set.id] ?? 90 }
            if let seconds = step.restSeconds, seconds > 0 {
                rest = LiveRest(endsAt: at.addingTimeInterval(TimeInterval(seconds)), duration: TimeInterval(seconds))
            }
            if let next = step.next { current = next }
            if current == nil { current = blocks[path.block].exercises[path.exercise].id }
        case .unlog(let rowID):
            guard let path = blocks.path(of: rowID), let log = blocks.log(at: path) else { return }
            prefill[rowID] = LiveValues(log)
            blocks.setLog(nil, at: path)
        case .addSet(let exerciseID, let setID):
            guard let at = blocks.locate(exerciseID), blocks.path(of: setID) == nil else { return }
            let item = blocks[at.block].exercises[at.item]
            if let last = item.sets.last(where: { $0.type != .warmUp }) {
                restSeconds[setID] = restSeconds[last.id]
                prefill[setID] = blocks.path(of: last.id).map { self.set(at: $0).values }
            } else {
                restSeconds[setID] = item.sets.last.flatMap { restSeconds[$0.id] }
            }
            blocks.addSet(to: exerciseID, id: setID)
        case .select(let exerciseID):
            if blocks.locate(exerciseID) != nil { current = exerciseID }
        case .adjustRest(let seconds):
            guard var timer = rest else { return }
            timer.endsAt.addTimeInterval(TimeInterval(seconds))
            timer.duration += TimeInterval(seconds)
            rest = timer.endsAt > at ? timer : nil
        case .skipRest:
            rest = nil
        case .pause:
            guard pausedAt == nil, !isFinished else { return }
            pausedAt = at
            frozenRest = rest.map { $0.endsAt.timeIntervalSince(at) }.flatMap { $0 > 0 ? $0 : nil }
            rest = nil
        case .resume:
            guard let pausedAt else { return }
            pausedSeconds += Int(at.timeIntervalSince(pausedAt))
            self.pausedAt = nil
            if let frozenRest { rest = LiveRest(endsAt: at.addingTimeInterval(frozenRest), duration: frozenRest) }
            frozenRest = nil
        case .finish:
            guard !isFinished else { return }
            if pausedAt != nil { apply(WatchEvent(sessionID: sessionID, at: at, kind: .resume)) }
            endedAt = at
            rest = nil
        }
    }

    func applying(_ events: [WatchEvent]) -> WatchWorkout {
        var workout = self
        for event in events where event.sessionID == sessionID { workout.apply(event) }
        return workout
    }
}

extension SetLog {
    init(_ values: LiveValues, at date: Date) {
        self.init(
            weightKg: values.weightKg, reps: values.reps, rir: values.rir,
            durationSeconds: values.durationSeconds, distanceMeters: values.distanceMeters, completedAt: date
        )
    }
}

extension LiveValues {
    init(_ log: SetLog) {
        self.init(weightKg: log.weightKg, reps: log.reps, rir: log.rir, durationSeconds: log.durationSeconds, distanceMeters: log.distanceMeters)
    }
}

extension LiveValues {
    /// "185 lb x 8 @ 2", the way a watch line fits it: weight to a tenth, reps or time, and RIR.
    func summary(unit: WeightUnit) -> String {
        let weight = weightKg.map { "\(unit.fromKg($0).formatted(.number.precision(.fractionLength(0...1)))) \(unit.rawValue)" }
        let amount = reps.map(String.init) ?? durationSeconds.map { Duration.seconds($0).formatted(.time(pattern: .minuteSecond)) }
        let main = [weight, amount].compactMap { $0 }.joined(separator: " x ")
        return rir.map { "\(main) @ \($0 >= 6 ? "6+" : "\($0)") RIR" } ?? main
    }
}

/// The watch's copy of the workout: `base` is the workout as the phone last sent it, or as the watch started it, and
/// `outbox` the watch's events the phone hasn't acknowledged. What the watch shows is `base` with the outbox applied.
struct WatchReplica: Codable, Hashable, Sendable {
    var base: WatchWorkout?
    var outbox: [WatchEvent] = []
    /// Workouts the owner closed here, newest last, which a late copy from the phone must not bring back.
    var closed: [UUID] = []

    var workout: WatchWorkout? { base?.applying(outbox) }

    /// Starts `plan` here as a new session, without the phone.
    mutating func start(_ plan: WatchWorkout, at date: Date) -> WatchEvent {
        var started = plan
        started.sessionID = UUID()
        started.startedAt = date
        started.current = SessionFlow.initialExercise(in: started.blocks)
        base = started
        outbox.removeAll { $0.sessionID == started.sessionID }
        return record(.start(started), at: date)!
    }

    @discardableResult
    mutating func record(_ kind: WatchEvent.Kind, at date: Date) -> WatchEvent? {
        guard let sessionID = base?.sessionID else { return nil }
        let event = WatchEvent(sessionID: sessionID, at: date, kind: kind)
        outbox.append(event)
        return event
    }

    /// Leaves the workout. Its unacknowledged events stay in the outbox until the phone has them.
    mutating func close() {
        guard let id = base?.sessionID else { return }
        // Late copies of a workout arrive within minutes, so the last few closed ones are enough.
        closed = closed.suffix(19) + [id]
        base = nil
    }

    /// The phone's copy of the workout in progress, or nil when it has none. Acknowledged events leave the outbox and
    /// the rest stay applied on top. WatchConnectivity delivers queued copies late and in order, so a copy of a
    /// different workout replaces this one only when it is newer and still in progress.
    mutating func receive(_ remote: WatchWorkout?, acknowledged: [UUID]) {
        let acked = Set(acknowledged)
        // Acknowledged events go into `base` before they leave the outbox, since the copy that shows them may arrive
        // after the acknowledgment.
        base = base?.applying(outbox.filter { acked.contains($0.id) })
        outbox.removeAll { acked.contains($0.id) }
        if let remote, closed.contains(remote.sessionID) { return }
        let hasLocalChanges = base.map { local in outbox.contains { $0.sessionID == local.sessionID } } ?? false
        switch (base, remote) {
        case (nil, let remote?) where !remote.isFinished:
            base = remote
        case (let local?, let remote?) where local.sessionID == remote.sessionID:
            base = remote
        case (let local?, let remote?) where !hasLocalChanges && !remote.isFinished && remote.startedAt >= local.startedAt:
            base = remote
        case (let local?, nil) where !hasLocalChanges && !local.isFinished:
            base = nil
        default:
            break
        }
    }
}
