import Foundation
import GRDB
import Observation

/// The in-progress workout for everything that isn't the phone's own screen: the Live Activity and the watch read
/// `snapshot`, and send `LiveWorkoutCommand`s back through `perform`. The phone stays the session's only writer. While
/// the live editor is on screen it holds the session's blocks, so commands go through it; otherwise they are applied
/// here with the same `SessionFlow` rules.
@MainActor @Observable
final class LiveWorkoutController {
    static let shared = LiveWorkoutController()

    private(set) var snapshot: LiveWorkoutSnapshot?
    var metrics: LiveHealthMetrics?
    @ObservationIgnored var editor: ((LiveWorkoutCommand) -> Void)?

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
    }

    private func receive(_ inputs: Inputs) {
        self.inputs = inputs
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
        if next != snapshot { snapshot = next }
    }

    // MARK: Snapshot

    private func build() -> LiveWorkoutSnapshot? {
        guard let session = inputs.session, let catalog else { return nil }
        let blocks = session.blocks
        let unit = inputs.settings.weightUnit
        let pausedAt = live.pausedAt
        let current = currentRow(in: blocks)
        let rows = blocks.allRows
        let status = LiveWorkoutStatus(
            sessionID: session.id,
            name: session.name,
            pauseAdjustedStart: session.startedAt.addingTimeInterval(TimeInterval(session.pausedSeconds)),
            pausedAt: pausedAt,
            rest: live.rest.map { LiveRest(endsAt: $0.endsAt, duration: $0.duration) },
            current: current.map { liveSet($0, in: blocks, catalog: catalog, unit: unit) },
            upNext: current.flatMap { upNext(after: $0, in: blocks) }.map { liveSet($0, in: blocks, catalog: catalog, unit: unit) },
            completedSets: rows.count { blocks.log(at: $0) != nil },
            totalSets: rows.count,
            unit: unit,
            metrics: metrics
        )
        var exercises: [LiveExercise] = []
        for (b, block) in blocks.enumerated() {
            for (e, item) in block.exercises.enumerated() {
                let itemRows = blocks.rows(block: b, exercise: e)
                exercises.append(LiveExercise(
                    id: item.id, catalogID: item.exerciseID, name: catalog.exercise(item.exerciseID)?.name ?? "Exercise",
                    completedSets: itemRows.count { blocks.log(at: $0) != nil }, totalSets: itemRows.count, block: b
                ))
            }
        }
        let shown = [status.current, status.upNext].compactMap { $0?.blockExerciseID }
        var loadable: [UUID: [Double]] = [:]
        for id in Set(shown) {
            guard let at = blocks.locate(id), let weights = loadableWeights(for: blocks[at.block].exercises[at.item], catalog: catalog, unit: unit) else { continue }
            loadable[id] = weights
        }
        return LiveWorkoutSnapshot(status: status, exercises: exercises, loadableWeightsKg: loadable.isEmpty ? nil : loadable)
    }

    /// Every total the exercise's equipment loads up to a ceiling no lift reaches, in kilograms. Plate math is slow next
    /// to a rebuild, which runs on every heart rate sample, so lists are kept per loading.
    private func loadableWeights(for item: BlockExercise, catalog: ExerciseCatalog, unit: WeightUnit) -> [Double]? {
        guard let loading = Loading.of(item, gym: inputs.gym, catalog: catalog, settings: inputs.settings, exerciseSettings: inputs.exerciseSettings) else { return nil }
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

    private func currentRow(in blocks: [WorkoutBlock]) -> RowPath? {
        let currentID = live.currentExercise ?? SessionFlow.initialExercise(in: blocks)
        if let currentID, let at = blocks.locate(currentID), let row = blocks.firstOpenRow(block: at.block, exercise: at.item) {
            return row
        }
        let start = currentID.flatMap { blocks.locate($0)?.block } ?? -1
        guard let next = SessionFlow.nextIncomplete(after: start, in: blocks), let at = blocks.locate(next) else { return nil }
        return blocks.firstOpenRow(block: at.block, exercise: at.item)
    }

    /// The row after `path` once it is logged, following the same rest and auto-scroll rules as checking it on the phone.
    private func upNext(after path: RowPath, in blocks: [WorkoutBlock]) -> RowPath? {
        var logged = blocks
        logged.setLog(SetLog(completedAt: .now), at: path)
        let step = SessionFlow.afterCompleting(path, in: logged, settings: inputs.settings.workout.flow) { _, _ in 0 }
        let exerciseID = step.next ?? logged[path.block].exercises[path.exercise].id
        guard let at = logged.locate(exerciseID) else { return nil }
        return logged.firstOpenRow(block: at.block, exercise: at.item)
            ?? SessionFlow.nextIncomplete(after: at.block, in: logged).flatMap { logged.locate($0) }.flatMap { logged.firstOpenRow(block: $0.block, exercise: $0.item) }
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

    func perform(_ command: LiveWorkoutCommand) {
        guard let session = inputs.session, let store else { return }
        switch command {
        case .adjustRest(let seconds): return live.adjustRest(by: TimeInterval(seconds))
        case .skipRest: return live.stopRest()
        case .pause: return live.pause()
        case .resume:
            let paused = live.resume()
            return store.modify(WorkoutSession.self, id: session.id) { $0.pausedSeconds += paused }
        case .finish: return finish(session, in: store)
        case .log, .unlog, .edit, .select: break
        }
        if let editor { return editor(command) }
        apply(command, to: session, in: store)
    }

    /// The editor isn't on screen, so the command changes the stored session. It reads the row inside the write, since
    /// two commands can arrive before the first write's observation does. Smart Progression's Apply in session needs
    /// the editor's equipment context and waits until the editor next opens.
    private func apply(_ command: LiveWorkoutCommand, to session: WorkoutSession, in store: LocalStore) {
        if case .select(let exerciseID) = command {
            if session.blocks.locate(exerciseID) != nil { live.currentExercise = exerciseID }
            return
        }
        let fill = Fill(drafts: live.drafts, suggestions: live.suggestions, appliedRows: live.appliedRows, settings: inputs.settings, history: history)
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
                let settings = inputs.settings
                let step = SessionFlow.afterCompleting(path, in: blocks, settings: settings.workout.flow) { [catalog, exerciseSettings = inputs.exerciseSettings] item, set in
                    item.restSeconds(after: set, exercise: catalog?.exercise(item.exerciseID), settings: .of(item.exerciseID, in: exerciseSettings), defaults: settings)
                }
                if let seconds = step.restSeconds { live.startRest(seconds: seconds, alerts: settings.workout.rest) }
                if let next = step.next { live.currentExercise = next }
            case .draft(let rowID, let value):
                live.drafts[rowID] = value
            }
        }
    }

    /// Done on Workout Complete with Update Workout Plan off. The phone's cover closes once the session has ended.
    private func finish(_ session: WorkoutSession, in store: LocalStore) {
        if live.pausedAt != nil {
            let paused = live.resume()
            store.modify(WorkoutSession.self, id: session.id) { $0.pausedSeconds += paused }
        }
        let endedAt = Date.now
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

    func apply(_ command: LiveWorkoutCommand, to blocks: inout [WorkoutBlock]) -> Outcome {
        switch command {
        case .log(let rowID, let values):
            guard let path = blocks.path(of: rowID), blocks.log(at: path) == nil else { return .none }
            blocks.setLog(SetEntry(values, keeping: entry(path, in: blocks)).log(at: .now), at: path)
            return .logged(rowID: rowID, path: path, blocks: blocks)
        case .unlog(let rowID):
            guard let path = blocks.path(of: rowID), let log = blocks.log(at: path) else { return .none }
            blocks.setLog(nil, at: path)
            return .draft(rowID: rowID, SetEntry(log))
        case .edit(let rowID, let values):
            guard let path = blocks.path(of: rowID) else { return .none }
            let value = SetEntry(values, keeping: entry(path, in: blocks))
            guard let log = blocks.log(at: path) else { return .draft(rowID: rowID, value) }
            blocks.setLog(value.log(at: log.completedAt), at: path)
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
