import SwiftUI

/// The set table, its keypad, and the edits they make to `blocks`.
extension SessionEditor {
    private static let checkboxWidth: CGFloat = 32

    func setTable(block: Int, exercise index: Int, fields: [SetField]) -> some View {
        let item = blocks[block].exercises[index]
        let previous = SessionFlow.previousSets(of: item.exerciseID, in: history)
        let rows = blocks.rows(block: block, exercise: index).filter { !isHidden($0) }
        return VStack(spacing: 8) {
            HStack(spacing: 8) {
                Text("Set").frame(width: 36)
                referenceHeader.frame(maxWidth: .infinity)
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
            referenceText(path, previous: previous)
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

    /// "Auto ⇄" or "Previous ⇄"; tapping switches. A past session has no suggestions, so its header is plain.
    @ViewBuilder
    private var referenceHeader: some View {
        if mode == .live {
            Button {
                store.referenceColumn = reference == .auto ? .previous : .auto
            } label: {
                HStack(spacing: 4) {
                    Text(reference == .auto ? "Auto" : "Previous")
                    Image(systemName: "arrow.left.arrow.right").font(.system(size: 10))
                }
            }
            .accessibilityLabel("Reference column")
            .accessibilityValue(reference == .auto ? "Auto" : "Previous")
        } else {
            Text("Previous")
        }
    }

    private func referenceText(_ path: RowPath, previous: [WorkoutSet]) -> some View {
        let lines: (main: String?, rir: Int?, empty: String) = switch reference {
        case .auto:
            suggestion(for: path).map { suggestion in
                var values = suggestion
                values.rir = nil
                return (values.autoText(unit: unit), suggestion.rir, "No Target")
            } ?? (nil, nil, "No Target")
        case .previous:
            SessionFlow.previousLog(for: path, in: blocks, previous: previous).map { (Self.summary(of: $0, unit: unit), $0.rir, "") } ?? (nil, nil, "No Previous")
        }
        return VStack(spacing: 0) {
            if let main = lines.main {
                Text(main)
                if let rir = lines.rir { Text("\(rir >= 6 ? "6+" : "\(rir)") RIR").foregroundStyle(Theme.textSecondary) }
            } else {
                Text(lines.empty).foregroundStyle(Theme.textTertiary)
            }
        }
        .font(AppFont.caption(12))
        .lineLimit(1)
        .minimumScaleFactor(0.8)
    }

    /// "40 kg x 8", "40 kg x 8 + 2" with partials, or the weight or the reps alone when only one was logged.
    static func summary(of log: SetLog, unit: WeightUnit) -> String {
        let weight = log.weightKg.map { "\(unit.format(kg: $0)) \(unit.rawValue)" }
        let reps = log.reps.map { full in
            if let partial = log.partialReps, partial > 0 { "\(full) + \(partial)" } else { String(full) }
        }
        let duration = log.durationSeconds.map { Duration.seconds($0).formatted(.time(pattern: .minuteSecond)) }
        let distance = log.distanceMeters.map { Measurement(value: $0, unit: UnitLength.meters).formatted(.measurement(width: .abbreviated)) }
        return [weight, reps ?? duration, distance].compactMap { $0 }.joined(separator: " x ")
    }

    private func cell(_ path: RowPath, field: SetField, value: SetEntry) -> some View {
        let isFocused = focus?.row == path && focus?.field == field
        let text = isFocused ? focusText(focus!, value: value) : field.display(value, unit: unit)
        return Button {
            focus = KeypadFocus(row: path, field: field, entry: value, unit: unit)
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

    /// While typing partials the full count stays visible: "8 + 2|".
    private func focusText(_ focus: KeypadFocus, value: SetEntry) -> String {
        focus.partial ? "\(value.reps.map(String.init) ?? "") + \(focus.text)" : focus.text
    }

    private func checkbox(_ isOn: Bool) -> some View {
        Image(systemName: isOn ? "checkmark.square.fill" : "square")
            .font(.title3)
            .foregroundStyle(isOn ? Theme.textPrimary : Theme.textSecondary)
            .frame(width: Self.checkboxWidth, height: 36)
    }

    /// Hide Completed Sets folds checked warm-ups behind the Warm Up chip's badge.
    func isHidden(_ path: RowPath) -> Bool {
        guard mode == .live, defaults.workout.warmUp.hideCompletedSets else { return false }
        let set = blocks[path.block].exercises[path.exercise].sets[path.set]
        return set.type == .warmUp && set.isCompleted
    }

    func hiddenWarmUpCount(block: Int, exercise index: Int) -> Int {
        blocks.rows(block: block, exercise: index).count(where: isHidden)
    }

    // MARK: Values

    /// What a row shows and logs: its log once checked, else what was typed, else the prefill.
    func entry(_ path: RowPath, previous: [WorkoutSet]) -> SetEntry {
        if let log = blocks.log(at: path) { return SetEntry(log) }
        if let draft = drafts[blocks.rowID(at: path)] { return draft }
        let suggestion = defaults.workout.progression.initialFill == .smartProgression ? suggestion(for: path) : nil
        return SessionFlow.prefill(for: path, in: blocks, previous: previous, suggestion: suggestion, rirTracking: defaults.workout.rirTracking, unit: unit)
    }

    /// The live session's Smart Progression row for `path`, if the exercise has been suggested yet.
    func suggestion(for path: RowPath) -> SetSuggestion? {
        guard mode == .live else { return nil }
        return store.suggestions[blocks[path.block].exercises[path.exercise].id]?[blocks.rowID(at: path)]
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
        applyProgression(to: blocks[path.block].exercises[path.exercise].id)
        let step = SessionFlow.afterCompleting(path, in: blocks, settings: defaults.workout, rest: restSeconds)
        if let seconds = step.restSeconds { store.startRest(seconds: seconds, alerts: defaults.workout.rest) }
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
        guard mode == .live else { return }
        let next: BlockExercise.ID? = if let partner {
            defaults.workout.supersetAutoScroll ? partner.id : nil
        } else if defaults.workout.exerciseAutoNext {
            SessionFlow.nextIncomplete(after: block, in: blocks)
        } else {
            nil
        }
        if let next { withAnimation { current = next } }
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

    /// What the first working set would log, with the exercise's warm-up settings; the calculator scales from it.
    func warmUpContext(block: Int, exercise index: Int) -> WarmUpContext {
        let item = blocks[block].exercises[index]
        let exercise = catalog.exercise(item.exerciseID)
        let overrides = ExerciseSettings.of(item.exerciseID, in: exerciseSettings)?.overrides
        let settings = defaults.workout.warmUp
        var context = WarmUpContext(
            scheme: overrides?.warmUpScheme ?? settings.schemes[exercise?.restCategory ?? .upperIsolation] ?? WarmUpStep.standard,
            automation: overrides?.warmUpAutomation ?? settings.automation,
            simplifyPlates: settings.simplifyPlates
        )
        if let set = item.sets.firstIndex(where: { $0.type != .warmUp }) {
            let previous = SessionFlow.previousSets(of: item.exerciseID, in: history)
            let value = entry(RowPath(block: block, exercise: index, set: set), previous: previous)
            context.workingWeightKg = value.weightKg
            context.reps = value.reps ?? item.sets[set].target?.repsMax
            context.rir = value.rir
        }
        let muscles = Set(exercise?.primaryMuscles ?? [])
        let earlier = blocks.flatMap(\.exercises).prefix { $0.id != item.id }
        context.isFresh = !earlier.contains { other in
            other.sets.contains { $0.type != .warmUp && $0.isCompleted }
                && !muscles.isDisjoint(with: catalog.exercise(other.exerciseID)?.primaryMuscles ?? [])
        }
        return context
    }

    /// Warm-Up Automation: exercises that track weight and have no warm-ups yet get their calculated rows.
    func automateWarmUps() {
        guard mode == .live, !store.didAutomateWarmUps.contains(session.id) else { return }
        store.didAutomateWarmUps.insert(session.id)
        for (b, block) in blocks.enumerated() {
            for (e, item) in block.exercises.enumerated() {
                guard SetField.fields(for: catalog.exercise(item.exerciseID)).contains(where: \.isWeight),
                      !item.sets.contains(where: { $0.type == .warmUp }) else { continue }
                let context = warmUpContext(block: b, exercise: e)
                guard context.automation != .none else { continue }
                let rows = SessionFlow.warmUps(context, mode: context.automation == .smart ? .smart : .scheme, unit: unit)
                guard !rows.isEmpty else { continue }
                addWarmUps(rows.map { ($0.weightKg, $0.reps) }, block: b, exercise: e)
                // The new rows need suggestions of their own; the blocks change recomputes the exercise.
                store.suggestions[item.id] = nil
                store.events[item.id] = nil
            }
        }
    }

    func remove(_ id: BlockExercise.ID) {
        blocks.remove(id)
        current = SessionFlow.initialExercise(in: blocks)
    }

    /// The builder's swap keeps sets and targets; mid-session it also drops what was logged against the old exercise.
    func swap(_ id: BlockExercise.ID, to exerciseID: ExerciseID) {
        store.suggestions[id] = nil
        store.events[id] = nil
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
        return Keypad(field: focus.field, rir: rir, partial: focus.partial) { handle($0) }
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
        case let .partial(partial):
            focus = KeypadFocus(row: state.row, field: state.field, entry: entry(state.row, previous: previousSets(for: state.row)), unit: unit, partial: partial)
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
        let before = entry(state.row, previous: previousSets(for: state.row))
        update(state.row) { state.apply(to: &$0, unit: unit) }
        focus = state
        if !state.partial { propagate(state.field, from: state.row, before: before) }
    }

    /// Propagate Changes: the edited weight or reps also lands in the later open rows that showed the same value.
    private func propagate(_ field: SetField, from path: RowPath, before: SetEntry) {
        guard defaults.workout.propagateChanges, field.isWeight || field.isReps, blocks.log(at: path) == nil else { return }
        let previous = previousSets(for: path)
        let after = field.text(entry(path, previous: previous), unit: unit)
        let rows = blocks.rows(block: path.block, exercise: path.exercise)
        let targets = SessionFlow.propagationTargets(from: path, rows: rows, isOpen: { blocks.log(at: $0) == nil }) {
            $0 == path ? field.text(before, unit: unit) : field.text(entry($0, previous: previous), unit: unit)
        }
        for target in targets {
            update(target) { field.apply(after, to: &$0, unit: unit) }
        }
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
        return KeypadFocus(row: path, field: fields[fieldIndex], entry: entry(path, previous: previousSets(for: path)), unit: unit)
    }
}

private extension KeypadKey {
    var isIncrement: Bool { if case .increment = self { true } else { false } }
}
