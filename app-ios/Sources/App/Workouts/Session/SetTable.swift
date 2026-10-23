import SwiftUI

/// The set table, its keypad, and the edits they make to `blocks`.
extension SessionEditor {
    private static let checkboxWidth: CGFloat = 32

    func setTable(block: Int, exercise index: Int, fields: [SetField]) -> some View {
        let item = blocks[block].exercises[index]
        let previous = SessionFlow.previousSets(of: item.exerciseID, in: history)
        let rows = blocks.rows(block: block, exercise: index)
        return VStack(spacing: 8) {
            HStack(spacing: 8) {
                Text("Set").frame(width: 36)
                Text("Previous").frame(maxWidth: .infinity)
                ForEach(fields, id: \.self) { Text($0.header(unit: unit)).frame(maxWidth: .infinity) }
                Button { toggleAll(block: block, exercise: index, previous: previous) } label: {
                    checkbox(item.isDone)
                }
                .frame(width: Self.checkboxWidth)
                .accessibilityLabel("Complete all sets")
            }
            .font(AppFont.medium(13))
            .foregroundStyle(Theme.textSecondary)
            if item.sets.isEmpty {
                Text("No sets yet").font(AppFont.caption()).foregroundStyle(Theme.textTertiary).padding(.vertical, 8)
            }
            ForEach(rows, id: \.self) { path in
                row(path, number: item.sets.number(at: path.set), fields: fields, previous: previous)
            }
            HStack {
                Button { addSet(block: block, exercise: index) } label: {
                    Image(systemName: "plus")
                        .font(AppFont.headline(15))
                        .frame(width: 36, height: 36)
                        .background(Theme.surfaceRaised, in: Circle())
                }
                .accessibilityLabel("Add Set")
                Spacer()
            }
        }
        .foregroundStyle(Theme.textPrimary)
    }

    /// Warm-ups have no number; every other set counts from 1, so "W, D, +, 2, 3" as in the reference.
    private func row(_ path: RowPath, number: Int, fields: [SetField], previous: [WorkoutSet]) -> some View {
        let isLogged = blocks.log(at: path) != nil
        let value = entry(path, previous: previous)
        return HStack(spacing: 8) {
            badge(path, number: number)
            previousText(SessionFlow.previousLog(for: path, in: blocks, previous: previous))
                .frame(maxWidth: .infinity)
            ForEach(fields, id: \.self) { field in
                cell(path, field: field, value: value)
            }
            Button { toggle(path, previous: previous) } label: { checkbox(isLogged) }
                .frame(width: Self.checkboxWidth)
                .accessibilityLabel(isLogged ? "Uncheck set" : "Check set")
        }
        .opacity(isLogged && focus?.row != path ? 0.45 : 1)
    }

    @ViewBuilder
    private func badge(_ path: RowPath, number: Int) -> some View {
        let set = blocks[path.block].exercises[path.exercise].sets[path.set]
        if path.sub != nil {
            Menu {
                Button("Remove", systemImage: "trash", role: .destructive) { removeRow(path) }
            } label: {
                Text("+").font(AppFont.headline(15)).frame(width: 36, height: 36).background(Theme.surfaceRaised, in: Circle())
            }
            .accessibilityLabel("Sub-set options")
        } else {
            Menu {
                Picker("Set Type", selection: setTypeBinding(path)) {
                    Text("Standard Set").tag(SetType.standard)
                    Text("Warm-Up Set").tag(SetType.warmUp)
                    Text("Drop Set").tag(SetType.drop)
                    Text("Myo Set").tag(SetType.myo)
                    Text("Failure Set").tag(SetType.failure)
                }
                if set.type.hasSubSets {
                    Button(set.type == .drop ? "Add Drop" : "Add Myo Rep Set", systemImage: "plus") { addSubSet(path) }
                }
                Button("Remove Set", systemImage: "trash", role: .destructive) { removeRow(path) }
            } label: {
                SetBadge(type: set.type, number: number)
            }
            .accessibilityLabel("Set \(set.type.badge ?? "\(number)") options")
        }
    }

    private func previousText(_ log: SetLog?) -> some View {
        VStack(spacing: 0) {
            if let log {
                Text(Self.summary(of: log, unit: unit))
                if let rir = log.rir { Text("\(rir >= 6 ? "6+" : "\(rir)") RIR").foregroundStyle(Theme.textSecondary) }
            } else {
                Text("No Previous").foregroundStyle(Theme.textTertiary)
            }
        }
        .font(AppFont.caption(12))
        .lineLimit(1)
        .minimumScaleFactor(0.8)
    }

    /// "40 kg x 8", the weight or the reps alone when only one was logged.
    static func summary(of log: SetLog, unit: WeightUnit) -> String {
        let weight = log.weightKg.map { "\(unit.format(kg: $0)) \(unit.rawValue)" }
        let reps = log.reps.map(String.init)
        let duration = log.durationSeconds.map { Duration.seconds($0).formatted(.time(pattern: .minuteSecond)) }
        let distance = log.distanceMeters.map { Measurement(value: $0, unit: UnitLength.meters).formatted(.measurement(width: .abbreviated)) }
        return [weight, reps ?? duration, distance].compactMap { $0 }.joined(separator: " x ")
    }

    private func cell(_ path: RowPath, field: SetField, value: SetEntry) -> some View {
        let isFocused = focus?.row == path && focus?.field == field
        let text = isFocused ? focus?.text ?? "" : field.text(value, unit: unit)
        return Button {
            focus = KeypadFocus(row: path, field: field, text: field.text(value, unit: unit))
        } label: {
            Text(text)
                .font(AppFont.medium(16))
                .foregroundStyle(isFocused && focus?.replacesOnType == true ? Theme.accent : Theme.textPrimary)
                .frame(maxWidth: .infinity, minHeight: 36)
                .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 8))
                .overlay {
                    if isFocused { RoundedRectangle(cornerRadius: 8).strokeBorder(Theme.textPrimary, lineWidth: 2) }
                }
                .overlay(alignment: .bottomTrailing) {
                    if field.isReps, value.rir != nil || (path.sub == nil && blocks[path.block].exercises[path.exercise].sets[path.set].type != .warmUp) {
                        RIRBadge(rir: value.rir).offset(x: 6, y: 6)
                    }
                }
        }
        .accessibilityLabel("\(field.header(unit: unit)) \(text)")
    }

    private func checkbox(_ isOn: Bool) -> some View {
        Image(systemName: isOn ? "checkmark.square.fill" : "square")
            .font(.title3)
            .foregroundStyle(isOn ? Theme.textPrimary : Theme.textSecondary)
            .frame(width: Self.checkboxWidth, height: 36)
    }

    // MARK: Values

    /// What a row shows and logs: its log once checked, else what was typed, else the prefill.
    func entry(_ path: RowPath, previous: [WorkoutSet]) -> SetEntry {
        if let log = blocks.log(at: path) { return SetEntry(log) }
        if let draft = drafts[blocks.rowID(at: path)] { return draft }
        return SetEntry.prefill(target: blocks.target(at: path), previous: SessionFlow.previousLog(for: path, in: blocks, previous: previous))
    }

    private func update(_ path: RowPath, _ change: (inout SetEntry) -> Void) {
        guard blocks.contains(path) else { return }
        let previous = SessionFlow.previousSets(of: blocks[path.block].exercises[path.exercise].exerciseID, in: history)
        var value = entry(path, previous: previous)
        change(&value)
        if let log = blocks.log(at: path) {
            blocks.setLog(value.log(at: log.completedAt), at: path)
        } else {
            drafts[blocks.rowID(at: path)] = value
        }
    }

    // MARK: Checking sets

    private func toggle(_ path: RowPath, previous: [WorkoutSet]) {
        let id = blocks.rowID(at: path)
        if let log = blocks.log(at: path) {
            drafts[id] = SetEntry(log)
            blocks.setLog(nil, at: path)
            return
        }
        blocks.setLog(entry(path, previous: previous).log(at: .now), at: path)
        drafts[id] = nil
        guard mode == .live else { return }
        let step = SessionFlow.afterCompleting(path, in: blocks, rest: restSeconds)
        if let seconds = step.restSeconds { store.startRest(seconds: seconds) }
        if let next = step.next, next != current { withAnimation { current = next } }
    }

    private func restSeconds(_ item: BlockExercise, _ set: WorkoutSet) -> Int {
        item.restSeconds(after: set, exercise: catalog.exercise(item.exerciseID), settings: .of(item.exerciseID, in: exerciseSettings), defaults: defaults)
    }

    /// The header checkbox logs every open row with its values, or reopens all of them when everything is logged.
    private func toggleAll(block: Int, exercise index: Int, previous: [WorkoutSet]) {
        let rows = blocks.rows(block: block, exercise: index)
        if blocks[block].exercises[index].isDone {
            for path in rows { toggle(path, previous: previous) }
            return
        }
        let now = Date.now
        for path in rows where blocks.log(at: path) == nil {
            blocks.setLog(entry(path, previous: previous).log(at: now), at: path)
            drafts[blocks.rowID(at: path)] = nil
        }
        let partner = blocks[block].exercises.first { !$0.isDone }
        if mode == .live, let next = partner?.id ?? SessionFlow.nextIncomplete(after: block, in: blocks) {
            withAnimation { current = next }
        }
    }

    // MARK: Structure

    private func setTypeBinding(_ path: RowPath) -> Binding<SetType> {
        Binding {
            blocks[path.block].exercises[path.exercise].sets[path.set].type
        } set: { type in
            blocks[path.block].exercises[path.exercise].sets[path.set].type = type
            if type.hasSubSets, blocks[path.block].exercises[path.exercise].sets[path.set].subSets.isEmpty {
                addSubSet(path)
            }
        }
    }

    private func addSubSet(_ path: RowPath) {
        blocks[path.block].exercises[path.exercise].sets[path.set].subSets.append(SubSet())
    }

    func addSet(block: Int, exercise index: Int) {
        let last = blocks[block].exercises[index].sets.last { $0.type != .warmUp }
        var set = last?.planned ?? WorkoutSet()
        set.id = UUID()
        set.subSets = set.subSets.map { SubSet(target: $0.target) }
        blocks[block].exercises[index].sets.append(set)
    }

    private func removeRow(_ path: RowPath) {
        focus = nil
        if let sub = path.sub {
            blocks[path.block].exercises[path.exercise].sets[path.set].subSets.remove(at: sub)
        } else {
            blocks[path.block].exercises[path.exercise].sets.remove(at: path.set)
        }
    }

    /// Warm-ups go after any existing ones, before the first working set.
    func addWarmUps(_ warmUps: [(weightKg: Double?, reps: Int?)], block: Int, exercise index: Int) {
        var sets = blocks[block].exercises[index].sets
        let insertAt = sets.firstIndex { $0.type != .warmUp } ?? sets.count
        let new = warmUps.map { WorkoutSet(type: .warmUp, target: SetTarget(repsMin: $0.reps, repsMax: $0.reps, weightKg: $0.weightKg)) }
        sets.insert(contentsOf: new, at: insertAt)
        blocks[block].exercises[index].sets = sets
    }

    /// The weight the first working set would log, which the warm-up scheme scales.
    func firstWorkingWeight(block: Int, exercise index: Int) -> Double? {
        let item = blocks[block].exercises[index]
        guard let set = item.sets.firstIndex(where: { $0.type != .warmUp }) else { return nil }
        let previous = SessionFlow.previousSets(of: item.exerciseID, in: history)
        return entry(RowPath(block: block, exercise: index, set: set), previous: previous).weightKg
    }

    func remove(_ id: BlockExercise.ID) {
        blocks.remove(id)
        current = SessionFlow.initialExercise(in: blocks)
    }

    /// The builder's swap keeps sets and targets; mid-session it also drops what was logged against the old exercise.
    func swap(_ id: BlockExercise.ID, to exerciseID: ExerciseID) {
        blocks.swap(id, to: exerciseID)
        guard let at = blocks.locate(id) else { return }
        blocks[at.block].exercises[at.item].sets = blocks[at.block].exercises[at.item].sets.map(\.planned)
    }

    func add(_ pick: ExercisePick) {
        let existing = Set(blocks.flatMap(\.exercises).map(\.id))
        blocks.add(pick)
        current = blocks.flatMap(\.exercises).first { !existing.contains($0.id) }?.id ?? current
    }

    // MARK: Keypad

    func keypad(for focus: KeypadFocus) -> some View {
        let rir = blocks.contains(focus.row) ? entry(focus.row, previous: previousSets(for: focus.row)).rir : nil
        return Keypad(field: focus.field, rir: rir) { handle($0) }
            .transition(.move(edge: .bottom))
    }

    private func previousSets(for path: RowPath) -> [WorkoutSet] {
        SessionFlow.previousSets(of: blocks[path.block].exercises[path.exercise].exerciseID, in: history)
    }

    private func handle(_ key: KeypadKey) {
        guard var state = focus, blocks.contains(state.row) else { return focus = nil }
        switch key {
        case let .character(character): state.type(character)
        case .backspace: state.backspace()
        case .decrement, .increment:
            let increment = WarmUpScheme.increment(for: unit)
            state.step(by: key.isIncrement ? increment : -increment)
        case let .rir(value):
            update(state.row) { $0.rir = value }
            return
        case .dismiss:
            focus = nil
            return
        case .next:
            focus = nextFocus(after: state)
            return
        case .done:
            focus = nil
            if blocks.log(at: state.row) == nil { toggle(state.row, previous: previousSets(for: state.row)) }
            return
        }
        update(state.row) { state.field.apply(state.text, to: &$0, unit: unit) }
        focus = state
    }

    /// → moves to the next field in the row, then to the first field of the next row.
    private func nextFocus(after state: KeypadFocus) -> KeypadFocus? {
        let item = blocks[state.row.block].exercises[state.row.exercise]
        let fields = SetField.fields(for: catalog.exercise(item.exerciseID))
        let rows = blocks.rows(block: state.row.block, exercise: state.row.exercise)
        var path = state.row
        var fieldIndex = (fields.firstIndex(of: state.field) ?? 0) + 1
        if fieldIndex == fields.count {
            guard let rowIndex = rows.firstIndex(of: path), let next = rows[safe: rowIndex + 1] else { return nil }
            path = next
            fieldIndex = 0
        }
        let field = fields[fieldIndex]
        return KeypadFocus(row: path, field: field, text: field.text(entry(path, previous: previousSets(for: path)), unit: unit))
    }
}

private extension KeypadKey {
    var isIncrement: Bool { if case .increment = self { true } else { false } }
}
