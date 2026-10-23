import SwiftData
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
                            .tint(Theme.textPrimary)
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
                        if let rest = store.rest {
                            pill("(\(clock(TimeInterval(rest.defaultSeconds))))", icon: "arrow.counterclockwise", label: "Restart timer") {
                                store.restartRest(seconds: rest.defaultSeconds)
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
            .padding(.horizontal, 14)
            .frame(height: 36)
            .background(Theme.surfaceRaised, in: Capsule())
        }
        .foregroundStyle(Theme.textPrimary)
        .accessibilityLabel(label)
    }
}

/// The Warm Up chip's Set Calculator in Scheme mode, plus "Add empty warm-up set". Smart warm-ups are cut from
/// milestone 1.
struct WarmUpSheet: View {
    let workingWeightKg: Double?
    let unit: WeightUnit
    let onAdd: ([(weightKg: Double?, reps: Int?)]) -> Void
    @Environment(\.dismiss) private var dismiss

    private var steps: [WarmUpScheme.Step] {
        guard let workingWeightKg, workingWeightKg > 0 else { return [] }
        return WarmUpScheme.sets(workingWeight: unit.fromKg(workingWeightKg), increment: WarmUpScheme.increment(for: unit))
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if steps.isEmpty {
                        Text("Enter a weight for the first working set to calculate warm-ups.")
                            .foregroundStyle(Theme.textSecondary)
                    }
                    ForEach(steps, id: \.self) { step in
                        HStack(spacing: 12) {
                            SetBadge(type: .warmUp, number: 0)
                            VStack(alignment: .leading) {
                                Text("\(step.percent)% of working weight").font(AppFont.medium(15))
                                Text("\(step.weight.formatted()) \(unit.rawValue) × \(step.reps)")
                                    .font(AppFont.caption())
                                    .foregroundStyle(Theme.textSecondary)
                            }
                            Spacer()
                            Button("Add", systemImage: "plus.circle.fill") { add([step]) }
                                .labelStyle(.iconOnly)
                                .font(.title2)
                        }
                    }
                    if !steps.isEmpty {
                        Button("Add All Warm-Up Sets") { add(steps) }
                    }
                } header: {
                    HStack {
                        Text("Set Calculator")
                        Spacer()
                        Text("Scheme")
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

    private func add(_ steps: [WarmUpScheme.Step]) {
        onAdd(steps.map { (unit.toKg($0.weight), $0.reps) })
        dismiss()
    }
}

/// The Note chip: the session note saved with this workout's history, and the exercise's pinned note shown every time.
struct NoteSheet: View {
    @Binding var sessionNote: String?
    let exerciseID: ExerciseID

    enum Tab { case session, exercise }

    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Query private var settings: [ExerciseSettings]
    @State private var tab = Tab.session
    @State private var sessionText = ""
    @State private var pinnedText = ""

    private static let limit = 300

    init(sessionNote: Binding<String?>, exerciseID: ExerciseID) {
        _sessionNote = sessionNote
        self.exerciseID = exerciseID
        _settings = Query(filter: #Predicate<ExerciseSettings> { $0.id == exerciseID })
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
            pinnedText = settings.first?.pinnedNote ?? ""
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
        if let setting = settings.first {
            setting.pinnedNote = pinnedText
        } else if !pinnedText.isEmpty {
            context.insert(ExerciseSettings(id: exerciseID, pinnedNote: pinnedText))
        }
        dismiss()
    }
}
