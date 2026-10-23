import SwiftUI

/// More > Exercises: the picker's list and filters with All, Performed, and Archived tabs. A row opens Exercise Settings.
/// MF's Deprioritized and Modified tabs are cut with the settings that fill them (Do Not Recommend, equipment overrides).
struct ExerciseLibraryView: View {
    @Environment(ExerciseCatalog.self) private var catalog
    @Observe(WorkoutSession.finished) private var sessions
    @Observe(CustomExercise.all) private var customExercises
    @State private var tab = LibraryTab.all
    @State private var filter = ExerciseFilter()
    @State private var query = ""
    @State private var creating = false
    @State private var opened: ExerciseRef?

    enum LibraryTab: String, CaseIterable, Identifiable {
        case all = "All", performed = "Performed", archived = "Archived"
        var id: Self { self }
    }

    var body: some View {
        let counts = performedCounts
        let archived = Set(customExercises.filter(\.isArchived).map(\.id))
        let exercises = catalog.all.filter { exercise in
            switch tab {
            case .all: !archived.contains(exercise.id)
            case .performed: counts[exercise.id] != nil
            case .archived: archived.contains(exercise.id)
            }
        }
        ExerciseBrowser(
            exercises: exercises,
            filter: $filter,
            query: query,
            subtitle: { counts[$0.id].map { "Performed \($0) \($0 == 1 ? "time" : "times")" } },
            onSelect: { opened = ExerciseRef(id: $0.id) },
            header: {
                Picker("Exercises", selection: $tab) {
                    ForEach(LibraryTab.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
            },
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

/// Exercise Settings: Info, the pinned note, the rest override, and for custom exercises Archive and Delete.
/// MF's other overrides (equipment weights, left/right rest, rep range, weight match, warm-ups) and Do Not Recommend
/// belong to features cut from milestone 1.
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

    init(exerciseID: ExerciseID) {
        self.exerciseID = exerciseID
        _current = Observe(ExerciseSettings.one(exerciseID))
        _customExercise = Observe(CustomExercise.one(exerciseID))
    }

    private static let noteLimit = 300

    var body: some View {
        let exercise = catalog.exercise(exerciseID)
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
                SettingsRow(title: "Rest Timer", subtitle: current?.restSeconds.map(Self.format) ?? "Default", systemImage: "timer") {
                    Menu("Edit") {
                        Picker("Rest Timer", selection: restBinding(current)) {
                            Text("Default (\(Self.format(defaults.restSeconds(exercise?.restCategory ?? .upperIsolation))))").tag(Int?.none)
                            ForEach(Array(stride(from: 15, through: 600, by: 15)), id: \.self) { Text(Self.format($0)).tag(Optional($0)) }
                        }
                    }
                }
                Button(role: .destructive) {
                    store.delete(ExerciseSettings.self, id: exerciseID)
                } label: {
                    Label("Reset Defaults", systemImage: "arrow.counterclockwise")
                }
                .disabled(current == nil || current?.pinnedNote.isEmpty == true && current?.restSeconds == nil)
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

    private func restBinding(_ current: ExerciseSettings?) -> Binding<Int?> {
        Binding { current?.restSeconds } set: { seconds in change { $0.restSeconds = seconds } }
    }

    private func change(_ edit: @escaping @Sendable (inout ExerciseSettings) -> Void) {
        store.modify(ExerciseSettings.self, id: exerciseID, orInsert: { ExerciseSettings(id: exerciseID) }, edit)
    }

    private static func format(_ seconds: Int) -> String {
        Duration.seconds(seconds).formatted(.time(pattern: .minuteSecond))
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
        .listRowBackground(Theme.surface)
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
