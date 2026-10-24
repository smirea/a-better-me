import SwiftUI

/// More > Exercises: the picker's list and filters with MF's All, Performed, Deprioritized (Do Not Recommend),
/// Modified (any Exercise Override), and Archived tabs. A row opens Exercise Settings.
struct ExerciseLibraryView: View {
    @Environment(ExerciseCatalog.self) private var catalog
    @Observe(WorkoutSession.finished) private var sessions
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

    var body: some View {
        let counts = performedCounts
        let archived = Set(customExercises.filter(\.isArchived).map(\.id))
        let settings = Dictionary(exerciseSettings.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        let exercises = catalog.all.filter { exercise in
            switch tab {
            case .all: !archived.contains(exercise.id)
            case .performed: counts[exercise.id] != nil
            case .deprioritized: settings[exercise.id]?.doNotRecommend == true
            case .modified: settings[exercise.id]?.isModified == true
            case .archived: archived.contains(exercise.id)
            }
        }
        ExerciseBrowser(
            exercises: exercises,
            filter: $filter,
            query: query,
            subtitle: { counts[$0.id].map { "Performed \($0) \($0 == 1 ? "time" : "times")" } },
            onSelect: { opened = ExerciseRef(id: $0.id) },
            header: { LibraryTabBar(selection: $tab) },
            trailing: { _ in Image(systemName: "chevron.right").foregroundStyle(Theme.textTertiary) }
        )
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search for an exercise")
        .tint(Theme.textPrimary)
        .navigationTitle("Exercises")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Create Custom Exercise", systemImage: "plus") { creating = true }
            }
        }
        .navigationDestination(item: $opened) { ExerciseSettingsView(exerciseID: $0.id) }
        .sheet(isPresented: $creating) { CustomExerciseWizard() }
    }

    private var performedCounts: [ExerciseID: Int] {
        var counts: [ExerciseID: Int] = [:]
        for session in sessions {
            let ids = Set(session.blocks.flatMap(\.exercises).filter { $0.sets.contains(where: \.isCompleted) }.map(\.exerciseID))
            for id in ids { counts[id, default: 0] += 1 }
        }
        return counts
    }
}

/// MF's underlined text tabs. Five labels overflow a segmented control on iPhone, so the row scrolls.
private struct LibraryTabBar: View {
    @Binding var selection: ExerciseLibraryView.LibraryTab
    @Namespace private var underline

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 22) {
                ForEach(ExerciseLibraryView.LibraryTab.allCases) { tab in
                    let isSelected = tab == selection
                    Button { withAnimation(.snappy) { selection = tab } } label: {
                        Text(tab.rawValue)
                            .font(AppFont.medium(15))
                            .foregroundStyle(isSelected ? Theme.textPrimary : Theme.textSecondary)
                            .padding(.vertical, 8)
                            .overlay(alignment: .bottom) {
                                if isSelected {
                                    Capsule()
                                        .fill(Theme.textPrimary)
                                        .frame(height: 3)
                                        .matchedGeometryEffect(id: "underline", in: underline)
                                }
                            }
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(isSelected ? .isSelected : [])
                }
            }
            .padding(.horizontal)
        }
        .scrollIndicators(.hidden)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.separator).frame(height: 1) }
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
    @State private var duplicating = false

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
            Section {
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
                if exercise != nil {
                    Button { duplicating = true } label: {
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
                        tint: Theme.destructive
                    ) {
                        Button("Delete", role: .destructive) { confirmingDelete = true }
                    }
                }
            } header: {
                SectionTitle("General").textCase(nil)
            }
            Section {
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
                        tint: Theme.destructive
                    ) { EmptyView() }
                }
                .buttonStyle(.plain)
                .disabled(current?.isModified != true)
            } header: {
                SectionTitle("Exercise Overrides").textCase(nil)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .tint(Theme.textPrimary)
        .navigationTitle(exercise?.name ?? "Exercise")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showingInfo) { ExerciseDetailSheet(exerciseID: exerciseID) }
        .sheet(isPresented: $duplicating) {
            if let exercise {
                CustomExerciseWizard(draft: CustomExerciseDraft(duplicating: exercise, instructions: catalog.instructions(for: exercise)))
            }
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
                        Text("Default (\(ExerciseOverrideRow.formatRest(defaults.restSeconds(category))))").tag(Int?.none)
                        ForEach(Array(stride(from: 15, through: 600, by: 15)), id: \.self) {
                            Text(ExerciseOverrideRow.formatRest($0)).tag(Optional($0))
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

    var body: some View {
        Form {
            Section {
                ForEach(steps.indices, id: \.self) { index in
                    HStack(spacing: 12) {
                        Text("W")
                            .font(AppFont.headline(11))
                            .frame(width: 22, height: 22)
                            .background(Theme.surfaceRaised, in: .circle)
                        Text("\(steps[index].percent)%").frame(width: 44, alignment: .leading)
                        Stepper("Percent", value: $steps[index].percent, in: 5...100, step: 5)
                            .labelsHidden()
                            .accessibilityValue("\(steps[index].percent)%")
                        Spacer()
                        Text("x \(steps[index].reps)").frame(width: 36, alignment: .leading)
                        Stepper("Reps", value: $steps[index].reps, in: 1...30)
                            .labelsHidden()
                            .accessibilityValue("\(steps[index].reps) reps")
                    }
                    .font(AppFont.medium(15))
                    .listRowBackground(Theme.surface)
                }
                .onDelete { steps.remove(atOffsets: $0) }
                Button("Add Warm-Up Set", systemImage: "plus") {
                    let last = steps.last ?? WarmUpStep(percent: 30, reps: 5)
                    steps.append(WarmUpStep(percent: min(last.percent + 10, 100), reps: last.reps))
                }
                .listRowBackground(Theme.surface)
            } footer: {
                Text("Percent of the first working set's target weight.").font(AppFont.caption(12))
            }
            Section {
                Button("Reset to Default", role: .destructive) {
                    save(nil)
                }
                .disabled(!isOverridden)
                .listRowBackground(Theme.surface)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .tint(Theme.textPrimary)
        .navigationTitle("Warm-Up Scheme")
        .navigationBarTitleDisplayMode(.inline)
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
    var tint = Theme.textPrimary
    @ViewBuilder var accessory: Accessory

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: systemImage).foregroundStyle(tint).frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(AppFont.medium(15))
                Text(subtitle).font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary).lineLimit(3)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            accessory
                .buttonStyle(.bordered)
                .buttonBorderShape(.capsule)
                .controlSize(.small)
                .tint(Theme.textPrimary)
        }
        .contentShape(.rect)
        .listRowBackground(Theme.surface)
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
