import SwiftUI

/// "Workout Complete" right after finishing, or a past session's summary from history and the calendar.
/// `isFinishing` adds the bottom bar with Update Workout Plan and Done.
struct WorkoutSummaryView: View {
    /// The session as handed over. Edits here change the row, so the body reads the observed row while it exists.
    private let initial: WorkoutSession
    let isFinishing: Bool

    private enum Exit { case none, finish, delete }

    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(LiveWorkoutPresenter.self) private var presenter
    @Environment(LocalStore.self) private var store
    @Environment(SessionHistory.self) private var sessionHistory
    @Environment(\.dismiss) private var dismiss
    @Observe(AppSettings.current) private var settings
    @Observe private var live: WorkoutSession?

    /// A finishing session ends when Done is tapped, but its duration stops at the moment Finish was chosen.
    @State private var finishedAt = Date.now
    @State private var updatePlan = false
    @State private var template: WorkoutTemplate?
    @State private var expanded: Set<BlockExercise.ID> = []
    @State private var isEditing = false
    @State private var isEditingStart = false
    @State private var isEditingDuration = false
    @State private var isShowingChanges = false
    /// View Changes' Undo per section. The plan write skips those changes; logged sets are untouched either way.
    @State private var undone: Set<WorkoutChanges.Kind> = []
    @State private var confirmingDelete = false
    @State private var exit = Exit.none

    init(session: WorkoutSession, isFinishing: Bool = false) {
        initial = session
        self.isFinishing = isFinishing
        _live = Observe(WorkoutSession.one(session.id))
    }

    private var session: WorkoutSession { live ?? initial }
    private var unit: WeightUnit { settings.weightUnit }

    var body: some View {
        let blocks = session.blocks
        let stats = SessionRecords.stats(in: blocks, catalog: catalog.exercise)
        let records = SessionRecords.records(in: blocks, bests: earlierBests, catalog: catalog.exercise)
        return NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    let muscleSets = WorkoutMetrics.muscleSets(in: blocks, catalog: catalog.exercise, loggedOnly: true)
                    HStack(spacing: 24) {
                        BodyMap(values: muscleSets, side: .front, fullAt: 3)
                        BodyMap(values: muscleSets, side: .back, fullAt: 3)
                    }
                    .frame(height: 280)
                    .padding(.horizontal, Theme.margin)
                    if !records.isEmpty { recordCards(records) }
                    details(volumeKg: stats.values.reduce(0) { $0 + $1.volumeKg })
                    HealthSummaryCard(session: session)
                    exerciseDetails(blocks, stats: stats, records: records)
                }
                .padding(.vertical, 16)
            }
            .background(Theme.background)
            .detailTitle(isFinishing ? "Workout Complete" : session.startedAt.formatted(date: .abbreviated, time: .omitted))
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { close() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Menu("Workout Options", systemImage: "ellipsis") {
                        Section(session.name) {
                            Button("Delete Workout", systemImage: "trash", role: .destructive) { confirmingDelete = true }
                        }
                    }
                }
            }
            .safeAreaInset(edge: .bottom) { if isFinishing { finishBar(blocks) } }
            .overlay { if isFinishing, !records.isEmpty { ConfettiOverlay() } }
        }
        .task {
            if let templateID = session.templateID {
                template = try? store.read { try WorkoutTemplate.fetchOne($0, key: WorkoutTemplate.key(templateID)) }
            }
        }
        // Ending or deleting the session while the screen is still up would empty it mid-dismissal, so it waits until gone.
        .onDisappear(perform: performExit)
        .alert("Delete this workout?", isPresented: $confirmingDelete) {
            Button("Delete", role: .destructive) {
                exit = .delete
                leave()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Its sets will be removed from your history.")
        }
        .fullScreenCover(isPresented: $isEditing) { SessionEditor(session: session, mode: .editPast) }
        .sheet(isPresented: $isEditingStart) {
            StartTimeSheet(start: session.startedAt) { start in
                let duration = endedAt.timeIntervalSince(session.startedAt)
                store.modify(WorkoutSession.self, id: session.id) { $0.startedAt = start }
                setEnd(start.addingTimeInterval(duration))
            }
        }
        .sheet(isPresented: $isEditingDuration) {
            DurationSheet(duration: duration) { setEnd(session.startedAt.addingTimeInterval($0 + TimeInterval(session.pausedSeconds))) }
        }
        .sheet(isPresented: $isShowingChanges) {
            if let template { WorkoutChangesSheet(changes: WorkoutChanges(before: template.blocks, after: SessionFlow.plan(from: blocks)), undone: $undone) }
        }
    }

    /// "Today 3:01 PM" as in the reference, the date otherwise.
    private static func startText(_ date: Date) -> String {
        let time = date.formatted(date: .omitted, time: .shortened)
        return Calendar.current.isDateInToday(date) ? "Today \(time)" : "\(date.formatted(date: .numeric, time: .omitted)) \(time)"
    }

    /// The records' baseline: every earlier session's bests, read once per history change rather than per render.
    private var earlierBests: [ExerciseID: [ExerciseRecord.Kind: Double]] {
        let session = session
        return sessionHistory.memo(EarlierBestsKey(sessionID: session.id, startedAt: session.startedAt)) { _ in
            SessionRecords.bests(in: sessionHistory.earlier(than: session).map(\.blocks), catalog: catalog.exercise)
        }
    }

    private var endedAt: Date { session.endedAt ?? finishedAt }
    private var duration: TimeInterval { endedAt.timeIntervalSince(session.startedAt) - TimeInterval(session.pausedSeconds) }

    private func setEnd(_ date: Date) {
        if isFinishing { finishedAt = date } else { store.modify(WorkoutSession.self, id: session.id) { $0.endedAt = date } }
    }

    private func close() {
        if isFinishing { exit = .finish }
        leave()
    }

    private func leave() {
        if isFinishing { presenter.isExpanded = false } else { dismiss() }
    }

    private func performExit() {
        switch exit {
        case .none: return
        case .finish:
            let finishedAt = finishedAt
            store.modify(WorkoutSession.self, id: session.id) { $0.endedAt = finishedAt }
            store.advanceProgram(after: session)
            if updatePlan, let template {
                let plan = SessionFlow.plan(from: session.blocks, template: template.blocks, undoing: undone)
                store.updateWorkoutPlan(template.id, plan: plan, session: session)
            }
        case .delete:
            store.delete(WorkoutSession.self, id: session.id)
        }
        if isFinishing { LiveSessionStore.shared.reset() }
    }

    // MARK: Sections

    private func recordCards(_ records: [ExerciseRecord]) -> some View {
        ScrollView(.horizontal) {
            HStack(spacing: 10) {
                ForEach(records) { record in
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(alignment: .top) {
                            Image(systemName: record.kind.icon).font(.title2)
                            Spacer()
                            VStack(alignment: .trailing, spacing: 0) {
                                Text(recordValue(record.kind, record.value)).font(AppFont.headline(15))
                                Text(record.gain.map { $0.formatted(.percent.precision(.fractionLength(0)).sign(strategy: .always())) } ?? "New!")
                                    .font(AppFont.rowDetail)
                                    .foregroundStyle(Theme.textSecondary)
                            }
                        }
                        Text(catalog.name(record.exerciseID))
                            .font(AppFont.rowTitle)
                            .lineLimit(2)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                        Text(record.kind.title).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
                    }
                    .padding(14)
                    .frame(width: 160, height: 130)
                    .overlay(RoundedRectangle(cornerRadius: Theme.cornerRadius).strokeBorder(Theme.surfaceRaised, lineWidth: 1.5))
                }
            }
            .padding(.horizontal, Theme.margin)
        }
        .scrollIndicators(.hidden)
    }

    private func recordValue(_ kind: ExerciseRecord.Kind, _ value: Double) -> String {
        kind == .reps ? "\(Int(value)) reps" : weight(value)
    }

    private func weight(_ kg: Double) -> String {
        let value = unit.fromKg(kg).formatted(.number.precision(.fractionLength(0...1)))
        return "\(value) \(unit.rawValue)"
    }

    private func details(volumeKg: Double) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Workout Details").font(AppFont.sectionTitle).padding(.bottom, 8)
            detailRow("Volume", icon: "scalemass.fill", value: weight(volumeKg))
            Divider().overlay(Theme.separator)
            detailRow("Start Time", icon: "arrow.right.to.line", subtitle: Self.startText(session.startedAt)) {
                isEditingStart = true
            }
            Divider().overlay(Theme.separator)
            detailRow("Duration", icon: "clock.fill", subtitle: Duration.seconds(duration).formatted(.time(pattern: .hourMinuteSecond))) {
                isEditingDuration = true
            }
            if !isFinishing {
                Divider().overlay(Theme.separator)
                detailRow("Edit Workout", icon: "dumbbell.fill", subtitle: "Go to the workout editor") { isEditing = true }
            }
        }
        .padding(.horizontal, Theme.margin)
    }

    private func detailRow(_ title: String, icon: String, subtitle: String? = nil, value: String? = nil, edit: (() -> Void)? = nil) -> some View {
        HStack(spacing: 16) {
            RowLabel(title: title, detail: subtitle, systemImage: icon)
            Spacer()
            if let value { Text(value).font(AppFont.rowTitle) }
            if let edit {
                Button("Edit", action: edit)
                    .font(AppFont.chip)
                    .buttonStyle(.glass)
                    .accessibilityLabel("Edit \(title)")
            }
        }
        .frame(minHeight: 60)
    }

    private func exerciseDetails(_ blocks: [WorkoutBlock], stats: [ExerciseID: ExerciseStats], records: [ExerciseRecord]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Details").font(AppFont.sectionTitle).padding(.horizontal, Theme.margin).padding(.bottom, 8)
            ForEach(blocks) { block in
                let items = block.exercises.filter(\.hasLoggedSets)
                if !items.isEmpty {
                    if block.isSuperset {
                        Text(block.exercises.count > 2 ? "Circuit" : "Superset")
                            .font(AppFont.medium(14))
                            .foregroundStyle(Theme.textSecondary)
                            .padding(.horizontal, Theme.margin)
                            .padding(.top, 12)
                    }
                    ForEach(items) { item in
                        exerciseRow(item, records: records.filter { $0.exerciseID == item.exerciseID })
                        Divider().overlay(Theme.separator)
                    }
                }
            }
        }
    }

    private func exerciseRow(_ item: BlockExercise, records: [ExerciseRecord]) -> some View {
        let isExpanded = expanded.contains(item.id)
        let exercise = catalog.exercise(item.exerciseID)
        let stats = exercise.map { SessionRecords.stats(of: [item], exercise: $0) } ?? ExerciseStats()
        return VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(.snappy) {
                    if isExpanded { expanded.remove(item.id) } else { expanded.insert(item.id) }
                }
            } label: {
                HStack(spacing: 14) {
                    ExerciseTile(exercise: exercise)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(catalog.name(item.exerciseID))
                            .font(AppFont.rowTitle)
                            .foregroundStyle(Theme.textPrimary)
                            .multilineTextAlignment(.leading)
                        Text("\(weight(stats.volumeKg)) volume").font(AppFont.rowDetail)
                        Text(stats.loggedSets == 1 ? "1 set" : "\(stats.loggedSets) sets").font(AppFont.rowDetail)
                        if !records.isEmpty {
                            HStack(spacing: 10) {
                                ForEach(records) { record in
                                    Label(recordValue(record.kind, record.value), systemImage: record.kind.icon)
                                        .labelStyle(.titleAndIcon)
                                }
                            }
                            .font(AppFont.rowDetail)
                        }
                    }
                    .foregroundStyle(Theme.textSecondary)
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down").foregroundStyle(Theme.textSecondary)
                }
                .padding(.horizontal, Theme.margin)
                .padding(.vertical, 10)
                .contentShape(Rectangle())
            }
            .foregroundStyle(Theme.textPrimary)
            .accessibilityLabel("\(catalog.name(item.exerciseID)) details")
            if isExpanded {
                ForEach(Array(item.sets.enumerated().filter { $0.element.isCompleted }), id: \.element.id) { index, set in
                    setLine(set, number: item.sets.number(at: index))
                }
            }
        }
    }

    private func setLine(_ set: WorkoutSet, number: Int) -> some View {
        VStack(spacing: 0) {
            ForEach([set.log] + set.subSets.map(\.log), id: \.self) { log in
                if let log {
                    HStack(spacing: 14) {
                        SetBadge(type: set.type, number: number, size: .compact)
                        Text(SessionEditor.summary(of: log, unit: unit)).font(AppFont.rowTitle)
                        Spacer()
                        if log.rir != nil { RIRBadge(rir: log.rir) }
                    }
                    .padding(.horizontal, Theme.margin)
                    .frame(height: 40)
                }
            }
        }
    }

    private func finishBar(_ blocks: [WorkoutBlock]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            if template != nil {
                Toggle(isOn: $updatePlan) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Update Workout Plan").font(AppFont.rowTitle)
                        Text("Save these changes as the new default for this workout")
                            .font(AppFont.rowDetail)
                            .foregroundStyle(Theme.textSecondary)
                        Button("View Changes") { isShowingChanges = true }
                            .font(AppFont.rowDetail)
                            .underline()
                            .foregroundStyle(Theme.textPrimary)
                    }
                }
                .tint(Theme.accent)
            }
            Button(action: close) {
                Text("Done").font(AppFont.headline()).frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.glassProminent)
            .tint(Theme.textPrimary)
            .foregroundStyle(Theme.onPrimary)
        }
        .padding(.horizontal, Theme.margin)
        .padding(.vertical, 12)
        .background(Theme.background)
    }
}

private struct StartTimeSheet: View {
    @State var start: Date
    let onSave: (Date) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            DatePicker("Start Time", selection: $start, in: ...Date.now)
                .datePickerStyle(.wheel)
                .labelsHidden()
                .detailTitle("Start Time")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") {
                            onSave(start)
                            dismiss()
                        }
                    }
                }
        }
        .presentationDetents([.medium])
    }
}

private struct DurationSheet: View {
    let onSave: (TimeInterval) -> Void
    @State private var hours: Int
    @State private var minutes: Int
    @Environment(\.dismiss) private var dismiss

    init(duration: TimeInterval, onSave: @escaping (TimeInterval) -> Void) {
        self.onSave = onSave
        let total = Int(duration / 60)
        _hours = State(initialValue: min(total / 60, 9))
        _minutes = State(initialValue: total % 60)
    }

    var body: some View {
        NavigationStack {
            HStack {
                Picker("Hours", selection: $hours) { ForEach(0..<10, id: \.self) { Text("\($0) h") } }
                Picker("Minutes", selection: $minutes) { ForEach(0..<60, id: \.self) { Text("\($0) min") } }
            }
            .pickerStyle(.wheel)
            .detailTitle("Duration")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave(TimeInterval(hours * 3600 + minutes * 60))
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium])
    }
}

/// "Workout Changes": Before and After for each exercise Update Workout Plan would change, with Undo per section.
private struct WorkoutChangesSheet: View {
    let changes: WorkoutChanges
    @Binding var undone: Set<WorkoutChanges.Kind>
    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                if changes.isEmpty {
                    Text("This workout matches its plan.").foregroundStyle(Theme.textSecondary)
                }
                if !changes.added.isEmpty {
                    section(.added, "Added Exercises") { ForEach(changes.added) { plan($0, title: catalog.name($0.exerciseID)) } }
                }
                if !changes.modified.isEmpty {
                    section(.modified, "Modified Exercises") {
                        ForEach(changes.modified, id: \.after.id) { change in
                            VStack(alignment: .leading, spacing: 12) {
                                plan(change.before, title: "\(catalog.name(change.before.exerciseID)) (Before)")
                                plan(change.after, title: "\(catalog.name(change.after.exerciseID)) (After)")
                            }
                        }
                    }
                }
                if !changes.regrouped.isEmpty {
                    section(.regrouped, "Supersets") {
                        ForEach(changes.regrouped) { block in
                            Text(block.exercises.map { catalog.name($0.exerciseID) }.joined(separator: " + "))
                                .font(AppFont.rowTitle)
                        }
                    }
                }
                if !changes.removed.isEmpty {
                    section(.removed, "Removed Exercises") { ForEach(changes.removed) { plan($0, title: catalog.name($0.exerciseID)) } }
                }
            }
            .detailTitle("Workout Changes")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
        }
    }

    /// An undone section stays listed, struck through, with Redo in place of Undo.
    private func section(_ kind: WorkoutChanges.Kind, _ title: String, @ViewBuilder rows: () -> some View) -> some View {
        let isUndone = undone.contains(kind)
        return Section {
            rows().strikethrough(isUndone).opacity(isUndone ? 0.5 : 1)
        } header: {
            HStack {
                Text(title)
                if isUndone { Text("Undone").foregroundStyle(Theme.textSecondary) }
                Spacer()
                Button(isUndone ? "Redo" : "Undo") {
                    if isUndone { undone.remove(kind) } else { undone.insert(kind) }
                }
                .font(AppFont.headline(13))
                .underline()
                .textCase(nil)
                .accessibilityLabel("\(isUndone ? "Redo" : "Undo") \(title)")
            }
        }
    }

    private func plan(_ item: BlockExercise, title: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(AppFont.rowTitle)
            if item.sets.isEmpty { Text("No sets").font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary) }
            ForEach(Array(item.sets.enumerated()), id: \.element.id) { index, set in
                HStack(spacing: 8) {
                    SetBadge(type: set.type, number: item.sets.number(at: index), size: .compact)
                    Text(Self.target(set.target)).font(AppFont.rowDetail)
                    Spacer()
                    if let rir = set.target?.rir { RIRBadge(rir: rir) }
                }
            }
        }
    }

    private static func target(_ target: SetTarget?) -> String {
        switch (target?.repsMin, target?.repsMax) {
        case let (min?, max?) where min != max: "\(min)-\(max) reps"
        case let (reps?, _), let (nil, reps?): "\(reps) reps"
        default: "No target set"
        }
    }
}

private struct EarlierBestsKey: Hashable {
    var sessionID: UUID
    var startedAt: Date
}
