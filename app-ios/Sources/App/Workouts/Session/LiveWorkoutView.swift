import SwiftUI

/// The full-screen live workout. The root view presents it over the tab bar while `LiveWorkoutPresenter.isExpanded`.
struct LiveWorkoutView: View {
    let session: WorkoutSession

    var body: some View { SessionEditor(session: session, mode: .live) }
}

/// The set-logging screen. Live, it times rest and writes every change through to the session. Editing a past
/// session ("Edit Workout" on its summary) keeps changes local until Save.
struct SessionEditor: View {
    enum Mode { case live, editPast }

    enum Sheet: Identifiable {
        case info(ExerciseID), progression, warmUp, targets, swap(ExerciseID), add, note, restTimer, settings, gym, equipment, equipmentSettings
        var id: String { String(describing: self) }
    }

    let session: WorkoutSession
    let mode: Mode

    @Environment(ExerciseCatalog.self) var catalog
    @Environment(LiveWorkoutPresenter.self) var presenter
    @Environment(LocalStore.self) var localStore
    @Environment(\.dismiss) var dismiss
    @Observe(ExerciseSettings.all) var exerciseSettings
    @Observe(AppSettings.current) var defaults
    @Observe(BodyWeight.all) private var bodyWeights
    @Observe(GymProfile.all) var gyms
    @Observe(GymProfile.defaultGym) var defaultGym
    /// The session's row as it changes under the editor, which `session` cannot show once the cover is up.
    @Observe private var live: WorkoutSession?

    @State var blocks: [WorkoutBlock]
    @State var current: BlockExercise.ID?
    @State var focus: KeypadFocus?
    @State var sheet: Sheet?
    /// Earlier sessions' blocks, newest first, for the Previous column. Decoded once, since history can't change here.
    @State var history: [[WorkoutBlock]] = []
    @State private var historyLoaded = false
    @State private var confirmingFinish = false
    @State private var confirmingDiscard = false
    @State private var confirmingExit = false
    @State private var isShowingSummary = false
    @State private var discardOnDisappear = false

    /// Unlogged values typed while editing a past session stay in the editor, apart from the live session's store.
    @State private var pastDrafts: [UUID: SetEntry] = [:]

    var store: LiveSessionStore { .shared }
    var unit: WeightUnit { defaults.weightUnit }

    var reference: ReferenceColumn {
        guard mode == .live else { return .previous }
        return store.referenceColumn ?? (defaults.workout.progression.initialFill == .smartProgression ? .auto : .previous)
    }

    var drafts: [UUID: SetEntry] {
        get { mode == .live ? store.drafts : pastDrafts }
        nonmutating set { if mode == .live { store.drafts = newValue } else { pastDrafts = newValue } }
    }

    init(session: WorkoutSession, mode: Mode) {
        self.session = session
        self.mode = mode
        _live = Observe(WorkoutSession.one(session.id))
        let blocks = session.blocks
        _blocks = State(initialValue: blocks)
        let remembered = mode == .live ? LiveSessionStore.shared.currentExercise : nil
        _current = State(initialValue: remembered ?? SessionFlow.initialExercise(in: blocks))
    }

    var body: some View {
        if isShowingSummary {
            WorkoutSummaryView(session: session, isFinishing: true)
        } else {
            editor
        }
    }

    private var editor: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    exerciseStrip
                    if let position = currentPosition {
                        exerciseContent(block: position.block, exercise: position.exercise)
                    } else {
                        ContentUnavailableView("No exercises", systemImage: "dumbbell", description: Text("Add an exercise to start logging."))
                    }
                }
                .padding(.vertical, 12)
            }
            .scrollDismissesKeyboard(.never)
            if let focus {
                plateCalculator(for: focus)
                keypad(for: focus)
            }
        }
        .background(Theme.background)
        .animation(.snappy(duration: 0.2), value: focus == nil)
        .task {
            let session = session
            var earlier = (try? localStore.read { try WorkoutSession.earlier(than: session, $0) }) ?? []
            if defaults.workout.previousReference == .withinProgram, let programID = session.program?.programID {
                earlier = earlier.filter { $0.program?.programID == programID }
            }
            history = earlier.map(\.blocks)
            historyLoaded = true
            ensureSuggestions()
            automateWarmUps()
        }
        .onChange(of: blocks) { _, blocks in
            guard mode == .live else { return }
            saveBlocks(blocks)
            ensureSuggestions()
        }
        // A set logged on another device replaces the live copy while no write of this device's is still on its way.
        .onChange(of: live?.blocks) { _, remote in
            if mode == .live, let remote, localStore.pendingWrites == 0, remote != blocks { blocks = remote }
        }
        .onChange(of: current) { _, current in
            if mode == .live { store.currentExercise = current }
            focus = nil
        }
        .onAppear { UIApplication.shared.isIdleTimerDisabled = mode == .live && defaults.workout.display.keepAlive }
        .onChange(of: defaults.workout.display.keepAlive) { _, keepAlive in
            UIApplication.shared.isIdleTimerDisabled = mode == .live && keepAlive
        }
        .onDisappear {
            UIApplication.shared.isIdleTimerDisabled = false
            guard discardOnDisappear else { return }
            store.reset()
            localStore.delete(WorkoutSession.self, id: session.id)
        }
        .sheet(item: $sheet) { sheetContent($0) }
        .alert("Finish this workout?", isPresented: $confirmingFinish) {
            Button("Log All Sets") { finish(logAll: true) }
            Button("Log Only Completed Sets") { finish(logAll: false) }
            Button("Cancel", role: .cancel) {}
        } message: {
            let count = SessionFlow.loggedExerciseCount(in: blocks)
            Text("You've logged \(count.logged) of \(count.total) exercises. You can log both completed and unlogged sets using the current values, or log only completed sets.")
        }
        .alert("Discard this workout?", isPresented: $confirmingDiscard) {
            Button("Discard", role: .destructive) {
                discardOnDisappear = true
                presenter.isExpanded = false
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Nothing from this workout will be saved.")
        }
        .alert("Exit the editor?", isPresented: $confirmingExit) {
            Button("Exit", role: .destructive) { dismiss() }
            Button("Stay", role: .cancel) {}
        } message: {
            Text("Changes you made to your workout will be discarded.")
        }
    }

    var currentPosition: (block: Int, exercise: Int)? {
        guard let current, let at = blocks.locate(current) else { return nil }
        return (at.block, at.item)
    }

    // MARK: Header

    private var header: some View {
        HStack(spacing: 16) {
            switch mode {
            case .live:
                Menu {
                    if store.pausedAt == nil {
                        Button("Pause Workout", systemImage: "pause.fill") { store.pause() }
                    } else {
                        Button("Resume Workout", systemImage: "play.fill") { resumeWorkout() }
                    }
                    Button("Minimize Workout", systemImage: "rectangle.bottomhalf.inset.filled") { presenter.isExpanded = false }
                    Button("Finish Workout", systemImage: "flag.checkered") { requestFinish() }
                    Button("Workout Settings", systemImage: "dumbbell.fill") { sheet = .settings }
                    Button("Gym Settings", systemImage: "house.fill") { sheet = .gym }
                    Button("Discard Workout", systemImage: "trash", role: .destructive) { confirmingDiscard = true }
                } label: {
                    Image(systemName: "line.3.horizontal").font(.title3).frame(width: 32, height: 32)
                }
                .accessibilityLabel("Workout Options")
                if store.pausedAt != nil {
                    Text("Paused")
                        .font(AppFont.headline(13))
                        .padding(.horizontal, 10)
                        .frame(height: 26)
                        .background(Theme.surfaceRaised, in: Capsule())
                        .accessibilityLabel("Workout paused")
                } else if defaults.workout.display.workoutTimer {
                    TimelineView(.periodic(from: .now, by: 1)) { context in
                        Text(Duration.seconds((live ?? session).elapsed(at: context.date, pausedAt: nil)).formatted(.time(pattern: .hourMinuteSecond)))
                            .font(AppFont.number(17))
                    }
                }
                Spacer()
                RestTimerPill { sheet = .restTimer }
            case .editPast:
                Button("Close", systemImage: "xmark") {
                    if blocks == session.blocks { dismiss() } else { confirmingExit = true }
                }
                .labelStyle(.iconOnly)
                Spacer()
                Text("Edit Workout").font(AppFont.headline())
                Spacer()
                Button("Save") {
                    saveBlocks(blocks)
                    dismiss()
                }
                .font(AppFont.headline())
            }
        }
        .foregroundStyle(Theme.textPrimary)
        .padding(.horizontal, 20)
        .frame(height: 52)
    }

    // MARK: Exercise strip

    private var exerciseStrip: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 4) {
                ForEach(blocks.flatMap(\.exercises)) { item in
                    Button { current = item.id } label: { stripTile(item) }
                        .accessibilityLabel(catalog.name(item.exerciseID))
                }
                Button { sheet = .add } label: {
                    VStack(spacing: 6) {
                        Image(systemName: "plus")
                            .font(.title3)
                            .frame(width: 48, height: 60)
                            .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 6))
                        Capsule().fill(Theme.surfaceRaised).frame(height: 3)
                    }
                    .foregroundStyle(Theme.textSecondary)
                }
                .accessibilityLabel("Add Exercise")
            }
            .padding(.horizontal, 20)
        }
        .scrollIndicators(.hidden)
    }

    private func stripTile(_ item: BlockExercise) -> some View {
        VStack(spacing: 6) {
            Group {
                if let exercise = catalog.exercise(item.exerciseID) { ExerciseImage(exercise: exercise) } else { Theme.surfaceRaised }
            }
            .frame(width: 48, height: 60)
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .overlay {
                if item.isDone {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.title3)
                        .foregroundStyle(.black, Theme.textPrimary)
                }
            }
            Capsule()
                .fill(item.id == current ? Theme.textPrimary : Theme.surfaceRaised)
                .frame(height: 3)
        }
    }

    // MARK: Current exercise

    private func exerciseContent(block: Int, exercise index: Int) -> some View {
        let item = blocks[block].exercises[index]
        let exercise = catalog.exercise(item.exerciseID)
        let pinned = exerciseSettings.first { $0.id == item.exerciseID }?.pinnedNote ?? ""
        return VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 2) {
                Text(catalog.name(item.exerciseID)).font(AppFont.title())
                Text(SessionFlow.subtitle(for: (block, index), in: blocks))
                    .font(AppFont.caption(14))
                    .foregroundStyle(Theme.textSecondary)
            }
            .padding(.horizontal, 20)
            chips(item: item, isSuperset: blocks[block].isSuperset, hiddenWarmUps: hiddenWarmUpCount(block: block, exercise: index))
            setTable(block: block, exercise: index, fields: SetField.fields(for: exercise))
                .padding(.horizontal, 20)
            if let caption = bodyweightCaption(exercise) {
                Text(caption).font(AppFont.caption()).foregroundStyle(Theme.textSecondary).padding(.horizontal, 20)
            }
            if let note = item.note, !note.isEmpty { noteCard("Session Note", note) }
            if !pinned.isEmpty { noteCard("Pinned Note", pinned) }
        }
    }

    /// Bodyweight Contribution: "Body weight 80 kg · 65% counted (52 kg)", for exercises that lift part of the body.
    private func bodyweightCaption(_ exercise: Exercise?) -> String? {
        guard mode == .live, defaults.workout.display.bodyweightContribution, let fraction = exercise?.bodyweightFraction, fraction > 0,
              let kg = currentBodyWeightKg(logged: bodyWeights, health: nil, manual: defaults.profile.bodyWeightKg) else { return nil }
        let percent = (fraction * 100).formatted(.number.precision(.fractionLength(0)))
        return "Body weight \(unit.format(kg: kg)) \(unit.rawValue) · \(percent)% counted (\(unit.format(kg: kg * fraction)) \(unit.rawValue))"
    }

    private func noteCard(_ title: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(AppFont.headline(14))
            Text(text).font(AppFont.body(14)).foregroundStyle(Theme.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.cornerRadius))
        .padding(.horizontal, 20)
    }

    private func chips(item: BlockExercise, isSuperset: Bool, hiddenWarmUps: Int) -> some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                if mode == .live { progressionChip(item) }
                chip("Info", "chart.bar.fill") { sheet = .info(item.exerciseID) }
                Button { sheet = .warmUp } label: { chipLabel("Warm Up", "flame.fill", badge: hiddenWarmUps) }
                    .accessibilityLabel(hiddenWarmUps > 0 ? "Warm Up, \(hiddenWarmUps) completed hidden" : "Warm Up")
                chip("Targets", "scope") { sheet = .targets }
                chip("Swap", "arrow.left.arrow.right") { sheet = .swap(item.exerciseID) }
                chip("Note", "note.text") { sheet = .note }
                if isSuperset {
                    Menu {
                        Button("Detach from Superset", systemImage: "link.badge.minus") { blocks.detach(item.id) }
                    } label: { chipLabel("Superset", "arrow.triangle.2.circlepath") }
                }
                if catalog.exercise(item.exerciseID)?.hasEquipmentChoice == true {
                    chip("Equipment", "dumbbell.fill") { sheet = .equipment }
                }
                Menu {
                    Button("Remove from Workout", systemImage: "trash", role: .destructive) { remove(item.id) }
                } label: { chipLabel("More", "ellipsis") }
            }
            .padding(.horizontal, 20)
        }
        .scrollIndicators(.hidden)
    }

    /// The wand: a blue dot marks an exercise whose target rep range Expand Rep Range widened.
    private func progressionChip(_ item: BlockExercise) -> some View {
        let adjusted = store.suggestions[item.id]?.values.contains { $0.adjustedReps != nil } ?? false
        return Button { sheet = .progression } label: {
            Image(systemName: "wand.and.stars")
                .font(AppFont.medium(14))
                .foregroundStyle(Theme.textPrimary)
                .frame(width: 44, height: 32)
                .background(Theme.surfaceRaised, in: Capsule())
                .overlay(alignment: .bottomTrailing) {
                    if adjusted { Circle().fill(Theme.muscle).frame(width: 7, height: 7).offset(x: -3, y: -3) }
                }
        }
        .accessibilityLabel("Smart Progression")
    }

    private func chip(_ title: String, _ icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) { chipLabel(title, icon) }
    }

    private func chipLabel(_ title: String, _ icon: String, badge: Int = 0) -> some View {
        Label(title, systemImage: icon)
            .font(AppFont.medium(14))
            .foregroundStyle(Theme.textPrimary)
            .padding(.horizontal, 12)
            .frame(height: 32)
            .background(Theme.surfaceRaised, in: Capsule())
            .overlay(alignment: .topTrailing) {
                if badge > 0 {
                    Text("\(badge)")
                        .font(AppFont.headline(11))
                        .foregroundStyle(.white)
                        .frame(minWidth: 18, minHeight: 18)
                        .background(Theme.muscle, in: Circle())
                        .offset(x: 4, y: -4)
                }
            }
    }

    // MARK: Sheets

    @ViewBuilder
    private func sheetContent(_ sheet: Sheet) -> some View {
        switch sheet {
        case let .info(id):
            ExerciseDetailSheet(exerciseID: id)
        case .progression:
            if let position = currentPosition {
                let item = blocks[position.block].exercises[position.exercise]
                SmartProgressionSheet(
                    exerciseName: catalog.name(item.exerciseID), sets: item.sets,
                    suggestions: store.suggestions[item.id] ?? [:], events: store.events[item.id] ?? [], unit: unit
                )
            }
        case .warmUp:
            if let position = currentPosition {
                WarmUpSheet(context: warmUpContext(block: position.block, exercise: position.exercise), unit: unit) { warmUps in
                    addWarmUps(warmUps, block: position.block, exercise: position.exercise)
                }
            }
        case .targets:
            if let position = currentPosition {
                SetTargetsSheet(exercise: $blocks[position.block].exercises[position.exercise], allowsWarmUp: true)
            }
        case let .swap(id):
            ExercisePicker(mode: .swap(id), gymID: sessionGym?.id) { pick in
                if let replacement = pick.exerciseIDs.first, let current { swap(current, to: replacement) }
            }
        case .add:
            ExercisePicker(mode: .add, gymID: sessionGym?.id) { add($0) }
        case .note:
            if let position = currentPosition {
                NoteSheet(
                    sessionNote: $blocks[position.block].exercises[position.exercise].note,
                    exerciseID: blocks[position.block].exercises[position.exercise].exerciseID
                )
            }
        case .restTimer:
            RestTimerSheet()
        case .settings:
            closableSheet { WorkoutSettingsView() }
        case .gym:
            closableSheet {
                if let gymID = sessionGym?.id { GymProfileEditor(gymID: gymID) } else { GymProfilesView() }
            }
        case .equipment:
            equipmentSheet()
        case .equipmentSettings:
            closableSheet { equipmentSettingsView() }
        }
    }

    /// The More tab's screens, presented over the live workout with a Close button they don't need when pushed.
    private func closableSheet(@ViewBuilder content: () -> some View) -> some View {
        NavigationStack {
            content().toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { sheet = nil }
                }
            }
        }
    }

    // MARK: Finishing

    private func requestFinish() {
        let allDone = blocks.flatMap(\.exercises).allSatisfy { $0.sets.allSatisfy(\.isDone) }
        if allDone { finish(logAll: false) } else { confirmingFinish = true }
    }

    private func finish(logAll: Bool) {
        focus = nil
        if store.pausedAt != nil { resumeWorkout() }
        if logAll {
            let suggestions = defaults.workout.progression.initialFill == .smartProgression ? store.suggestions : [:]
            let prefills = SessionFlow.prefills(for: blocks, history: history, suggestions: suggestions, rirTracking: defaults.workout.rirTracking, unit: unit)
            blocks = SessionFlow.logAll(blocks, at: .now) { drafts[$0] ?? prefills[$0] ?? SetEntry() }
        }
        // The session ends on the summary's Done; saving now keeps the logged sets if the app dies before that.
        saveBlocks(blocks)
        store.stopRest()
        isShowingSummary = true
    }

    private func saveBlocks(_ blocks: [WorkoutBlock]) {
        localStore.modify(WorkoutSession.self, id: session.id) { $0.blocks = blocks }
    }

    private func resumeWorkout() {
        let paused = store.resume()
        localStore.modify(WorkoutSession.self, id: session.id) { $0.pausedSeconds += paused }
    }

    // MARK: Smart Progression

    func progressionSettings(for exerciseID: ExerciseID) -> ProgressionSettings {
        var settings = defaults.workout.progression
        let overrides = ExerciseSettings.of(exerciseID, in: exerciseSettings)?.overrides
        if let expand = overrides?.expandRepRange { settings.expandRepRange = expand }
        if let match = overrides?.weightMatch { settings.weightMatch = match }
        return settings
    }

    /// Suggests every exercise whose planned rows changed since its last fill: a new exercise, a Targets edit, or an
    /// added set. The Event Log keeps earlier fills.
    func ensureSuggestions() {
        guard mode == .live, historyLoaded else { return }
        for item in blocks.flatMap(\.exercises) {
            let planned = item.sets.map(\.planned)
            guard store.suggestionBasis[item.id] != planned else { continue }
            let previous = SessionFlow.previousSets(of: item.exerciseID, in: history)
            let suggestions = SmartProgression.suggest(
                sets: item.sets, previous: previous, settings: progressionSettings(for: item.exerciseID),
                loadable: LoadableWeights(loading: loading(for: item), unit: unit), rirTracking: defaults.workout.rirTracking, unit: unit
            )
            store.suggestions[item.id] = suggestions
            store.suggestionBasis[item.id] = planned
            store.events[item.id, default: []].append(SmartProgression.event(at: .now, sets: item.sets, suggestions: suggestions))
            applyProgression(to: item.id)
        }
    }

    /// Apply in session: the exercise's open rows take the fill its latest logged set predicts.
    func applyProgression(to id: BlockExercise.ID) {
        guard defaults.workout.progression.applyInSession, let at = blocks.locate(id), let current = store.suggestions[id] else { return }
        let item = blocks[at.block].exercises[at.item]
        let changed = SmartProgression.applyInSession(
            sets: item.sets, current: current, settings: progressionSettings(for: item.exerciseID),
            loadable: LoadableWeights(loading: loading(for: item), unit: unit), rirTracking: defaults.workout.rirTracking, unit: unit
        )
        guard !changed.isEmpty else { return }
        store.suggestions[id] = current.merging(changed) { $1 }
        for rowID in changed.keys { store.drafts[rowID] = nil }
        store.appliedRows.formUnion(changed.keys)
        store.events[id, default: []].append(SmartProgression.event(at: .now, sets: item.sets, suggestions: changed))
    }
}
