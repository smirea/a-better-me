import SwiftData
import SwiftUI

/// "Workout Complete" right after finishing, or a past session's summary from history and the calendar.
/// `isFinishing` adds the bottom bar with Update Workout Plan and Done.
struct WorkoutSummaryView: View {
    let session: WorkoutSession
    var isFinishing = false

    private enum Exit { case none, finish, delete }

    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(LiveWorkoutPresenter.self) private var presenter
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @AppStorage(WeightUnit.storageKey) private var unit = WeightUnit.kg

    /// A finishing session ends when Done is tapped, but its duration stops at the moment Finish was chosen.
    @State private var finishedAt = Date.now
    @State private var updatePlan = false
    @State private var template: WorkoutTemplate?
    @State private var earlier: [[WorkoutBlock]] = []
    @State private var expanded: Set<BlockExercise.ID> = []
    @State private var isEditing = false
    @State private var isEditingStart = false
    @State private var isEditingDuration = false
    @State private var isShowingChanges = false
    @State private var confirmingDelete = false
    @State private var exit = Exit.none

    var body: some View {
        let blocks = session.blocks
        let stats = SessionRecords.stats(in: blocks, catalog: catalog.exercise)
        let records = SessionRecords.records(in: blocks, earlier: earlier, catalog: catalog.exercise)
        return NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    let muscleSets = WorkoutMetrics.muscleSets(in: blocks, catalog: catalog.exercise, loggedOnly: true)
                    HStack(spacing: 24) {
                        BodyMap(values: muscleSets, side: .front, fullAt: 3)
                        BodyMap(values: muscleSets, side: .back, fullAt: 3)
                    }
                    .frame(height: 280)
                    .padding(.horizontal, 20)
                    if !records.isEmpty { recordCards(records) }
                    details(volumeKg: stats.values.reduce(0) { $0 + $1.volumeKg })
                    exerciseDetails(blocks, stats: stats, records: records)
                }
                .padding(.vertical, 16)
            }
            .background(Theme.background)
            .navigationTitle(isFinishing ? "Workout Complete" : session.startedAt.formatted(date: .abbreviated, time: .omitted))
            .navigationBarTitleDisplayMode(.inline)
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
        }
        .task {
            let start = session.startedAt
            let id = session.id
            let descriptor = FetchDescriptor<WorkoutSession>(predicate: #Predicate { $0.endedAt != nil && $0.startedAt < start && $0.id != id })
            earlier = ((try? context.fetch(descriptor)) ?? []).map(\.blocks)
            if let templateID = session.templateID {
                template = try? context.fetch(FetchDescriptor<WorkoutTemplate>(predicate: #Predicate { $0.id == templateID })).first
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
                session.startedAt = start
                setEnd(start.addingTimeInterval(duration))
            }
        }
        .sheet(isPresented: $isEditingDuration) {
            DurationSheet(duration: endedAt.timeIntervalSince(session.startedAt)) { setEnd(session.startedAt.addingTimeInterval($0)) }
        }
        .sheet(isPresented: $isShowingChanges) {
            if let template { WorkoutChangesSheet(changes: WorkoutChanges(before: template.blocks, after: SessionFlow.plan(from: blocks))) }
        }
    }

    private var endedAt: Date { session.endedAt ?? finishedAt }

    private func setEnd(_ date: Date) {
        if isFinishing { finishedAt = date } else { session.endedAt = date }
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
            session.endedAt = finishedAt
            if updatePlan, let template { template.blocks = SessionFlow.plan(from: session.blocks) }
        case .delete:
            context.delete(session)
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
                                    .font(AppFont.caption(12))
                                    .foregroundStyle(Theme.textSecondary)
                            }
                        }
                        Text(catalog.name(record.exerciseID)).font(AppFont.headline(15)).lineLimit(2)
                        Spacer(minLength: 0)
                        Text(record.kind.title).font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
                    }
                    .padding(14)
                    .frame(width: 160, height: 130)
                    .overlay(RoundedRectangle(cornerRadius: Theme.cornerRadius).strokeBorder(Theme.surfaceRaised, lineWidth: 1.5))
                }
            }
            .padding(.horizontal, 20)
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
            Text("Workout Details").font(AppFont.title()).padding(.bottom, 8)
            detailRow("Volume", icon: "scalemass.fill", value: weight(volumeKg))
            Divider().overlay(Theme.separator)
            detailRow("Start Time", icon: "arrow.right.to.line", subtitle: session.startedAt.formatted(date: .numeric, time: .shortened)) {
                isEditingStart = true
            }
            Divider().overlay(Theme.separator)
            detailRow("Duration", icon: "clock.fill", subtitle: Duration.seconds(endedAt.timeIntervalSince(session.startedAt)).formatted(.time(pattern: .hourMinuteSecond))) {
                isEditingDuration = true
            }
            if !isFinishing {
                Divider().overlay(Theme.separator)
                detailRow("Edit Workout", icon: "dumbbell.fill", subtitle: "Go to the workout editor") { isEditing = true }
            }
        }
        .padding(.horizontal, 20)
    }

    private func detailRow(_ title: String, icon: String, subtitle: String? = nil, value: String? = nil, edit: (() -> Void)? = nil) -> some View {
        HStack(spacing: 16) {
            Image(systemName: icon).frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(AppFont.medium(16))
                if let subtitle { Text(subtitle).font(AppFont.caption()).foregroundStyle(Theme.textSecondary) }
            }
            Spacer()
            if let value { Text(value).font(AppFont.body(15)) }
            if let edit {
                Button("Edit", action: edit)
                    .buttonStyle(.glass)
                    .accessibilityLabel("Edit \(title)")
            }
        }
        .frame(minHeight: 60)
    }

    private func exerciseDetails(_ blocks: [WorkoutBlock], stats: [ExerciseID: ExerciseStats], records: [ExerciseRecord]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Details").font(AppFont.title()).padding(.horizontal, 20).padding(.bottom, 8)
            ForEach(blocks) { block in
                let items = block.exercises.filter(\.hasLoggedSets)
                if !items.isEmpty {
                    if block.isSuperset {
                        Text(block.exercises.count > 2 ? "Circuit" : "Superset")
                            .font(AppFont.medium(14))
                            .foregroundStyle(Theme.textSecondary)
                            .padding(.horizontal, 20)
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
                    Group {
                        if let exercise { ExerciseImage(exercise: exercise) } else { Theme.surfaceRaised }
                    }
                    .frame(width: 48, height: 64)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(catalog.name(item.exerciseID)).font(AppFont.headline(15))
                        Text("\(weight(stats.volumeKg)) volume").font(AppFont.caption())
                        Text(stats.loggedSets == 1 ? "1 set" : "\(stats.loggedSets) sets").font(AppFont.caption())
                        if !records.isEmpty {
                            HStack(spacing: 10) {
                                ForEach(records) { record in
                                    Label(recordValue(record.kind, record.value), systemImage: record.kind.icon)
                                        .labelStyle(.titleAndIcon)
                                }
                            }
                            .font(AppFont.caption(12))
                        }
                    }
                    .foregroundStyle(Theme.textSecondary)
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down").foregroundStyle(Theme.textSecondary)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 10)
                .contentShape(Rectangle())
            }
            .foregroundStyle(Theme.textPrimary)
            .accessibilityLabel("\(catalog.name(item.exerciseID)) details")
            if isExpanded {
                ForEach(Array(item.sets.enumerated().filter { $0.element.isCompleted }), id: \.element.id) { index, set in
                    setLine(set, number: item.sets.prefix(index + 1).count { $0.type != .warmUp })
                }
            }
        }
    }

    private func setLine(_ set: WorkoutSet, number: Int) -> some View {
        VStack(spacing: 0) {
            ForEach([set.log] + set.subSets.map(\.log), id: \.self) { log in
                if let log {
                    HStack(spacing: 14) {
                        Text(set.type.badge ?? "\(number)")
                            .font(AppFont.headline(12))
                            .frame(width: 24, height: 24)
                            .background(Theme.surfaceRaised, in: Circle())
                        Text(SessionEditor.summary(of: log, unit: unit)).font(AppFont.medium(15))
                        Spacer()
                        if log.rir != nil { RIRBadge(rir: log.rir) }
                    }
                    .padding(.horizontal, 20)
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
                        Text("Update Workout Plan").font(AppFont.headline(15))
                        Text("Save these changes as the new default for this workout")
                            .font(AppFont.caption(12))
                            .foregroundStyle(Theme.textSecondary)
                        Button("View Changes") { isShowingChanges = true }
                            .font(AppFont.caption(12))
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
            .foregroundStyle(.black)
        }
        .padding(.horizontal, 20)
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
                .navigationTitle("Start Time")
                .navigationBarTitleDisplayMode(.inline)
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
            .navigationTitle("Duration")
            .navigationBarTitleDisplayMode(.inline)
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

/// "Workout Changes": Before and After for each exercise Update Workout Plan would change.
private struct WorkoutChangesSheet: View {
    let changes: WorkoutChanges
    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                if changes.isEmpty {
                    Text("This workout matches its plan.").foregroundStyle(Theme.textSecondary)
                }
                if !changes.added.isEmpty {
                    Section("Added Exercises") { ForEach(changes.added) { plan($0, title: catalog.name($0.exerciseID)) } }
                }
                if !changes.modified.isEmpty {
                    Section("Modified Exercises") {
                        ForEach(changes.modified, id: \.after.id) { change in
                            VStack(alignment: .leading, spacing: 12) {
                                plan(change.before, title: "\(catalog.name(change.before.exerciseID)) (Before)")
                                plan(change.after, title: "\(catalog.name(change.after.exerciseID)) (After)")
                            }
                        }
                    }
                }
                if !changes.removed.isEmpty {
                    Section("Removed Exercises") { ForEach(changes.removed) { plan($0, title: catalog.name($0.exerciseID)) } }
                }
            }
            .navigationTitle("Workout Changes")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
        }
    }

    private func plan(_ item: BlockExercise, title: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(AppFont.headline(15))
            if item.sets.isEmpty { Text("No sets").font(AppFont.caption()).foregroundStyle(Theme.textSecondary) }
            ForEach(Array(item.sets.enumerated()), id: \.element.id) { index, set in
                HStack(spacing: 8) {
                    Text(set.type.badge ?? "\(item.sets.prefix(index + 1).count { $0.type != .warmUp })")
                        .font(AppFont.headline(11))
                        .frame(width: 20, height: 20)
                        .background(Theme.surfaceRaised, in: Circle())
                    Text(Self.target(set.target)).font(AppFont.caption())
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
