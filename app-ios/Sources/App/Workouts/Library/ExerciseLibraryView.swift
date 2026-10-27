import SwiftUI

/// Settings > Exercises: the picker's list and filters with MF's All, Performed, Deprioritized (Do Not Recommend),
/// Modified (any Exercise Override), and Archived tabs. A row opens Exercise Settings.
struct ExerciseLibraryView: View {
    @Environment(SessionHistory.self) private var history
    @Observe(CustomExercise.all) private var customExercises
    @Observe(ExerciseSettings.all) private var exerciseSettings
    @State private var tab = LibraryTab.all
    @State private var filter = ExerciseFilter()
    @State private var query = ""
    @State private var creating = false
    @State private var opened: ExerciseRef?

    enum LibraryTab: String, CaseIterable, Identifiable {
        case all = "All", performed = "Performed", deprioritized = "Deprioritized", modified = "Modified", archived = "Archived"
        var id: Self { self }
    }

    private struct PerformedCountsKey: Hashable {}

    var body: some View {
        let counts = history.memo(PerformedCountsKey()) { ExerciseLibrary.performedCounts($0) }
        let scope: BrowseScope = switch tab {
        case .all: .except(Set(customExercises.filter(\.isArchived).map(\.id)))
        case .performed: .only(Set(counts.keys))
        case .deprioritized: .only(Set(exerciseSettings.filter(\.doNotRecommend).map(\.id)))
        case .modified: .only(Set(exerciseSettings.filter(\.isModified).map(\.id)))
        case .archived: .only(Set(customExercises.filter(\.isArchived).map(\.id)))
        }
        ExerciseBrowser(
            scope: scope,
            filter: $filter,
            query: query,
            subtitle: { counts[$0.id].map { "Performed \($0) \($0 == 1 ? "time" : "times")" } },
            onSelect: { opened = ExerciseRef(id: $0.id) },
            header: { UnderlineTabs(items: LibraryTab.allCases.map { ($0, $0.rawValue) }, selection: $tab) },
            trailing: { _ in Image(systemName: "chevron.right").foregroundStyle(Theme.textTertiary) }
        )
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search for an exercise")
        .detailTitle("Exercises")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Create Custom Exercise", systemImage: "plus") { creating = true }
            }
        }
        .navigationDestination(item: $opened) { ExerciseSettingsView(exerciseID: $0.id) }
        .sheet(isPresented: $creating) { CustomExerciseWizard() }
    }
}

enum ExerciseLibrary {
    /// How many finished sessions completed at least one set of each exercise.
    static func performedCounts(_ sessions: [WorkoutSession]) -> [ExerciseID: Int] {
        var counts: [ExerciseID: Int] = [:]
        for session in sessions {
            let ids = Set(session.blocks.flatMap(\.exercises).filter { $0.sets.contains(where: \.isCompleted) }.map(\.exerciseID))
            for id in ids { counts[id, default: 0] += 1 }
        }
        return counts
    }
}

/// Exercise Settings: Info, the pinned note, Do Not Recommend, Archive and Delete for custom exercises, and the
/// Exercise Overrides that fall back to the gym profile and Workout settings.
struct ExerciseSettingsView: View {
    let exerciseID: ExerciseID
    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Observe private var current: ExerciseSettings?
    @Observe(AppSettings.current) private var defaults
    @Observe private var customExercise: CustomExercise?
    @State private var showingInfo = false
    @State private var editingNote = false
    @State private var noteDraft = ""
    @State private var confirmingDelete = false
    @State private var duplicate: CustomExerciseDraft?

    init(exerciseID: ExerciseID) {
        self.exerciseID = exerciseID
        _current = Observe(ExerciseSettings.one(exerciseID))
        _customExercise = Observe(CustomExercise.one(exerciseID))
    }

    private static let noteLimit = 300

    var body: some View {
        let exercise = catalog.exercise(exerciseID)
        let category = exercise?.restCategory ?? .upperIsolation
        Form {
            ThemedSection("General") {
                Button { showingInfo = true } label: {
                    SettingsRow(title: "Info", subtitle: "View instructions, exercise details, and history", systemImage: "chart.bar.fill") {
                        Image(systemName: "chevron.right").foregroundStyle(Theme.textTertiary)
                    }
                }
                .buttonStyle(.plain)
                SettingsRow(
                    title: "Exercise Note",
                    subtitle: current?.pinnedNote.nilIfEmpty ?? "Note will display on this exercise every time you work out",
                    systemImage: "pin.fill"
                ) {
                    Button(current?.pinnedNote.isEmpty == false ? "Edit" : "Add") {
                        noteDraft = current?.pinnedNote ?? ""
                        editingNote = true
                    }
                }
                SettingsRow(
                    title: "Do Not Recommend",
                    subtitle: "This exercise will not be recommended when creating programs",
                    systemImage: "hand.thumbsdown.fill"
                ) {
                    Toggle("Do Not Recommend", isOn: Binding {
                        current?.doNotRecommend ?? false
                    } set: { on in
                        change { $0.doNotRecommend = on }
                    })
                    .labelsHidden()
                    .tint(Theme.accent)
                }
                if let exercise {
                    Button {
                        duplicate = CustomExerciseDraft(duplicating: exercise, instructions: catalog.instructions(for: exercise))
                    } label: {
                        SettingsRow(
                            title: "Edit Duplicate",
                            subtitle: "To edit all available exercise properties, create a duplicate",
                            systemImage: "plus.square.on.square"
                        ) {
                            Image(systemName: "chevron.right").foregroundStyle(Theme.textTertiary)
                        }
                    }
                    .buttonStyle(.plain)
                }
                if let customExercise {
                    SettingsRow(
                        title: customExercise.isArchived ? "Unarchive Exercise" : "Archive Exercise",
                        subtitle: "This will hide the exercise in your custom library, but will not impact your history",
                        systemImage: "archivebox.fill"
                    ) {
                        Button(customExercise.isArchived ? "Unarchive" : "Archive") {
                            store.modify(CustomExercise.self, id: exerciseID) { $0.isArchived.toggle() }
                        }
                    }
                    SettingsRow(
                        title: "Delete Exercise",
                        subtitle: "This will remove the exercise from your custom library. Logged sets stay in your history.",
                        systemImage: "trash.fill",
                        iconTint: Theme.destructive
                    ) {
                        Button("Delete", role: .destructive) { confirmingDelete = true }
                    }
                }
            }
            ThemedSection("Exercise Overrides") {
                ForEach(ExerciseOverrideRow.allCases) { row in
                    overrideRow(row, category: category)
                }
                Button {
                    change {
                        $0.overrides = ExerciseOverrides()
                        $0.restSeconds = nil
                    }
                } label: {
                    SettingsRow(
                        title: "Reset Defaults",
                        subtitle: "Remove all exercise level overrides",
                        systemImage: "arrow.counterclockwise",
                        iconTint: Theme.destructive
                    ) { EmptyView() }
                }
                .buttonStyle(.plain)
                .disabled(current?.isModified != true)
            }
        }
        .themedList()
        .detailTitle(exercise?.name ?? "Exercise")
        .sheet(isPresented: $showingInfo) { ExerciseDetailSheet(exerciseID: exerciseID) }
        .sheet(isPresented: .isPresent($duplicate)) {
            if let duplicate { CustomExerciseWizard(draft: duplicate) }
        }
        .alert("Exercise Note", isPresented: $editingNote) {
            TextField("Note", text: $noteDraft, axis: .vertical)
            Button("Save") {
                let note = String(noteDraft.prefix(Self.noteLimit))
                change { $0.pinnedNote = note }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Pinned to this exercise and shown every time you work out.")
        }
        .confirmationDialog("Delete this exercise?", isPresented: $confirmingDelete, titleVisibility: .visible) {
            Button("Delete Exercise", role: .destructive) {
                store.delete(CustomExercise.self, id: exerciseID)
                store.delete(ExerciseSettings.self, id: exerciseID)
                dismiss()
            }
        }
    }

    @ViewBuilder
    private func overrideRow(_ row: ExerciseOverrideRow, category: RestCategory) -> some View {
        let workout = defaults.workout
        let summary = row.summary(current)
        switch row {
        case .equipmentWeights:
            NavigationLink {
                EquipmentWeightsOverrideView(exerciseID: exerciseID)
            } label: {
                SettingsRow(title: row.title, subtitle: summary, systemImage: row.systemImage) { EmptyView() }
            }
        case .restTimer:
            SettingsRow(title: row.title, subtitle: summary, systemImage: row.systemImage) {
                Menu("Edit") {
                    Picker(row.title, selection: restBinding) {
                        Text("Default (\(defaults.restSeconds(category).minuteSecond))").tag(Int?.none)
                        ForEach(Array(stride(from: 15, through: 600, by: 15)), id: \.self) {
                            Text($0.minuteSecond).tag(Optional($0))
                        }
                    }
                }
            }
        case .restBetweenSides:
            toggleRow(row, summary: summary, path: \.restBetweenSides, fallback: workout.rest.betweenSides)
        case .expandRepRange:
            toggleRow(row, summary: summary, path: \.expandRepRange, fallback: workout.progression.expandRepRange)
        case .weightMatch:
            toggleRow(row, summary: summary, path: \.weightMatch, fallback: workout.progression.weightMatch)
        case .warmUpAutomation:
            SettingsRow(title: row.title, subtitle: summary, systemImage: row.systemImage) {
                Menu("Edit") {
                    Picker(row.title, selection: overrideBinding(\.warmUpAutomation)) {
                        Text("Default (\(ExerciseOverrideRow.name(workout.warmUp.automation)))").tag(WarmUpAutomation?.none)
                        ForEach([WarmUpAutomation.none, .smart, .scheme], id: \.self) {
                            Text(ExerciseOverrideRow.name($0)).tag(Optional($0))
                        }
                    }
                }
            }
        case .warmUpScheme:
            NavigationLink {
                WarmUpSchemeEditor(
                    exerciseID: exerciseID,
                    scheme: current?.overrides.warmUpScheme,
                    defaultScheme: workout.warmUp.schemes[category] ?? WarmUpStep.standard
                )
            } label: {
                SettingsRow(title: row.title, subtitle: summary, systemImage: row.systemImage) { EmptyView() }
            }
        }
    }

    private func toggleRow(
        _ row: ExerciseOverrideRow, summary: String, path: WritableKeyPath<ExerciseOverrides, Bool?> & Sendable, fallback: Bool
    ) -> some View {
        SettingsRow(title: row.title, subtitle: summary, systemImage: row.systemImage) {
            Menu("Edit") {
                Picker(row.title, selection: overrideBinding(path)) {
                    Text("Default (\(ExerciseOverrideRow.onOff(fallback)))").tag(Bool?.none)
                    Text("On").tag(Optional(true))
                    Text("Off").tag(Optional(false))
                }
            }
        }
    }

    private var restBinding: Binding<Int?> {
        Binding { current?.restSeconds } set: { seconds in change { $0.restSeconds = seconds } }
    }

    private func overrideBinding<Value: Sendable>(_ path: WritableKeyPath<ExerciseOverrides, Value?> & Sendable) -> Binding<Value?> {
        Binding { current?.overrides[keyPath: path] } set: { value in change { $0.overrides[keyPath: path] = value } }
    }

    private func change(_ edit: @escaping @Sendable (inout ExerciseSettings) -> Void) {
        store.modify(ExerciseSettings.self, id: exerciseID, orInsert: { ExerciseSettings(id: exerciseID) }, edit)
    }
}

/// The W rows of one exercise's warm-up, as percent of the first working set's target weight and reps. Reset drops
/// the override so the exercise follows its category's scheme in Workout settings again.
private struct WarmUpSchemeEditor: View {
    let exerciseID: ExerciseID
    let defaultScheme: [WarmUpStep]
    let isOverridden: Bool
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var steps: [WarmUpStep]

    init(exerciseID: ExerciseID, scheme: [WarmUpStep]?, defaultScheme: [WarmUpStep]) {
        self.exerciseID = exerciseID
        self.defaultScheme = defaultScheme
        isOverridden = scheme != nil
        _steps = State(initialValue: scheme ?? defaultScheme)
    }

    /// Swipe-delete can re-evaluate a removed row's binding, so reads and writes past the end are ignored.
    private func step(at index: Int) -> Binding<WarmUpStep> {
        Binding {
            steps[safe: index] ?? WarmUpStep(percent: 0, reps: 0)
        } set: { step in
            if steps.indices.contains(index) { steps[index] = step }
        }
    }

    var body: some View {
        Form {
            ThemedSection(footer: "Percent of the first working set's target weight.") {
                ForEach(steps.indices, id: \.self) { index in
                    let step = step(at: index)
                    HStack(spacing: 12) {
                        SetBadge(type: .warmUp, number: 0, size: .compact)
                        Text("\(step.wrappedValue.percent)%").frame(width: 44, alignment: .leading)
                        Stepper("Percent", value: step.percent, in: 5...100, step: 5)
                            .labelsHidden()
                            .accessibilityValue("\(step.wrappedValue.percent)%")
                        Spacer()
                        Text("x \(step.wrappedValue.reps)").frame(width: 36, alignment: .leading)
                        Stepper("Reps", value: step.reps, in: 1...30)
                            .labelsHidden()
                            .accessibilityValue("\(step.wrappedValue.reps) reps")
                    }
                    .font(AppFont.rowTitle)
                }
                .onDelete { steps.remove(atOffsets: $0) }
                Button("Add Warm-Up Set", systemImage: "plus") {
                    let last = steps.last ?? WarmUpStep(percent: 30, reps: 5)
                    steps.append(WarmUpStep(percent: min(last.percent + 10, 100), reps: last.reps))
                }
            }
            ThemedSection {
                Button("Reset to Default", role: .destructive) {
                    save(nil)
                }
                .disabled(!isOverridden)
            }
        }
        .themedList()
        .detailTitle("Warm-Up Scheme")
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") { save(steps) }
            }
        }
    }

    private func save(_ scheme: [WarmUpStep]?) {
        store.modify(ExerciseSettings.self, id: exerciseID, orInsert: { ExerciseSettings(id: exerciseID) }) {
            $0.overrides.warmUpScheme = scheme
        }
        dismiss()
    }
}

private struct SettingsRow<Accessory: View>: View {
    let title: String
    let subtitle: String
    let systemImage: String
    var iconTint = Theme.textPrimary
    @ViewBuilder var accessory: Accessory

    var body: some View {
        HStack(spacing: 14) {
            RowLabel(title: title, detail: subtitle, systemImage: systemImage, iconTint: iconTint)
                .lineLimit(3)
                .frame(maxWidth: .infinity, alignment: .leading)
            accessory
                .font(AppFont.chip)
                .buttonStyle(.glass)
                .controlSize(.small)
        }
        .contentShape(.rect)
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
