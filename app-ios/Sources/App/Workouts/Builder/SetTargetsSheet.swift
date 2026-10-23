import SwiftData
import SwiftUI

/// The Targets sheet: set types, reps min and max, RIR, and per-set rest. The template editor and the live session's
/// Targets chip both present it; the builder thread owns it. Warm-up sets are offered only in the live session.
/// Edits stay in a draft until Save, as in the reference.
struct SetTargetsSheet: View {
    @Binding var exercise: BlockExercise
    let allowsWarmUp: Bool

    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(\.dismiss) private var dismiss
    @Query private var settings: [ExerciseSettings]
    @State private var draft: BlockExercise
    @State private var restTimers: Bool
    @State private var editing: Editing?
    @FocusState private var focus: Field?

    init(exercise: Binding<BlockExercise>, allowsWarmUp: Bool) {
        _exercise = exercise
        self.allowsWarmUp = allowsWarmUp
        _draft = State(initialValue: exercise.wrappedValue)
        _restTimers = State(initialValue: exercise.wrappedValue.sets.contains { $0.restSeconds != nil })
    }

    private enum Editing: Hashable, Identifiable {
        case type(WorkoutSet.ID), rir(WorkoutSet.ID), rest(WorkoutSet.ID)
        var id: Self { self }
    }

    enum Field: Hashable {
        case min(UUID), max(UUID)
    }

    private var defaultRest: Int {
        draft.defaultRestSeconds(exercise: catalog.exercise(draft.exerciseID), settings: settings.first { $0.id == draft.exerciseID })
    }

    var body: some View {
        NavigationStack {
            List {
                columnHeader.listRowSeparator(.hidden)
                ForEach($draft.sets) { $set in
                    setRow($set)
                    ForEach($set.subSets) { $sub in subSetRow($sub, of: set) }
                }
                Button { addSet() } label: {
                    Image(systemName: "plus")
                        .font(AppFont.headline())
                        .frame(width: 36, height: 36)
                        .background(Theme.surfaceRaised, in: Circle())
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Add Set")
                .listRowSeparator(.hidden)
                Toggle(isOn: $restTimers) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Set Rest Timers").font(AppFont.headline(15))
                        Text("This will override default exercise settings")
                            .font(AppFont.caption())
                            .foregroundStyle(Theme.textSecondary)
                    }
                }
                .padding(.vertical, 8)
                .tint(Theme.accent)
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(Theme.surface)
            .scrollDismissesKeyboard(.interactively)
            .environment(\.defaultMinListRowHeight, 40)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
                ToolbarItem(placement: .principal) {
                    VStack(spacing: 0) {
                        Text("Targets").font(AppFont.title(17))
                        Text(catalog.name(draft.exerciseID))
                            .font(AppFont.caption())
                            .foregroundStyle(Theme.textSecondary)
                    }
                }
                ToolbarItem(placement: .keyboard) {
                    Button("Done") { focus = nil }.frame(maxWidth: .infinity, alignment: .trailing)
                }
            }
            .safeAreaInset(edge: .bottom) {
                PinnedActionButton("Save") { save() }
            }
            .tint(Theme.textPrimary)
            .onChange(of: restTimers) { _, on in
                for index in draft.sets.indices {
                    draft.sets[index].restSeconds = on ? (draft.sets[index].restSeconds ?? defaultRest) : nil
                }
            }
            .sheet(item: $editing) { editing in
                switch editing {
                case .type(let id):
                    SetTypePicker(selected: draft.sets.first { $0.id == id }?.type, allowsWarmUp: allowsWarmUp) { type in
                        update(id) { $0.change(to: type) }
                    }
                case .rir(let id):
                    RIRPicker { rir in update(id) { $0.targets.rir = rir } }
                case .rest(let id):
                    RestPicker(seconds: draft.sets.first { $0.id == id }?.restSeconds ?? defaultRest) { seconds in
                        update(id) { $0.restSeconds = seconds }
                    }
                }
            }
        }
    }

    private var columnHeader: some View {
        HStack(spacing: 8) {
            Text("Set").frame(width: 36)
            Text("Reps Min").frame(maxWidth: .infinity)
            Text("Reps Max").frame(maxWidth: .infinity)
            if restTimers { Text("Rest").frame(width: 56) }
            Text("RIR").frame(width: 32)
        }
        .font(AppFont.headline(14))
    }

    private func setRow(_ set: Binding<WorkoutSet>) -> some View {
        let value = set.wrappedValue
        let number = draft.sets.number(at: draft.sets.firstIndex { $0.id == value.id } ?? 0)
        let isDrop = value.type == .drop
        return HStack(spacing: 8) {
            Button { editing = .type(value.id) } label: { SetBadge(type: value.type, number: number) }
                .buttonStyle(.plain)
                .accessibilityLabel("Set \(number) type")
            RepsField(value: set.targets.repsMin, field: .min(value.id), focus: $focus)
            RepsField(value: set.targets.repsMax, field: .max(value.id), focus: $focus).disabled(isDrop)
            if restTimers {
                RestCell(seconds: value.restSeconds ?? defaultRest) { editing = .rest(value.id) }
            }
            Button { editing = .rir(value.id) } label: { RIRCell(rir: value.target?.rir) }
                .buttonStyle(.plain)
                .disabled(isDrop)
                .frame(width: 32)
                .accessibilityLabel("Set \(number) RIR")
        }
        .listRowSeparator(.hidden)
        .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
        .swipeActions {
            if draft.sets.count > 1 {
                Button("Delete", systemImage: "trash", role: .destructive) {
                    focus = nil
                    draft.sets.removeAll { $0.id == value.id }
                }
            }
        }
    }

    /// A drop's or myo-rep's row: reps only. It shares its set's RIR and has no rest of its own.
    private func subSetRow(_ sub: Binding<SubSet>, of set: WorkoutSet) -> some View {
        let id = sub.wrappedValue.id
        let label = set.type == .drop ? "Drop" : "Myo-Rep"
        return HStack(spacing: 8) {
            Menu {
                Button("Add \(label)", systemImage: "plus") { updateSubSets(of: set.id) { $0.append(SubSet()) } }
                Button("Remove \(label)", systemImage: "minus.circle", role: .destructive) {
                    updateSubSets(of: set.id) { $0.removeAll { $0.id == id } }
                }
            } label: {
                Image(systemName: "plus")
                    .font(AppFont.headline(13))
                    .foregroundStyle(Theme.textPrimary)
                    .frame(width: 36, height: 36)
                    .background(Theme.surfaceRaised, in: Circle())
                    .accessibilityLabel("\(label) options")
            }
            RepsField(value: sub.targets.repsMin, field: .min(id), focus: $focus)
            RepsField(value: .constant(nil), field: .max(id), focus: $focus).disabled(true)
            if restTimers { RestCell(seconds: 0) {}.disabled(true) }
            RIRCell(rir: set.target?.rir).opacity(0.6).frame(width: 32)
        }
        .listRowSeparator(.hidden)
        .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
        .swipeActions {
            Button("Delete", systemImage: "trash", role: .destructive) {
                updateSubSets(of: set.id) { $0.removeAll { $0.id == id } }
            }
        }
    }

    private func addSet() {
        draft.sets.append(draft.sets.last?.copyingTargets() ?? WorkoutSet(restSeconds: restTimers ? defaultRest : nil))
    }

    private func update(_ id: WorkoutSet.ID, _ change: (inout WorkoutSet) -> Void) {
        guard let index = draft.sets.firstIndex(where: { $0.id == id }) else { return }
        change(&draft.sets[index])
    }

    private func updateSubSets(of id: WorkoutSet.ID, _ change: (inout [SubSet]) -> Void) {
        focus = nil
        update(id) { change(&$0.subSets) }
    }

    private func save() {
        exercise = draft
        dismiss()
    }
}

private struct RepsField: View {
    @Binding var value: Int?
    let field: SetTargetsSheet.Field
    var focus: FocusState<SetTargetsSheet.Field?>.Binding

    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        TextField(isEnabled ? "Optional" : "-", text: Binding {
            value.map(String.init) ?? ""
        } set: {
            value = Int($0.filter(\.isNumber).prefix(3))
        })
        .keyboardType(.numberPad)
        .multilineTextAlignment(.center)
        .font(AppFont.body(14))
        .focused(focus, equals: field)
        .frame(height: 32)
        .frame(maxWidth: .infinity)
        .background(Theme.surfaceRaised.opacity(isEnabled ? 1 : 0.5), in: RoundedRectangle(cornerRadius: 6))
    }
}

private struct RestCell: View {
    let seconds: Int
    let action: () -> Void

    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        Button(action: action) {
            Text(seconds.minuteSecond)
                .font(AppFont.body(14))
                .foregroundStyle(isEnabled ? Theme.textPrimary : Theme.textTertiary)
                .frame(width: 56, height: 32)
                .background(Theme.surfaceRaised.opacity(isEnabled ? 1 : 0.5), in: RoundedRectangle(cornerRadius: 6))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Rest \(seconds.minuteSecond)")
    }
}

/// The RIR badge, or an empty gray dot when the set has no RIR target.
private struct RIRCell: View {
    let rir: Int?

    var body: some View {
        if let rir {
            RIRBadge(rir: rir)
        } else {
            Circle().fill(Theme.surfaceRaised).frame(width: 18, height: 18)
        }
    }
}

private struct SetTypePicker: View {
    let selected: SetType?
    let allowsWarmUp: Bool
    let onSelect: (SetType) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List(SetType.allCases.filter { allowsWarmUp || $0 != .warmUp }, id: \.self) { type in
                Button {
                    onSelect(type)
                    dismiss()
                } label: {
                    HStack(spacing: 16) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(type.title).font(AppFont.headline(15))
                            Text(type.summary).font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
                        }
                        Spacer()
                        Image(systemName: type == selected ? "largecircle.fill.circle" : "circle")
                            .font(AppFont.title())
                    }
                    .foregroundStyle(Theme.textPrimary)
                }
            }
            .listStyle(.plain)
            .navigationTitle("Set Type")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

private extension SetType {
    var title: String {
        switch self {
        case .standard: "Standard Set"
        case .warmUp: "Warm-Up Set"
        case .drop: "Drop Set"
        case .myo: "Myo Set"
        case .failure: "Failure Set"
        }
    }

    var summary: String {
        switch self {
        case .standard: "A normal set of a fixed weight and target repetitions"
        case .warmUp: "A set with a lighter weight to prepare your muscles for heavier working sets"
        case .drop:
            "A set where you continue repping to push muscle fatigue with progressively lower weights after reaching failure at a heavier load"
        case .myo: "A set where you continue repping to push muscle fatigue with progressively lower reps while keeping the weight constant"
        case .failure:
            "A set where you perform reps until you can no longer maintain proper form (for compound exercises) or complete another rep (for isolation exercises)"
        }
    }
}

/// "RIR Targets": 0 through 6+, or "?" to clear.
private struct RIRPicker: View {
    let onSelect: (Int?) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            HStack {
                ForEach([0, 1, 2, 3, 4, 5, 6, nil], id: \.self) { rir in
                    Button {
                        onSelect(rir)
                        dismiss()
                    } label: {
                        RIRBadge(rir: rir).scaleEffect(1.6).frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(rir.map { "RIR \($0)" } ?? "No RIR")
                }
            }
            .padding(.horizontal)
            .navigationTitle("RIR Targets")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button("Clear", systemImage: "trash") {
                        onSelect(nil)
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.height(160)])
    }
}

/// "Rest Timer": a minutes and seconds wheel.
private struct RestPicker: View {
    let onSave: (Int) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var minutes: Int
    @State private var seconds: Int

    init(seconds: Int, onSave: @escaping (Int) -> Void) {
        self.onSave = onSave
        _minutes = State(initialValue: seconds / 60)
        _seconds = State(initialValue: seconds % 60)
    }

    var body: some View {
        NavigationStack {
            HStack(spacing: 0) {
                Picker("Minutes", selection: $minutes) {
                    ForEach(0...15, id: \.self) { Text("\($0) min").tag($0) }
                }
                Picker("Seconds", selection: $seconds) {
                    ForEach(0...59, id: \.self) { Text("\($0) sec").tag($0) }
                }
            }
            .pickerStyle(.wheel)
            .safeAreaInset(edge: .bottom) {
                PinnedActionButton("Save") {
                    onSave(minutes * 60 + seconds)
                    dismiss()
                }
            }
            .navigationTitle("Rest Timer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
        }
        .presentationDetents([.height(360)])
    }
}
