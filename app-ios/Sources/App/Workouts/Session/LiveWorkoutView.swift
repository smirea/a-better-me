import SwiftData
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
        case info(ExerciseID), warmUp, targets, swap(ExerciseID), add, note, restTimer
        var id: String { String(describing: self) }
    }

    let session: WorkoutSession
    let mode: Mode

    @Environment(ExerciseCatalog.self) var catalog
    @Environment(LiveWorkoutPresenter.self) var presenter
    @Environment(\.modelContext) var context
    @Environment(\.dismiss) var dismiss
    @Query var exerciseSettings: [ExerciseSettings]
    @AppStorage(WeightUnit.storageKey) var unit = WeightUnit.kg

    @State var blocks: [WorkoutBlock]
    @State var current: BlockExercise.ID?
    @State var focus: KeypadFocus?
    @State var sheet: Sheet?
    /// Earlier sessions' blocks, newest first, for the Previous column. Decoded once, since history can't change here.
    @State var history: [[WorkoutBlock]] = []
    @State private var confirmingFinish = false
    @State private var confirmingDiscard = false
    @State private var confirmingExit = false
    @State private var isShowingSummary = false
    @State private var discardOnDisappear = false

    /// Unlogged values typed while editing a past session stay in the editor, apart from the live session's store.
    @State private var pastDrafts: [UUID: SetEntry] = [:]

    var store: LiveSessionStore { .shared }

    var drafts: [UUID: SetEntry] {
        get { mode == .live ? store.drafts : pastDrafts }
        nonmutating set { if mode == .live { store.drafts = newValue } else { pastDrafts = newValue } }
    }

    init(session: WorkoutSession, mode: Mode) {
        self.session = session
        self.mode = mode
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
            if let focus { keypad(for: focus) }
        }
        .background(Theme.background)
        .animation(.snappy(duration: 0.2), value: focus == nil)
        .task {
            let start = session.startedAt
            let id = session.id
            let descriptor = FetchDescriptor<WorkoutSession>(
                predicate: #Predicate { $0.endedAt != nil && $0.startedAt < start && $0.id != id },
                sortBy: [SortDescriptor(\.startedAt, order: .reverse)]
            )
            history = ((try? context.fetch(descriptor)) ?? []).map(\.blocks)
        }
        .onChange(of: blocks) { _, blocks in
            if mode == .live { session.blocks = blocks }
        }
        .onChange(of: current) { _, current in
            if mode == .live { store.currentExercise = current }
            focus = nil
        }
        .onDisappear {
            guard discardOnDisappear else { return }
            store.reset()
            context.delete(session)
            try? context.save()
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
                    Button("Minimize Workout", systemImage: "rectangle.bottomhalf.inset.filled") { presenter.isExpanded = false }
                    Button("Finish Workout", systemImage: "flag.checkered") { requestFinish() }
                    Button("Discard Workout", systemImage: "trash", role: .destructive) { confirmingDiscard = true }
                } label: {
                    Image(systemName: "line.3.horizontal").font(.title3).frame(width: 32, height: 32)
                }
                .accessibilityLabel("Workout Options")
                TimelineView(.periodic(from: .now, by: 1)) { context in
                    Text(Duration.seconds(context.date.timeIntervalSince(session.startedAt)).formatted(.time(pattern: .hourMinuteSecond)))
                        .font(AppFont.number(17))
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
                    session.blocks = blocks
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
            chips(item: item, isSuperset: blocks[block].isSuperset)
            setTable(block: block, exercise: index, fields: SetField.fields(for: exercise))
                .padding(.horizontal, 20)
            if let note = item.note, !note.isEmpty { noteCard("Session Note", note) }
            if !pinned.isEmpty { noteCard("Pinned Note", pinned) }
        }
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

    private func chips(item: BlockExercise, isSuperset: Bool) -> some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                chip("Info", "chart.bar.fill") { sheet = .info(item.exerciseID) }
                chip("Warm Up", "flame.fill") { sheet = .warmUp }
                chip("Targets", "scope") { sheet = .targets }
                chip("Swap", "arrow.left.arrow.right") { sheet = .swap(item.exerciseID) }
                chip("Note", "note.text") { sheet = .note }
                if isSuperset {
                    Menu {
                        Button("Detach from Superset", systemImage: "link.badge.minus") { blocks.detach(item.id) }
                    } label: { chipLabel("Superset", "arrow.triangle.2.circlepath") }
                }
                Menu {
                    Button("Remove from Workout", systemImage: "trash", role: .destructive) { remove(item.id) }
                } label: { chipLabel("More", "ellipsis") }
            }
            .padding(.horizontal, 20)
        }
        .scrollIndicators(.hidden)
    }

    private func chip(_ title: String, _ icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) { chipLabel(title, icon) }
    }

    private func chipLabel(_ title: String, _ icon: String) -> some View {
        Label(title, systemImage: icon)
            .font(AppFont.medium(14))
            .foregroundStyle(Theme.textPrimary)
            .padding(.horizontal, 12)
            .frame(height: 32)
            .background(Theme.surfaceRaised, in: Capsule())
    }

    // MARK: Sheets

    @ViewBuilder
    private func sheetContent(_ sheet: Sheet) -> some View {
        switch sheet {
        case let .info(id):
            ExerciseDetailSheet(exerciseID: id)
        case .warmUp:
            if let position = currentPosition {
                WarmUpSheet(workingWeightKg: firstWorkingWeight(block: position.block, exercise: position.exercise), unit: unit) { warmUps in
                    addWarmUps(warmUps, block: position.block, exercise: position.exercise)
                }
            }
        case .targets:
            if let position = currentPosition {
                SetTargetsSheet(exercise: $blocks[position.block].exercises[position.exercise], allowsWarmUp: true)
            }
        case let .swap(id):
            ExercisePicker(mode: .swap(id)) { pick in
                if let replacement = pick.exerciseIDs.first, let current { swap(current, to: replacement) }
            }
        case .add:
            ExercisePicker(mode: .add) { add($0) }
        case .note:
            if let position = currentPosition {
                NoteSheet(
                    sessionNote: $blocks[position.block].exercises[position.exercise].note,
                    exerciseID: blocks[position.block].exercises[position.exercise].exerciseID
                )
            }
        case .restTimer:
            RestTimerSheet()
        }
    }

    // MARK: Finishing

    private func requestFinish() {
        let allDone = blocks.flatMap(\.exercises).allSatisfy { $0.sets.allSatisfy(\.isDone) }
        if allDone { finish(logAll: false) } else { confirmingFinish = true }
    }

    private func finish(logAll: Bool) {
        focus = nil
        if logAll {
            let prefills = SessionFlow.prefills(for: blocks, history: history)
            blocks = SessionFlow.logAll(blocks, at: .now) { drafts[$0] ?? prefills[$0] ?? SetEntry() }
        }
        session.blocks = blocks
        // The session ends on the summary's Done; saving now keeps the logged sets if the app dies before that.
        try? context.save()
        store.stopRest()
        isShowingSummary = true
    }
}
