import SwiftUI

private func clock(_ seconds: TimeInterval) -> String {
    Duration.seconds(seconds.rounded(.up)).formatted(.time(pattern: .minuteSecond))
}

/// The header's stopwatch, countdown, and draining bar. Tapping it opens the Rest Timer sheet.
struct RestTimerPill: View {
    let action: () -> Void

    var body: some View {
        let store = LiveSessionStore.shared
        Button(action: action) {
            TimelineView(.periodic(from: .now, by: 0.25)) { context in
                let remaining = store.rest?.remaining(at: context.date) ?? 0
                let fraction = store.rest.map { remaining / $0.duration } ?? 0
                HStack(spacing: 8) {
                    Image(systemName: "stopwatch.fill").font(.footnote)
                    Text(clock(remaining)).font(AppFont.number(17)).fixedSize()
                    Capsule()
                        .fill(Theme.surfaceRaised)
                        .frame(width: 64, height: 12)
                        .overlay(alignment: .leading) {
                            Capsule().fill(Theme.textPrimary).frame(width: 64 * fraction)
                        }
                }
            }
        }
        .foregroundStyle(Theme.textPrimary)
        .accessibilityLabel("Rest Timer")
    }
}

struct RestTimerSheet: View {
    @Environment(\.dismiss) private var dismiss

    private static let restartOptions = Array(stride(from: 15, through: 300, by: 15))

    var body: some View {
        let store = LiveSessionStore.shared
        NavigationStack {
            VStack(alignment: .leading, spacing: 20) {
                TimelineView(.periodic(from: .now, by: 0.25)) { context in
                    let remaining = store.rest?.remaining(at: context.date) ?? 0
                    VStack(spacing: 16) {
                        ProgressView(value: store.rest.map { remaining / $0.duration } ?? 0)
                        HStack {
                            roundButton("gobackward.15", "Subtract 15 seconds") { store.adjustRest(by: -15) }
                            Spacer()
                            Label(clock(remaining), systemImage: "stopwatch.fill").font(AppFont.number(24))
                            Spacer()
                            roundButton("goforward.15", "Add 15 seconds") { store.adjustRest(by: 15) }
                        }
                    }
                }
                Text("Restart With New Timer").font(AppFont.headline(15))
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        pill("(0:00)", icon: "stop.fill", label: "Stop timer") { store.stopRest() }
                        if let seconds = store.setRestSeconds {
                            pill("(\(clock(TimeInterval(seconds))))", icon: "arrow.counterclockwise", label: "Restart timer") {
                                store.restartRest(seconds: seconds)
                            }
                        }
                        ForEach(Self.restartOptions, id: \.self) { seconds in
                            pill(clock(TimeInterval(seconds)), label: "Restart with \(clock(TimeInterval(seconds)))") {
                                store.restartRest(seconds: seconds)
                            }
                        }
                    }
                }
                .scrollIndicators(.hidden)
                Spacer(minLength: 0)
            }
            .padding(20)
            .navigationTitle("Rest Timer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
        }
        .presentationDetents([.height(280)])
    }

    private func roundButton(_ icon: String, _ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon).font(.title3).frame(width: 44, height: 44)
        }
        .buttonStyle(.glass)
        .buttonBorderShape(.circle)
        .accessibilityLabel(label)
    }

    private func pill(_ title: String, icon: String? = nil, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                if let icon { Image(systemName: icon) }
                Text(title)
            }
            .font(AppFont.medium(14))
            .frame(height: 28)
        }
        .buttonStyle(.glass)
        .foregroundStyle(Theme.textPrimary)
        .accessibilityLabel(label)
    }
}

/// The Warm Up chip's Set Calculator: Smart (percentages of the estimated 1-RM) or the exercise's Scheme, plus "Add
/// empty warm-up set".
struct WarmUpSheet: View {
    let context: WarmUpContext
    let unit: WeightUnit
    let onAdd: ([(weightKg: Double?, reps: Int?)]) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var mode: WarmUpMode

    init(context: WarmUpContext, unit: WeightUnit, onAdd: @escaping ([(weightKg: Double?, reps: Int?)]) -> Void) {
        self.context = context
        self.unit = unit
        self.onAdd = onAdd
        _mode = State(initialValue: context.automation == .scheme ? .scheme : .smart)
    }

    private var rows: [WarmUpRow] { SessionFlow.warmUps(context, mode: mode, unit: unit) }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if rows.isEmpty {
                        Text(context.workingWeightKg == nil ? "Enter a weight for the first working set to calculate warm-ups." : "No warm-up lands below the working weight.")
                            .foregroundStyle(Theme.textSecondary)
                    }
                    ForEach(rows, id: \.self) { row in
                        HStack(spacing: 12) {
                            SetBadge(type: .warmUp, number: 0)
                            VStack(alignment: .leading) {
                                Text(row.label).font(AppFont.medium(15))
                                Text("\(unit.format(kg: row.weightKg)) \(unit.rawValue)")
                                    .font(AppFont.caption())
                                    .foregroundStyle(Theme.textSecondary)
                            }
                            Spacer()
                            Text("\(row.reps)")
                                .font(AppFont.medium(15))
                                .frame(width: 44, height: 32)
                                .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 8))
                            Button("Add", systemImage: "plus") { add([row]) }
                                .labelStyle(.iconOnly)
                                .buttonStyle(.glass)
                                .accessibilityLabel("Add \(row.label) warm-up")
                        }
                    }
                    if !rows.isEmpty {
                        Button("Add All Warm-Up Sets") { add(rows) }
                    }
                } header: {
                    HStack {
                        Text("Set Calculator")
                        Spacer()
                        Picker("Calculator", selection: $mode) {
                            Text("Smart").tag(WarmUpMode.smart)
                            Text("Scheme").tag(WarmUpMode.scheme)
                        }
                        .pickerStyle(.segmented)
                        .frame(width: 160)
                        .accessibilityLabel("Warm-up calculator")
                    }
                }
                Section("More Options") {
                    Button {
                        onAdd([(nil, nil)])
                        dismiss()
                    } label: {
                        Label {
                            VStack(alignment: .leading) {
                                Text("Add empty warm-up set")
                                Text("Add a warm-up set to your workout").font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
                            }
                        } icon: { Image(systemName: "plus") }
                    }
                }
            }
            .navigationTitle("Warm Up")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func add(_ rows: [WarmUpRow]) {
        onAdd(rows.map { ($0.weightKg, $0.reps) })
        dismiss()
    }
}

/// The Note chip: the session note saved with this workout's history, and the exercise's pinned note shown every time.
struct NoteSheet: View {
    @Binding var sessionNote: String?
    let exerciseID: ExerciseID

    enum Tab { case session, exercise }

    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Observe private var settings: ExerciseSettings?
    @State private var tab = Tab.session
    @State private var sessionText = ""
    @State private var pinnedText = ""

    private static let limit = 300

    init(sessionNote: Binding<String?>, exerciseID: ExerciseID) {
        _sessionNote = sessionNote
        self.exerciseID = exerciseID
        _settings = Observe(ExerciseSettings.one(exerciseID))
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                Picker("Note", selection: $tab) {
                    Text("Session").tag(Tab.session)
                    Label("Exercise", systemImage: "pin.fill").tag(Tab.exercise)
                }
                .pickerStyle(.segmented)
                switch tab {
                case .session:
                    editor("Session Note", text: $sessionText, prompt: "Note about this session", footer: "Note will be saved to your workout history")
                case .exercise:
                    editor("Pinned Note", text: $pinnedText, prompt: "Pinned note about this exercise", footer: "Pinned to exercise, not saved to your workout history")
                }
                Spacer()
                Button {
                    save()
                } label: {
                    Text("Save").font(AppFont.headline()).frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.glassProminent)
                .tint(Theme.textPrimary)
                .foregroundStyle(.black)
            }
            .padding(20)
            .navigationTitle("Note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
        }
        .onAppear {
            sessionText = sessionNote ?? ""
            pinnedText = settings?.pinnedNote ?? ""
        }
    }

    private func editor(_ title: String, text: Binding<String>, prompt: String, footer: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title).font(AppFont.headline(15))
                Spacer()
                Text("\(text.wrappedValue.count)/\(Self.limit)").font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
            }
            TextField(prompt, text: text, axis: .vertical)
                .lineLimit(3...8)
                .padding(12)
                .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
                .onChange(of: text.wrappedValue) { _, value in
                    if value.count > Self.limit { text.wrappedValue = String(value.prefix(Self.limit)) }
                }
            Text(footer).font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
        }
    }

    private func save() {
        sessionNote = sessionText.isEmpty ? nil : sessionText
        if settings != nil || !pinnedText.isEmpty {
            let note = pinnedText
            store.modify(ExerciseSettings.self, id: exerciseID, orInsert: { ExerciseSettings(id: exerciseID) }) { $0.pinnedNote = note }
        }
        dismiss()
    }
}
