import SwiftUI

/// "Create Program" (research spec milestone-2.md §1.1): one question per step, then the program editor with Save to
/// Library and Activate Program. Both paths insert the program before the editor opens, so the editor edits a real row;
/// closing from the editor deletes it again. `onFinish` runs after the program was kept.
struct NewProgramWizard: View {
    var onFinish: () -> Void = {}

    @Environment(LocalStore.self) private var store
    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(\.dismiss) private var dismiss
    @Observe(AppSettings.current) private var settings
    @Observe(GymProfile.all) private var gyms
    @Observe(ExerciseSettings.all) private var exerciseSettings
    @AppStorage(NewProgramWizardRules.storageKey) private var lastInputs = ""
    @AppStorage(NewProgramWizardRules.pickedNoneKey) private var pickedNone = false
    @State private var inputs = NewProgramWizardRules.initialInputs(
        storage: UserDefaults.standard.string(forKey: NewProgramWizardRules.storageKey) ?? "",
        experience: .intermediate
    )
    @State private var method = CreationMethod.smartGeneration
    @State private var name: String?
    @State private var color = ProgramColor.red
    @State private var icon = ProgramColor.defaultIcon
    @State private var path: [WizardRoute] = []
    @State private var draftID: Program.ID?
    @State private var confirmingExit = false
    @State private var importing = false
    @State private var importFailed = false
    @State private var unmatched: [String] = []

    private var steps: [WizardStep] { NewProgramWizardRules.steps(method: method, hasGyms: !gyms.isEmpty) }

    var body: some View {
        NavigationStack(path: $path) {
            page(.splash)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Close", systemImage: "xmark") { dismiss() }
                    }
                }
                .navigationDestination(for: WizardRoute.self) { route in
                    switch route {
                    case let .step(step): page(step)
                    case let .editor(id): editor(id)
                    case .gyms: GymProfilesView()
                    }
                }
        }
        .tint(Theme.textPrimary)
        .confirmationDialog("Exit the Program Builder?", isPresented: $confirmingExit, titleVisibility: .visible) {
            Button("Discard Program", role: .destructive) {
                if let draftID { store.deleteProgram(draftID) }
                draftID = nil
                dismiss()
            }
            Button("Keep Editing", role: .cancel) {}
        } message: {
            Text("This program has not been saved and will be discarded.")
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.xlsx]) { importProgram($0) }
        .alert("Import failed", isPresented: $importFailed) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("We only support select spreadsheet formats with a .xlsx extension. If the program spreadsheet wasn't exported from MacroFactor Workouts or explicitly advertised to work with MacroFactor Workouts, it will likely fail to import. Only upload content you have permission to use.")
        }
        .unmatchedExercisesAlert($unmatched)
    }

    private func page(_ step: WizardStep) -> some View {
        WizardPage(progress: progress(of: step), title: title(of: step), nextTitle: step == .generating ? nil : "Next", nextEnabled: canAdvance(step)) {
            advance(from: step)
        } content: {
            content(of: step)
        } footer: {
            if step == .muscleFocus {
                HStack {
                    Text(NewProgramWizardRules.focusSummary(inputs.muscleFocus)).font(AppFont.medium(14))
                    Spacer()
                    Button("Reset") { inputs.muscleFocus = [:] }
                        .font(AppFont.medium(14))
                        .underline()
                        .disabled(inputs.muscleFocus.isEmpty)
                }
                .padding(.horizontal)
            }
        }
        .navigationBarBackButtonHidden(step == .generating)
    }

    private func progress(of step: WizardStep) -> Double {
        let index = steps.firstIndex(of: step) ?? 0
        return Double(index + 1) / Double(steps.count + 1)
    }

    private func title(of step: WizardStep) -> String? {
        switch step {
        case .splash: nil
        case .method: "How would you like to create your program?"
        case .goal: "What is your primary goal?"
        case .days: "How many times per week would you like to train?"
        case .split: "How do you prefer to structure your training?"
        case .sessionLength: "How much time would you like to budget per session?"
        case .repProgression: "How do you prefer your rep ranges to update each week?"
        case .muscleFocus: "Which muscles should get more or less focus?"
        case .gym: "Which of your gyms will you be using during this program?"
        case .keep: "Would you like to keep these selections from last time?"
        case .name: "What would you like to name this program?"
        case .color: "What color should we use to display this program?"
        case .generating: "Generating your program based on the latest science"
        }
    }

    private var programName: String {
        name ?? (method == .smartGeneration ? NewProgramWizardRules.defaultName(for: inputs) : "")
    }

    private func canAdvance(_ step: WizardStep) -> Bool {
        switch step {
        case .name: !programName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        default: true
        }
    }

    private func advance(from step: WizardStep) {
        guard let index = steps.firstIndex(of: step) else { return }
        if index + 1 < steps.count {
            path.append(.step(steps[index + 1]))
        } else if method == .fromScratch {
            open(NewProgramWizardRules.scratchProgram(name: programName.trimmingCharacters(in: .whitespacesAndNewlines), color: color, icon: icon))
        } else if method == .importFile {
            importing = true
        }
    }

    @ViewBuilder
    private func content(of step: WizardStep) -> some View {
        switch step {
        case .splash:
            VStack(spacing: 24) {
                Image(systemName: "point.topleft.down.to.point.bottomright.curvepath")
                    .font(.system(size: 56, weight: .semibold))
                    .padding(.top, 80)
                Text("We will create a personalized training program tailored to your goals. Or, you can import or build your own.")
                    .font(AppFont.title())
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
        case .method:
            WizardOption(icon: "sparkles", title: "Use Smart Generation", subtitle: "We will create a custom plan tailored to your goals, fitness level, and gym equipment", tag: "Recommended", selected: method == .smartGeneration) { method = .smartGeneration }
            WizardOption(icon: "wrench.fill", title: "Build From Scratch", subtitle: "Start with a fully blank slate and no guidance", selected: method == .fromScratch) { method = .fromScratch }
            WizardOption(icon: "icloud.and.arrow.up.fill", title: "Import From File", subtitle: "You can upload .xlsx files from previously exported programs", selected: method == .importFile) { method = .importFile }
        case .goal:
            option("Muscle Hypertrophy", "Workouts will focus on increasing muscle size using moderate weights and reps.", \.goal, .hypertrophy)
            option("Muscle Strength", "Workouts will focus on increasing maximal strength using heavier weights for fewer reps.", \.goal, .strength)
            option("Both Strength & Hypertrophy", "Workouts will balance strength and size with a variety of weight and rep schemes.", \.goal, .both)
        case .days:
            DaysStepper(days: Binding(get: { inputs.daysPerWeek }, set: { inputs = NewProgramWizardRules.settingDays($0, in: inputs) }))
        case .split:
            ForEach(SplitPlan.options(daysPerWeek: inputs.daysPerWeek), id: \.self) { split in
                option(split.title, split.summary, \.split, split)
            }
        case .sessionLength:
            ForEach([SessionLength.upTo20, .from20To40, .from40To60, .from60To90, .from90To120, .over120], id: \.self) { length in
                option(length.title, nil, \.sessionLength, length)
            }
        case .repProgression:
            option("No preference", "We'll choose a recommended option for you.", \.repProgression, .noPreference)
            option("Static", "Keep the same rep targets each week.", \.repProgression, .constant)
            option("Linear", "Gradually decrease rep targets and increase weights over the program.", \.repProgression, .linear)
            option("Reverse Linear", "Gradually increase rep targets and decrease weights over the program.", \.repProgression, .reverseLinear)
            option("Undulating", "Alternate between lower rep targets with heavier weights and higher rep targets with lighter weights each week.", \.repProgression, .undulating)
        case .muscleFocus:
            MuscleFocusList(focus: $inputs.muscleFocus)
        case .gym:
            let chosen = NewProgramWizardRules.gym(inputs.gymID, among: gyms)
            ForEach(gyms) { gym in
                WizardOption(icon: gym.icon, title: gym.name, subtitle: gym.equipment.count == 1 ? "1 piece of equipment" : "\(gym.equipment.count) pieces of equipment", tag: gym.isDefault ? "Default" : nil, selected: gym.id == chosen?.id) {
                    inputs.gymID = gym.id
                }
            }
            NavigationLink("Manage Gym Profiles", value: WizardRoute.gyms)
                .font(AppFont.headline(15))
                .underline()
                .padding(.top, 4)
        case .keep:
            KeepSelections(deload: $inputs.deload, profile: settings.profile, pickedNone: $pickedNone)
        case .name:
            VStack(alignment: .leading, spacing: 8) {
                Text("Name").font(AppFont.headline(14))
                TextField("Name", text: Binding(get: { programName }, set: { name = $0 }))
                    .padding(12)
                    .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
                    .submitLabel(.next)
                    .onSubmit { if canAdvance(.name) { advance(from: .name) } }
            }
        case .color:
            ColorPickerRow(selection: $color, icon: icon)
            Divider().overlay(Theme.separator).padding(.bottom, 8)
            ProgramIconGrid(selection: icon, color: color) { icon = $0 }
        case .generating:
            GeneratingChecklist(work: generate) { generated in
                if path.last == .step(.generating) { path.removeLast() }
                open(generated)
            }
        }
    }

    private func option<Value: Hashable>(_ title: String, _ subtitle: String?, _ field: WritableKeyPath<GeneratorInputs, Value>, _ value: Value) -> some View {
        WizardOption(title: title, subtitle: subtitle, selected: inputs[keyPath: field] == value) { inputs[keyPath: field] = value }
    }

    private func generate() async -> GeneratedProgram {
        var answers = inputs
        answers.experience = settings.profile.liftingExperience
        let gym = NewProgramWizardRules.gym(answers.gymID, among: gyms)
        answers.gymID = gym?.id
        lastInputs = NewProgramWizardRules.storage(of: answers)
        let (profile, exercises, equipment, name, color, icon) = (settings.profile, catalog.bundled, catalog.equipment, programName, color, icon)
        let doNotRecommend = Set(exerciseSettings.filter(\.doNotRecommend).map(\.id))
        return await Task.detached {
            var rng = SystemRandomNumberGenerator()
            return ProgramGenerator.generate(answers, profile: profile, catalog: exercises, equipment: equipment, gym: gym, doNotRecommend: doNotRecommend, name: name, color: color, icon: icon, using: &rng)
        }.value
    }

    private func importProgram(_ result: Result<URL, Error>) {
        do {
            let imported = try MFTransfer.importProgram(TransferFile.read(result.get()), exercises: catalog.all, gyms: gyms)
            imported.insertNewExercises(into: store)
            open(imported.value)
            unmatched = imported.newExercises.map(\.name)
        } catch {
            importFailed = true
        }
    }

    private func open(_ generated: GeneratedProgram) {
        store.insertProgram(generated, activate: false)
        draftID = generated.program.id
        path.append(.editor(generated.program.id))
    }

    private func editor(_ id: Program.ID) -> some View {
        ProgramEditorView(programID: id, draft: ProgramDraftActions(
            save: { finish() },
            activate: {
                store.activate(id)
                finish()
            }
        ))
        .navigationBarBackButtonHidden()
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Close", systemImage: "xmark") { confirmingExit = true }
            }
        }
    }

    private func finish() {
        draftID = nil
        dismiss()
        onFinish()
    }
}

private enum WizardRoute: Hashable {
    case step(WizardStep)
    case editor(Program.ID)
    case gyms
}

/// One wizard screen: the progress bar, the question, its options, and the pinned Next.
private struct WizardPage<Content: View, Footer: View>: View {
    let progress: Double
    let title: String?
    let nextTitle: String?
    let nextEnabled: Bool
    let onNext: () -> Void
    @ViewBuilder let content: Content
    @ViewBuilder let footer: Footer

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if let title {
                    Text(title).font(AppFont.title(22)).padding(.bottom, 8)
                }
                content
            }
            .padding(.horizontal)
            .padding(.top, 16)
            .padding(.bottom)
        }
        .background(Theme.background)
        .safeAreaInset(edge: .top, spacing: 0) {
            ProgressView(value: progress).tint(Theme.textPrimary).padding(.horizontal)
        }
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 12) {
                footer
                if let nextTitle { PinnedActionButton(nextTitle, action: onNext).disabled(!nextEnabled) }
            }
            .padding(.top, 8)
            .background(Theme.background)
        }
        .navigationTitle("Create Program")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// A radio row: an optional icon, the title, a one-line description, an optional tag, and the radio on the right.
struct WizardOption: View {
    var icon: String?
    let title: String
    let subtitle: String?
    var tag: String?
    let selected: Bool
    let action: () -> Void
    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                if let icon {
                    Image(systemName: icon).font(.system(size: 20, weight: .semibold)).frame(width: 28)
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(AppFont.headline(15))
                    if let subtitle {
                        Text(subtitle).font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
                    }
                    if let tag {
                        Text(tag).font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: selected ? "record.circle.fill" : "circle")
                    .font(.system(size: 22))
                    .foregroundStyle(selected ? Theme.textPrimary : Theme.textTertiary)
            }
            .multilineTextAlignment(.leading)
            .padding(14)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
            .overlay {
                RoundedRectangle(cornerRadius: Theme.smallCornerRadius)
                    .strokeBorder(selected ? Theme.textPrimary : Theme.surfaceRaised, lineWidth: selected ? 2 : 1)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .opacity(isEnabled ? 1 : 0.5)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

private struct DaysStepper: View {
    @Binding var days: Int

    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 28) {
                round("Fewer days", "minus", enabled: days > NewProgramWizardRules.dayRange.lowerBound) { days -= 1 }
                Text("\(days)").font(AppFont.number(36)).frame(minWidth: 40)
                round("More days", "plus", enabled: days < NewProgramWizardRules.dayRange.upperBound) { days += 1 }
            }
            Text("times per week").font(AppFont.medium(15))
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 180)
    }

    private func round(_ label: String, _ icon: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(label, systemImage: icon, action: action)
            .labelStyle(.iconOnly)
            .font(AppFont.headline(20))
            .frame(width: 44, height: 44)
            .background(Theme.surfaceRaised, in: .circle)
            .buttonStyle(.plain)
            .disabled(!enabled)
            .opacity(enabled ? 1 : 0.4)
    }
}

private struct MuscleFocusList: View {
    @Binding var focus: [Muscle: Emphasis]

    var body: some View {
        group("Upper", NewProgramWizardRules.upperFocus)
        group("Lower", NewProgramWizardRules.lowerFocus)
    }

    private func group(_ title: String, _ muscles: [Muscle]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title).font(AppFont.headline()).padding(.vertical, 8)
            ForEach(muscles) { muscle in
                HStack(spacing: 14) {
                    MuscleTile(muscle: muscle).frame(width: 44, height: 50)
                    Text(muscle.displayName).font(AppFont.headline(15))
                    Spacer()
                    thumb(.less, muscle)
                    thumb(.more, muscle)
                }
                .padding(.vertical, 4)
                Divider().overlay(Theme.separator).padding(.leading, 58)
            }
        }
    }

    private func thumb(_ emphasis: Emphasis, _ muscle: Muscle) -> some View {
        let chosen = focus[muscle]
        let isOn = chosen == emphasis
        let label = emphasis == .more ? "Prioritize \(muscle.displayName)" : "Deprioritize \(muscle.displayName)"
        return Button(label, systemImage: emphasis == .more ? "hand.thumbsup.fill" : "hand.thumbsdown.fill") {
            focus = NewProgramWizardRules.toggling(emphasis, of: muscle, in: focus)
        }
        .labelStyle(.iconOnly)
        .font(.system(size: 15, weight: .semibold))
        .foregroundStyle(isOn ? Theme.background : Theme.textPrimary)
        .frame(width: 36, height: 36)
        .background(isOn ? Theme.textPrimary : Theme.surfaceRaised, in: .circle)
        .opacity(chosen != nil && !isOn ? 0.35 : 1)
        .buttonStyle(.plain)
        .accessibilityAddTraits(isOn ? .isSelected : [])
    }
}

private struct KeepSelections: View {
    @Binding var deload: Bool
    let profile: ProfileSettings
    @Binding var pickedNone: Bool
    @State private var editingExperience = false
    @State private var assessing = false

    var body: some View {
        card(icon: "cloud.fill") {
            Toggle("Deload", isOn: $deload).labelsHidden().tint(Theme.accent)
        } text: {
            Text("Deload").font(AppFont.headline(15))
            Text("This program's training block will end with a lighter week to promote recovery and readiness for the next phase")
                .font(AppFont.caption())
                .foregroundStyle(Theme.textSecondary)
            Text("Recommended").font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
        }
        card(icon: "chart.bar.fill") {
            pencil("Edit Lifting Experience") { editingExperience = true }
        } text: {
            Text("Lifting Experience").font(AppFont.headline(15))
            Text(ExperienceChoice(profile.liftingExperience, pickedNone: pickedNone).title)
                .font(AppFont.caption())
                .foregroundStyle(Theme.textSecondary)
        }
        card(icon: "checklist") {
            pencil("Edit Exercise Assessment") { assessing = true }
        } text: {
            Text("Exercise Assessment").font(AppFont.headline(15))
            Text(assessmentStatus).font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
        }
        .sheet(isPresented: $editingExperience) {
            ExperienceSheet(selected: ExperienceChoice(profile.liftingExperience, pickedNone: pickedNone)) { pickedNone = $0 == .none }
        }
        .sheet(isPresented: $assessing) {
            NavigationStack {
                ExerciseAssessmentView()
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Done", systemImage: "checkmark") { assessing = false }
                        }
                    }
            }
            .tint(Theme.textPrimary)
        }
    }

    private var assessmentStatus: String {
        let answered = AssessmentQuestion.all.filter { profile.assessment[$0.id] != nil }.count
        return answered == 0 ? "Not answered" : "\(answered) of \(AssessmentQuestion.all.count) answered"
    }

    private func card<Accessory: View, Body: View>(icon: String, @ViewBuilder accessory: () -> Accessory, @ViewBuilder text: () -> Body) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.background)
                    .frame(width: 30, height: 30)
                    .background(Theme.textPrimary, in: .circle)
                Spacer()
                accessory()
            }
            .padding(.bottom, 12)
            text()
        }
        .padding(14)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
        .overlay { RoundedRectangle(cornerRadius: Theme.smallCornerRadius).strokeBorder(Theme.surfaceRaised) }
    }

    private func pencil(_ label: String, action: @escaping () -> Void) -> some View {
        Button(label, systemImage: "pencil", action: action)
            .labelStyle(.iconOnly)
            .font(AppFont.headline(13))
            .frame(width: 30, height: 30)
            .background(Theme.surfaceRaised, in: .circle)
            .buttonStyle(.plain)
    }
}

extension ExperienceChoice {
    var title: String { rawValue.capitalized }

    var summary: String {
        switch self {
        case .none: "Currently not lifting"
        case .beginner: "Lifting for the past year or less"
        case .intermediate: "Lifting for more than the past year, but less than 4 years"
        case .advanced: "Lifting for the past 4 years or more"
        }
    }

    var bars: Double {
        switch self {
        case .none: 0
        case .beginner: 0.34
        case .intermediate: 0.67
        case .advanced: 1
        }
    }
}

/// The Lifting Experience sheet. Choosing a row writes `ProfileSettings.liftingExperience` and closes.
private struct ExperienceSheet: View {
    let selected: ExperienceChoice
    let onPick: (ExperienceChoice) -> Void
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List(ExperienceChoice.allCases) { choice in
                Button {
                    store.updateSettings { $0.profile.liftingExperience = choice.level }
                    onPick(choice)
                    dismiss()
                } label: {
                    HStack(spacing: 14) {
                        Image(systemName: "cellularbars", variableValue: choice.bars)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Theme.background)
                            .frame(width: 30, height: 30)
                            .background(Theme.textPrimary, in: .circle)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(choice.title).font(AppFont.headline(15))
                            Text(choice.summary).font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
                        }
                        Spacer()
                        Image(systemName: choice == selected ? "record.circle.fill" : "circle")
                            .font(.system(size: 22))
                            .foregroundStyle(choice == selected ? Theme.textPrimary : Theme.textTertiary)
                    }
                    .contentShape(Rectangle())
                }
                .foregroundStyle(Theme.textPrimary)
                .listRowBackground(Theme.surface)
                .accessibilityAddTraits(choice == selected ? .isSelected : [])
            }
            .scrollContentBackground(.hidden)
            .background(Theme.surface)
            .navigationTitle("Lifting Experience")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
        }
        .tint(Theme.textPrimary)
        .presentationDetents([.height(380)])
    }
}

private struct ColorPickerRow: View {
    @Binding var selection: ProgramColor
    let icon: String

    var body: some View {
        HStack {
            ForEach(ProgramColor.allCases, id: \.self) { color in
                Button(color.title, systemImage: icon) { selection = color }
                    .labelStyle(.iconOnly)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.background)
                    .frame(width: 34, height: 34)
                    .background(color.swatch, in: RoundedRectangle(cornerRadius: 8))
                    .overlay {
                        RoundedRectangle(cornerRadius: 10)
                            .strokeBorder(Theme.textPrimary, lineWidth: 2)
                            .padding(-4)
                            .opacity(selection == color ? 1 : 0)
                    }
                    .buttonStyle(.plain)
                    .frame(maxWidth: .infinity)
                    .accessibilityAddTraits(selection == color ? .isSelected : [])
            }
        }
        .padding(.vertical, 8)
    }
}

/// The generating checklist: ticks one item every quarter second while `work` runs, and hands its result to `done`
/// once both have finished, so the checklist always plays out.
private struct GeneratingChecklist: View {
    let work: () async -> GeneratedProgram
    let done: (GeneratedProgram) -> Void
    @State private var ticked = 0

    static let items = ["Experience", "Muscle prioritization", "Equipment availability", "Exercise selection", "Muscle strength focus", "Time efficiency", "Periodization", "Smart progression"]

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            ForEach(Self.items.indices, id: \.self) { index in
                HStack(spacing: 14) {
                    if index < ticked {
                        Image(systemName: "checkmark.circle.fill").foregroundStyle(Theme.green)
                    } else if index == ticked {
                        ProgressView().controlSize(.small)
                    } else {
                        Image(systemName: "circle").foregroundStyle(Theme.textTertiary)
                    }
                    Text(Self.items[index]).font(AppFont.medium(16))
                        .foregroundStyle(index <= ticked ? Theme.textPrimary : Theme.textTertiary)
                }
                .frame(height: 24)
            }
        }
        .padding(.top, 24)
        .task {
            let generation = Task { await work() }
            for _ in Self.items {
                try? await Task.sleep(for: .milliseconds(250))
                withAnimation { ticked += 1 }
            }
            done(await generation.value)
        }
    }
}
