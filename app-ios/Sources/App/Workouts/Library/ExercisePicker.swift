import SwiftUI

/// What the picker returns: the chosen exercises in selection order, and whether to group them ("Add as a superset?").
struct ExercisePick {
    var exerciseIDs: [ExerciseID]
    var asSuperset: Bool
}

enum ExercisePickerMode: Equatable {
    case add
    /// "Swapping with <name>": a single pick that replaces the given exercise.
    case swap(ExerciseID)
}

/// The full-height "add exercise" sheet. The builder and the live session present it; the library thread owns it.
/// Present it in a sheet; it dismisses itself after calling `onPick`.
struct ExercisePicker: View {
    let mode: ExercisePickerMode
    /// The gym the list starts on. A missing or deleted gym falls back to the default gym.
    var gymID: UUID? = nil
    let onPick: (ExercisePick) -> Void
    @Observe(GymProfile.all) private var gyms
    @Observe(GymProfile.defaultGym) private var defaultGym
    @State private var showingAllReplacements = false
    @State private var filter = ExerciseFilter()
    @State private var choseGym = false

    var body: some View {
        NavigationStack {
            switch mode {
            case .add: ExercisePickerList(mode: mode, filter: $filter, onPick: onPick)
            case .swap(let id):
                if showingAllReplacements {
                    ExercisePickerList(mode: mode, filter: $filter, onPick: onPick)
                } else {
                    SwapSubstitutions(exerciseID: id, gym: gyms.first { $0.id == filter.gymID }, onPick: onPick) {
                        showingAllReplacements = true
                    }
                }
            }
        }
        .onAppear {
            guard !choseGym else { return }
            choseGym = true
            filter.gymID = gyms.first { $0.id == gymID }?.id ?? defaultGym?.id
        }
    }
}

/// The Swap sheet: the exercise being replaced, Smart Substitutions (the same primary muscles), and
/// "Find Other Replacements", which opens the full picker in swap mode.
private struct SwapSubstitutions: View {
    let exerciseID: ExerciseID
    let gym: GymProfile?
    let onPick: (ExercisePick) -> Void
    let findOther: () -> Void
    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(\.dismiss) private var dismiss
    @Observe(CustomExercise.all) private var customExercises
    @State private var detail: ExerciseRef?

    var body: some View {
        let current = catalog.exercise(exerciseID)
        List {
            if let current {
                LibraryExerciseRow(exercise: current) { EmptyView() }
                    .listRowBackground(Theme.surface)
            }
            Section {
                ForEach(substitutes(for: current)) { exercise in
                    Button { detail = ExerciseRef(id: exercise.id) } label: {
                        LibraryExerciseRow(exercise: exercise) { SwapButton { pick(exercise.id) } }
                    }
                    .buttonStyle(.plain)
                }
                .listRowBackground(Theme.background)
            } header: {
                SectionTitle("Smart Substitutions").textCase(nil)
            }
        }
        .listStyle(.plain)
        .themedList()
        .navigationTitle("Swap")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Close", systemImage: "xmark") { dismiss() }
            }
        }
        .safeAreaInset(edge: .bottom) {
            Button("Find Other Replacements", action: findOther)
                .secondaryPill()
                .padding(.horizontal)
        }
        .sheet(item: $detail) { ref in
            let id = ref.id
            ExerciseDetailSheet(exerciseID: id, action: ("Swap Exercise", { pick(id) }))
        }
    }

    private func substitutes(for current: Exercise?) -> [Exercise] {
        guard let current else { return [] }
        let muscles = Set(current.primaryMuscles)
        let hidden = Set(customExercises.filter(\.isArchived).map(\.id))
        let availability = gym.map { GymAvailability(gym: $0, equipment: catalog.equipment) }
        let matches = catalog.all.filter {
            $0.id != current.id && !hidden.contains($0.id) && Set($0.primaryMuscles) == muscles && availability?.isAvailable($0) != false
        }
        return ExerciseGroup.ranked(matches)
    }

    private func pick(_ id: ExerciseID) {
        onPick(ExercisePick(exerciseIDs: [id], asSuperset: false))
        dismiss()
    }
}

private struct ExercisePickerList: View {
    let mode: ExercisePickerMode
    @Binding var filter: ExerciseFilter
    let onPick: (ExercisePick) -> Void
    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(\.dismiss) private var dismiss
    @Observe(CustomExercise.all) private var customExercises
    @State private var selection: [ExerciseID] = []
    @State private var asGroup = false
    @State private var showingTray = false
    @State private var query = ""
    @State private var detail: ExerciseRef?
    @State private var creating = false

    private var swapping: ExerciseID? {
        if case .swap(let id) = mode { id } else { nil }
    }

    var body: some View {
        Group {
            if showingTray {
                tray
            } else {
                let hidden = Set(customExercises.filter(\.isArchived).map(\.id))
                ExerciseBrowser(
                    exercises: catalog.all.filter { !hidden.contains($0.id) && $0.id != swapping },
                    filter: $filter,
                    query: query,
                    onSelect: { detail = ExerciseRef(id: $0.id) },
                    trailing: { exercise in
                        if swapping != nil {
                            SwapButton { finish(with: [exercise.id]) }
                        } else {
                            AddButton(isSelected: selection.contains(exercise.id)) { toggle(exercise.id) }
                        }
                    }
                )
            }
        }
        .background(Theme.background)
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $query, prompt: "Search for an exercise")
        .toolbar {
            ToolbarItemGroup(placement: .topBarLeading) {
                Button("Close", systemImage: "xmark") { dismiss() }
                Button("Create Custom Exercise", systemImage: "plus") { creating = true }
            }
            ToolbarItem(placement: .principal) { header }
            if swapping == nil {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(showingTray ? "Hide Selection" : "Show Selection", systemImage: showingTray ? "chevron.up" : "chevron.down") {
                        showingTray.toggle()
                    }
                    .disabled(selection.isEmpty)
                }
            }
            DefaultToolbarItem(kind: .search, placement: .bottomBar)
            if swapping == nil {
                ToolbarSpacer(.fixed, placement: .bottomBar)
                ToolbarItem(placement: .bottomBar) {
                    Button("Done") { finish(with: selection) }
                        .buttonStyle(.glassProminent)
                        .tint(Theme.textPrimary)
                        .foregroundStyle(Color.black)
                        .font(AppFont.headline())
                }
            }
        }
        .sheet(item: $detail) { ref in
            let id = ref.id
            if swapping != nil {
                ExerciseDetailSheet(exerciseID: id, action: ("Swap Exercise", { finish(with: [id]) }))
            } else {
                ExerciseDetailSheet(exerciseID: id, action: ("Add Exercise", { add(id) }))
            }
        }
        .sheet(isPresented: $creating) {
            CustomExerciseWizard(onCreateAndAdd: { id in
                if swapping != nil { finish(with: [id]) } else { add(id) }
            })
        }
        .onChange(of: selection) { _, ids in
            if ids.isEmpty { showingTray = false }
        }
    }

    @ViewBuilder private var header: some View {
        if let swapping {
            HStack(spacing: 6) {
                Image(systemName: "arrow.left.arrow.right")
                Text("Swapping with \u{201C}\(catalog.name(swapping))\u{201D}").lineLimit(1)
            }
            .font(AppFont.medium(13))
        } else if !selection.isEmpty {
            Button { showingTray.toggle() } label: {
                HStack(spacing: -8) {
                    ForEach(selection.compactMap(catalog.exercise)) { exercise in
                        ExerciseTile(exercise: exercise, width: 22)
                            .frame(width: 28, height: 28)
                            .clipShape(.circle)
                            .overlay { Circle().strokeBorder(Theme.background, lineWidth: 1.5) }
                    }
                }
            }
            .accessibilityLabel("\(selection.count) selected")
        }
    }

    private var tray: some View {
        List {
            Section {
                ForEach(selection.compactMap(catalog.exercise)) { exercise in
                    LibraryExerciseRow(exercise: exercise) {
                        Button("Remove", systemImage: "trash") { toggle(exercise.id) }
                            .labelStyle(.iconOnly)
                            .foregroundStyle(Theme.textPrimary)
                            .frame(width: 30, height: 30)
                            .background(Theme.surfaceRaised, in: .circle)
                            .buttonStyle(.plain)
                    }
                    .listRowBackground(Theme.surface)
                }
                .onMove { selection.move(fromOffsets: $0, toOffset: $1) }
            } header: {
                SectionTitle("Your Exercises").textCase(nil)
            }
            if selection.count > 1 {
                Section {
                    Toggle(selection.count > 2 ? "Add as a circuit?" : "Add as a superset?", isOn: $asGroup)
                        .font(AppFont.medium(15))
                        .tint(Theme.accent)
                        .listRowBackground(Theme.surface)
                }
            }
        }
        .scrollContentBackground(.hidden)
    }

    private func toggle(_ id: ExerciseID) {
        if let index = selection.firstIndex(of: id) { selection.remove(at: index) } else { selection.append(id) }
    }

    private func add(_ id: ExerciseID) {
        if !selection.contains(id) { selection.append(id) }
    }

    private func finish(with ids: [ExerciseID]) {
        if !ids.isEmpty { onPick(ExercisePick(exerciseIDs: ids, asSuperset: asGroup && ids.count > 1)) }
        dismiss()
    }
}

private struct AddButton: View {
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(isSelected ? "Remove" : "Add", systemImage: isSelected ? "checkmark" : "plus", action: action)
            .labelStyle(.iconOnly)
            .font(AppFont.headline(13))
            .foregroundStyle(isSelected ? Color.black : Theme.textPrimary)
            .frame(width: 30, height: 30)
            .background(isSelected ? Theme.textPrimary : Theme.surfaceRaised, in: .circle)
            .buttonStyle(.plain)
    }
}

private struct SwapButton: View {
    let action: () -> Void

    var body: some View {
        Button("Swap", systemImage: "arrow.left.arrow.right", action: action)
            .labelStyle(.iconOnly)
            .font(AppFont.headline(12))
            .foregroundStyle(Theme.textPrimary)
            .frame(width: 30, height: 30)
            .background(Theme.surfaceRaised, in: .circle)
            .buttonStyle(.plain)
    }
}

struct ExerciseRef: Identifiable, Hashable {
    let id: ExerciseID
}
