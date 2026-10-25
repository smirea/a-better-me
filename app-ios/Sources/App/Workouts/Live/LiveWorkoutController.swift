import Foundation
import GRDB
import Observation

/// The in-progress workout for everything that isn't the phone's own screen. The Live Activity reads `status` and sends
/// `LiveWorkoutCommand`s back through `perform`; the watch reads `watchWorkout` and sends `WatchEvent`s through
/// `apply`. The database stays the one record. While the live editor is on screen it holds the session's blocks, so
/// commands go through it; otherwise they are applied here with the same `SessionFlow` rules.
@MainActor @Observable
final class LiveWorkoutController {
    static let shared = LiveWorkoutController()

    private(set) var status: LiveWorkoutStatus?
    /// The in-progress session as the watch runs it. Rebuilt apart from `status`, which changes with every heart rate
    /// sample.
    private(set) var watchWorkout: WatchWorkout?
    /// The watch events applied to the in-progress session, which the watch drops from its outbox once it hears.
    private(set) var acknowledgedWatchEvents = UserDefaults.standard.stringArray(forKey: acknowledgedKey)?.compactMap(UUID.init) ?? []
    @ObservationIgnored private var inFlightWatchEvents: Set<UUID> = []
    @ObservationIgnored private var finishedSessions: Set<UUID> = []
    /// When each session that isn't the live one was paused from the watch, for its resume.
    @ObservationIgnored private var storedPauses: [UUID: Date] = [:]
    /// Events for a session the watch started whose row hasn't reached the observation yet.
    @ObservationIgnored private var deferredWatchEvents: [WatchEvent] = []
    /// Applied events waiting for `watchWorkout` to show them. Acknowledging one before its write lands would let the
    /// watch drop it while the copy it receives still predates it.
    @ObservationIgnored private var unreflectedWatchEvents: [(event: WatchEvent, appliedAt: Date)] = []
    var metrics: LiveHealthMetrics?
    @ObservationIgnored var editor: ((LiveWorkoutCommand, Date) -> Void)?

    private var inputs = Inputs()
    private var history: [[WorkoutBlock]] = []
    @ObservationIgnored private var historySessionID: UUID?
    @ObservationIgnored private var store: LocalStore?
    @ObservationIgnored private var catalog: ExerciseCatalog?
    @ObservationIgnored private var cancellable: AnyDatabaseCancellable?
    @ObservationIgnored private var loadableCache: [(loading: Loading, unit: WeightUnit, kg: [Double])] = []

    private struct Inputs: Equatable, Sendable {
        var session: WorkoutSession?
        var settings = AppSettings()
        var exerciseSettings: [ExerciseSettings] = []
        /// The session's gym, else the default gym, as the editor resolves it.
        var gym: GymProfile?
    }

    private var live: LiveSessionStore { .shared }

    func start(store: LocalStore, catalog: ExerciseCatalog) {
        guard self.store == nil else { return }
        self.store = store
        self.catalog = catalog
        cancellable = ValueObservation.tracking { db in
            let session = try WorkoutSession.inProgress.fetch(db)
            let gyms = try GymProfile.all.fetch(db)
            return try Inputs(
                session: session,
                settings: AppSettings.current.fetch(db),
                exerciseSettings: ExerciseSettings.all.fetch(db),
                gym: gyms.first { $0.id == session?.gymID } ?? GymProfile.defaultGym.fetch(db)
            )
        }
        .removeDuplicates()
        .start(
            in: store.database.pool,
            scheduling: .immediate,
            onError: { LocalStore.log.error("Live workout observation failed: \(String(describing: $0))") },
            onChange: { [weak self] in self?.receive($0) }
        )
        track()
        trackWatch()
    }

    private func receive(_ inputs: Inputs) {
        self.inputs = inputs
        if !deferredWatchEvents.isEmpty { retryDeferredWatchEvents() }
        guard let session = inputs.session else {
            history = []
            historySessionID = nil
            return
        }
        guard historySessionID != session.id, let store else { return }
        historySessionID = session.id
        var earlier = (try? store.read { try WorkoutSession.earlier(than: session, $0) }) ?? []
        if inputs.settings.workout.previousReference == .withinProgram, let programID = session.program?.programID {
            earlier = earlier.filter { $0.program?.programID == programID }
        }
        history = earlier.map(\.blocks)
    }

    private func track() {
        let next = withObservationTracking { build() } onChange: { [weak self] in
            Task { @MainActor in self?.track() }
        }
        if next != status { status = next }
    }

    private func trackWatch() {
        let next = withObservationTracking {
            inputs.session.map { watchWorkout(for: $0, history: history, gym: inputs.gym, isLive: true) }
        } onChange: { [weak self] in
            Task { @MainActor in self?.trackWatch() }
        }
        if next != watchWorkout { watchWorkout = next }
        acknowledgeReflected(in: next)
    }

    private func acknowledgeReflected(in workout: WatchWorkout?) {
        guard !unreflectedWatchEvents.isEmpty else { return }
        let now = Date.now
        let (done, waiting) = unreflectedWatchEvents.partitioned { pending in
            pending.event.isReflected(in: workout) || now.timeIntervalSince(pending.appliedAt) > 15
        }
        unreflectedWatchEvents = waiting
        for pending in done { remember(pending.event.id) }
        if !waiting.isEmpty { scheduleAcknowledgmentRetry() }
    }

    /// An event that changed nothing triggers no rebuild, so it is acknowledged after the 15 s wait at the latest.
    private func scheduleAcknowledgmentRetry() {
        Task { [weak self] in
            try? await Task.sleep(for: .seconds(16))
            self?.acknowledgeReflected(in: self?.watchWorkout)
        }
    }

    // MARK: Watch

    /// `session` as the watch runs it: the in-progress one with what the phone typed and suggested, or a workout on
    /// the watch's home list as it would start, prefilled from `history`.
    func watchWorkout(for session: WorkoutSession, history: [[WorkoutBlock]], gym: GymProfile?, isLive: Bool) -> WatchWorkout {
        let settings = inputs.settings
        let unit = settings.weightUnit
        let blocks = session.blocks
        var exercises: [ExerciseID: WatchWorkout.Exercise] = [:]
        var rest: [UUID: Int] = [:]
        var prefill: [UUID: LiveValues] = [:]
        var previous: [UUID: LiveValues] = [:]
        for (b, block) in blocks.enumerated() {
            for (e, item) in block.exercises.enumerated() {
                let exercise = catalog?.exercise(item.exerciseID)
                if exercises[item.exerciseID] == nil {
                    exercises[item.exerciseID] = WatchWorkout.Exercise(
                        name: exercise?.name ?? "Exercise", fields: SetField.fields(for: exercise).map(\.live),
                        loadableWeightsKg: catalog.flatMap { loadableWeights(for: item, catalog: $0, unit: unit, gym: gym) } ?? []
                    )
                }
                for set in item.sets {
                    rest[set.id] = item.restSeconds(after: set, exercise: exercise, settings: .of(item.exerciseID, in: inputs.exerciseSettings), defaults: settings)
                }
                let earlier = SessionFlow.previousSets(of: item.exerciseID, in: history)
                for path in blocks.rows(block: b, exercise: e) {
                    let id = blocks.rowID(at: path)
                    if let log = SessionFlow.previousLog(for: path, in: blocks, previous: earlier) { previous[id] = LiveValues(log) }
                    guard blocks.log(at: path) == nil else { continue }
                    let value = isLive ? entry(path, in: blocks, previous: earlier)
                        : SessionFlow.prefill(for: path, in: blocks, previous: earlier, suggestion: nil, rirTracking: settings.workout.rirTracking, unit: unit)
                    prefill[id] = LiveValues(value)
                }
            }
        }
        return WatchWorkout(
            sessionID: session.id, templateID: session.templateID, name: session.name, program: session.program, gymID: session.gymID,
            startedAt: session.startedAt, pausedSeconds: session.pausedSeconds, pausedAt: isLive ? live.pausedAt : nil, endedAt: session.endedAt,
            blocks: blocks, current: isLive ? live.currentExercise : nil,
            rest: isLive ? live.rest.map { LiveRest(endsAt: $0.endsAt, duration: $0.duration) } : nil,
            rules: settings.workout.flow, unit: unit, exercises: exercises, restSeconds: rest, prefill: prefill, previous: previous
        )
    }

    /// One event from the watch's outbox. The watch resends until it hears the id back, so an event already applied
    /// is skipped. An event for the live session goes through the same paths as the phone's own controls; one for
    /// another session, such as a workout the watch started while the phone had its own, goes straight to that row.
    func apply(_ event: WatchEvent) {
        guard let store, !acknowledgedWatchEvents.contains(event.id), !inFlightWatchEvents.contains(event.id),
              !unreflectedWatchEvents.contains(where: { $0.event.id == event.id }) else { return }
        if case .start(let plan) = event.kind { return startFromWatch(plan, event: event, in: store) }
        guard let session = inputs.session, session.id == event.sessionID else { return applyToStored(event, in: store) }
        switch event.kind {
        case .start: break
        case .log(let rowID, let values): perform(.log(rowID: rowID, values: values), at: event.at)
        case .unlog(let rowID):
            // The draft goes in before the write, so the copy that shows the row open already shows the undone values.
            if let path = session.blocks.path(of: rowID), let log = session.blocks.log(at: path) { live.drafts[rowID] = SetEntry(log) }
            perform(.unlog(rowID: rowID), at: event.at)
        case .addSet(let exerciseID, let setID): perform(.addSet(exerciseID: exerciseID, setID: setID), at: event.at)
        case .select(let exerciseID): perform(.select(exerciseID: exerciseID), at: event.at)
        case .adjustRest(let seconds): perform(.adjustRest(seconds: seconds), at: event.at)
        case .skipRest: perform(.skipRest, at: event.at)
        case .pause: perform(.pause, at: event.at)
        case .resume: perform(.resume, at: event.at)
        case .finish: perform(.finish, at: event.at)
        case .discard:
            live.reset()
            store.delete(WorkoutSession.self, id: session.id)
        }
        unreflectedWatchEvents.append((event, .now))
        scheduleAcknowledgmentRetry()
    }

    /// An event for a session that isn't the live one changes its stored row directly and is acknowledged once the
    /// write lands. A session the phone doesn't have yet waits for the watch's start to be inserted.
    private func applyToStored(_ event: WatchEvent, in store: LocalStore) {
        inFlightWatchEvents.insert(event.id)
        let pausedAt = storedPauses[event.sessionID]
        let write = store.write { db -> StoredOutcome in
            guard var session = try WorkoutSession.fetchOne(db, key: WorkoutSession.key(event.sessionID)) else { return .missing }
            let existing = session
            var outcome = StoredOutcome.applied
            switch event.kind {
            case .log(let rowID, let values):
                if let path = session.blocks.path(of: rowID), session.blocks.log(at: path) == nil {
                    session.blocks.setLog(SetLog(values, at: event.at), at: path)
                }
            case .unlog(let rowID):
                if let path = session.blocks.path(of: rowID) { session.blocks.setLog(nil, at: path) }
            case .addSet(let exerciseID, let setID):
                session.blocks.addSet(to: exerciseID, id: setID)
            case .pause:
                outcome = .paused
            case .resume:
                if let pausedAt { session.pausedSeconds += Int(event.at.timeIntervalSince(pausedAt)) }
                outcome = .resumed
            case .finish:
                if session.endedAt == nil {
                    session.endedAt = event.at
                    outcome = .finished(session)
                }
            case .discard:
                _ = try WorkoutSession.deleteOne(db, key: WorkoutSession.key(session.id))
                return .applied
            case .start, .select, .adjustRest, .skipRest:
                break
            }
            if session != existing { try session.updateChanges(db, from: existing) }
            return outcome
        }
        Task {
            let outcome = (try? await write.value) ?? .missing
            inFlightWatchEvents.remove(event.id)
            switch outcome {
            case .missing:
                if !deferredWatchEvents.contains(where: { $0.id == event.id }) { deferredWatchEvents.append(event) }
                return
            case .paused: storedPauses[event.sessionID] = event.at
            case .resumed: storedPauses[event.sessionID] = nil
            case .finished(let session): store.advanceProgram(after: session)
            case .applied: break
            }
            remember(event.id)
        }
    }

    private enum StoredOutcome: Sendable {
        case missing, applied, paused, resumed
        case finished(WorkoutSession)
    }

    /// Acknowledged ids outlive a relaunch: the watch resends its whole outbox until it hears them, and replaying a
    /// pause and resume or a rest change would count it twice.
    private func remember(_ id: UUID) {
        acknowledgedWatchEvents = Array((acknowledgedWatchEvents + [id]).suffix(500))
        UserDefaults.standard.set(acknowledgedWatchEvents.map(\.uuidString), forKey: Self.acknowledgedKey)
    }

    private static let acknowledgedKey = "acknowledgedWatchEvents"

    /// A workout started on the watch becomes a phone session as the watch started it, with the same row ids, so the
    /// events that follow find their rows. It is acknowledged once inserted. A second start of the same session is
    /// ignored.
    private func startFromWatch(_ plan: WatchWorkout, event: WatchEvent, in store: LocalStore) {
        WorkoutHealth.shared.expectWatchRecording(plan.sessionID)
        var session = WorkoutSession(name: plan.name, templateID: plan.templateID, blocks: plan.blocks, startedAt: plan.startedAt)
        session.id = plan.sessionID
        session.program = plan.program
        session.gymID = plan.gymID
        if inputs.session == nil {
            live.reset()
            live.currentExercise = plan.current
        }
        let started = session
        inFlightWatchEvents.insert(event.id)
        let write = store.write { db in
            guard try WorkoutSession.fetchOne(db, key: WorkoutSession.key(started.id)) == nil else { return }
            try started.insert(db)
        }
        Task {
            _ = try? await write.value
            inFlightWatchEvents.remove(event.id)
            remember(event.id)
            retryDeferredWatchEvents()
        }
    }

    private func retryDeferredWatchEvents() {
        let ready = deferredWatchEvents
        deferredWatchEvents = []
        for event in ready { apply(event) }
    }

    // MARK: Status

    private func build() -> LiveWorkoutStatus? {
        guard let session = inputs.session, let catalog else { return nil }
        let blocks = session.blocks
        let unit = inputs.settings.weightUnit
        let pausedAt = live.pausedAt
        let current = SessionFlow.currentRow(in: blocks, current: live.currentExercise)
        let rows = blocks.allRows
        let status = LiveWorkoutStatus(
            sessionID: session.id,
            name: session.name,
            pauseAdjustedStart: session.startedAt.addingTimeInterval(TimeInterval(session.pausedSeconds)),
            pausedAt: pausedAt,
            rest: live.rest.map { LiveRest(endsAt: $0.endsAt, duration: $0.duration) },
            current: current.map { liveSet($0, in: blocks, catalog: catalog, unit: unit) },
            upNext: current.flatMap { SessionFlow.upNext(after: $0, in: blocks, rules: inputs.settings.workout.flow) }.map { liveSet($0, in: blocks, catalog: catalog, unit: unit) },
            completedSets: rows.count { blocks.log(at: $0) != nil },
            totalSets: rows.count,
            unit: unit,
            metrics: metrics
        )
        return status
    }

    /// Every total the exercise's equipment loads up to a ceiling no lift reaches, in kilograms. Plate math is slow next
    /// to a rebuild, which runs on every heart rate sample, so lists are kept per loading.
    private func loadableWeights(for item: BlockExercise, catalog: ExerciseCatalog, unit: WeightUnit, gym: GymProfile? = nil) -> [Double]? {
        guard let loading = Loading.of(item, gym: gym ?? inputs.gym, catalog: catalog, settings: inputs.settings, exerciseSettings: inputs.exerciseSettings) else { return nil }
        if let cached = loadableCache.first(where: { $0.loading == loading && $0.unit == unit }) { return cached.kg }
        let ceiling = unit == .kg ? 500.0 : 1100.0
        var weights: [Double] = []
        var value = 0.0
        while weights.count < 400, let next = loading.step(from: value, up: true), next <= ceiling {
            weights.append(next)
            value = next
        }
        let kg = weights.map(unit.toKg)
        loadableCache.append((loading, unit, kg))
        return kg
    }

    private func liveSet(_ path: RowPath, in blocks: [WorkoutBlock], catalog: ExerciseCatalog, unit: WeightUnit) -> LiveSet {
        let item = blocks[path.block].exercises[path.exercise]
        let set = item.sets[path.set]
        let exercise = catalog.exercise(item.exerciseID)
        let previous = SessionFlow.previousSets(of: item.exerciseID, in: history)
        return LiveSet(
            id: blocks.rowID(at: path),
            blockExerciseID: item.id,
            catalogID: item.exerciseID,
            exerciseName: exercise?.name ?? "Exercise",
            position: SessionFlow.subtitle(for: (path.block, path.exercise), set: path.set, in: blocks),
            setType: set.type,
            isSubRow: path.sub != nil,
            fields: SetField.fields(for: exercise).map(\.live),
            values: LiveValues(entry(path, in: blocks, previous: previous)),
            target: blocks.target(at: path).flatMap { $0.summary(unit: unit) },
            previous: SessionFlow.previousLog(for: path, in: blocks, previous: previous).map { SessionEditor.summary(of: $0, unit: unit) }
        )
    }

    private func entry(_ path: RowPath, in blocks: [WorkoutBlock], previous: [WorkoutSet]) -> SetEntry {
        SessionFlow.entry(
            for: path, in: blocks, drafts: live.drafts, previous: previous,
            suggestions: live.suggestions, appliedRows: live.appliedRows, settings: inputs.settings
        )
    }

    // MARK: Commands

    /// `at` is when the owner acted, which is a while ago for a command the watch queued while the phone was away.
    func perform(_ command: LiveWorkoutCommand, at date: Date = .now) {
        guard let session = inputs.session, let store else { return }
        switch command {
        case .adjustRest(let seconds): return live.adjustRest(by: TimeInterval(seconds))
        case .skipRest: return live.stopRest()
        case .pause: return live.pause(at: date)
        case .resume:
            let paused = live.resume(at: date)
            return store.modify(WorkoutSession.self, id: session.id) { $0.pausedSeconds += paused }
        case .finish: return finish(session, in: store, at: date)
        case .log, .unlog, .select, .addSet: break
        }
        if let editor { return editor(command, date) }
        apply(command, to: session, in: store, at: date)
    }

    /// The editor isn't on screen, so the command changes the stored session. It reads the row inside the write, since
    /// two commands can arrive before the first write's observation does. Smart Progression's Apply in session needs
    /// the editor's equipment context and waits until the editor next opens.
    private func apply(_ command: LiveWorkoutCommand, to session: WorkoutSession, in store: LocalStore, at date: Date) {
        if case .select(let exerciseID) = command {
            if session.blocks.locate(exerciseID) != nil { live.currentExercise = exerciseID }
            return
        }
        let fill = Fill(drafts: live.drafts, suggestions: live.suggestions, appliedRows: live.appliedRows, settings: inputs.settings, history: history, at: date)
        let sessionID = session.id
        let write = store.write { db -> Fill.Outcome in
            guard let existing = try WorkoutSession.fetchOne(db, key: WorkoutSession.key(sessionID)) else { return .none }
            var changed = existing
            let outcome = fill.apply(command, to: &changed.blocks)
            if changed.blocks != existing.blocks { try changed.updateChanges(db, from: existing) }
            return outcome
        }
        Task {
            switch try await write.value {
            case .none: return
            case .logged(let rowID, let path, let blocks):
                live.drafts[rowID] = nil
                // A finish that arrived with this log ended the workout while the write was on its way.
                guard inputs.session?.id == session.id, !finishedSessions.contains(session.id) else { return }
                let settings = inputs.settings
                let step = SessionFlow.afterCompleting(path, in: blocks, settings: settings.workout.flow) { [catalog, exerciseSettings = inputs.exerciseSettings] item, set in
                    item.restSeconds(after: set, exercise: catalog?.exercise(item.exerciseID), settings: .of(item.exerciseID, in: exerciseSettings), defaults: settings)
                }
                if let seconds = step.restSeconds { live.startRest(seconds: seconds, alerts: settings.workout.rest, from: date) }
                if let next = step.next { live.currentExercise = next }
            case .draft(let rowID, let value):
                live.drafts[rowID] = value
            }
        }
    }

    /// Done on Workout Complete with Update Workout Plan off. The phone's cover closes once the session has ended.
    private func finish(_ session: WorkoutSession, in store: LocalStore, at endedAt: Date) {
        finishedSessions.insert(session.id)
        if live.pausedAt != nil {
            let paused = live.resume(at: endedAt)
            store.modify(WorkoutSession.self, id: session.id) { $0.pausedSeconds += paused }
        }
        store.modify(WorkoutSession.self, id: session.id) { $0.endedAt = endedAt }
        var finished = session
        finished.endedAt = endedAt
        store.advanceProgram(after: finished)
        live.reset()
    }
}

/// What a closed-editor command reads besides the stored blocks, copied off the main actor into its write.
private struct Fill: Sendable {
    enum Outcome: Sendable {
        case none
        case logged(rowID: UUID, path: RowPath, blocks: [WorkoutBlock])
        case draft(rowID: UUID, SetEntry)
    }

    var drafts: [UUID: SetEntry]
    var suggestions: [BlockExercise.ID: [UUID: SetSuggestion]]
    var appliedRows: Set<UUID>
    var settings: AppSettings
    var history: [[WorkoutBlock]]
    var at: Date

    func apply(_ command: LiveWorkoutCommand, to blocks: inout [WorkoutBlock]) -> Outcome {
        switch command {
        case .log(let rowID, let values):
            guard let path = blocks.path(of: rowID), blocks.log(at: path) == nil else { return .none }
            blocks.setLog(SetEntry(values, keeping: entry(path, in: blocks)).log(at: at), at: path)
            return .logged(rowID: rowID, path: path, blocks: blocks)
        case .unlog(let rowID):
            guard let path = blocks.path(of: rowID), let log = blocks.log(at: path) else { return .none }
            blocks.setLog(nil, at: path)
            return .draft(rowID: rowID, SetEntry(log))
        case .addSet(let exerciseID, let setID):
            blocks.addSet(to: exerciseID, id: setID)
            return .none
        case .select, .adjustRest, .skipRest, .pause, .resume, .finish:
            return .none
        }
    }

    private func entry(_ path: RowPath, in blocks: [WorkoutBlock]) -> SetEntry {
        let previous = SessionFlow.previousSets(of: blocks[path.block].exercises[path.exercise].exerciseID, in: history)
        return SessionFlow.entry(for: path, in: blocks, drafts: drafts, previous: previous, suggestions: suggestions, appliedRows: appliedRows, settings: settings)
    }
}

extension LiveValues {
    init(_ entry: SetEntry) {
        self.init(weightKg: entry.weightKg, reps: entry.reps, rir: entry.rir, durationSeconds: entry.durationSeconds, distanceMeters: entry.distanceMeters)
    }
}

extension SetEntry {
    init(_ values: LiveValues, keeping current: SetEntry) {
        self.init(
            weightKg: values.weightKg, reps: values.reps, partialReps: current.partialReps, rir: values.rir,
            durationSeconds: values.durationSeconds, distanceMeters: values.distanceMeters
        )
    }
}

extension SetField {
    var live: LiveField {
        switch self {
        case .weight: .weight
        case .reps: .reps
        case .duration: .duration
        case .distance: .distance
        }
    }
}

extension WatchEvent {
    /// Whether the phone's copy of the workout already shows this event, so the watch can drop it from its outbox.
    func isReflected(in workout: WatchWorkout?) -> Bool {
        guard let workout, workout.sessionID == sessionID else {
            if case .start = kind { return false }
            return true
        }
        let blocks = workout.blocks
        switch kind {
        case .start: return true
        case .log(let rowID, _): return blocks.path(of: rowID).map { blocks.log(at: $0) != nil } ?? true
        case .unlog(let rowID): return blocks.path(of: rowID).map { blocks.log(at: $0) == nil } ?? true
        case .addSet(_, let setID): return blocks.path(of: setID) != nil
        case .select(let exerciseID): return workout.current == exerciseID
        case .pause: return workout.pausedAt != nil
        case .resume: return workout.pausedAt == nil
        case .adjustRest, .skipRest: return true
        case .finish, .discard: return workout.endedAt != nil
        }
    }
}

extension Array {
    func partitioned(by isIncluded: (Element) -> Bool) -> (included: [Element], excluded: [Element]) {
        reduce(into: ([], [])) { result, element in
            if isIncluded(element) { result.0.append(element) } else { result.1.append(element) }
        }
    }
}
