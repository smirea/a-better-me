import SwiftUI

/// One way to load or set up an exercise: its name and the equipment it takes, like `Exercise.resistanceEquipment`
/// and `resistanceEquipmentIDs` at one index.
struct EquipmentOption: Hashable {
    var name: String
    var ids: [String]
}

/// What the owner fills in before a custom exercise exists. A fresh draft picks one resistance and at most one
/// support item; a duplicate starts with every option of its source and keeps them until the owner picks another.
struct CustomExerciseDraft {
    var name = ""
    var metrics: [ExerciseMetric?] = [nil, nil]
    var type = RestCategory.compoundUpper
    var laterality = Laterality.bilateral
    var muscles: [Muscle: MuscleRole] = [:]
    var resistance: [EquipmentOption] = []
    var support: [EquipmentOption] = []
    var category = ExerciseCategory.other
    /// 0 is unrated, MF's "None".
    var rangeOfMotion = 0
    var stability = 0
    var bodyWeightPercent: Double?
    var primaryJointActions: [String] = []
    var secondaryJointActions: [String] = []
    var alternativeNames = ""
    var about = ""
    /// What a duplicate keeps that the wizard has no field for: movement patterns, and the anatomical muscle names
    /// and body region while the muscles and type stay the source's.
    private var source: Exercise?

    enum MuscleRole { case primary, secondary }

    static let alternativeNamesLimit = 300

    init() {}

    /// Edit Duplicate. `instructions` is a catalog exercise's bundled Markdown, which becomes the copy's description.
    init(duplicating exercise: Exercise, instructions: String?) {
        name = "\(exercise.name) (Copy)"
        metrics = Array(exercise.metrics.prefix(2)) + Array(repeating: nil, count: max(0, 2 - exercise.metrics.count))
        type = exercise.restCategory
        laterality = exercise.laterality
        for muscle in exercise.secondaryMuscles { muscles[muscle] = .secondary }
        for muscle in exercise.primaryMuscles { muscles[muscle] = .primary }
        resistance = exercise.resistanceEquipment.enumerated().map { EquipmentOption(name: $1, ids: exercise.resistanceEquipmentIDs[safe: $0] ?? []) }
        support = exercise.supportEquipment.enumerated().map { EquipmentOption(name: $1, ids: exercise.supportEquipmentIDs[safe: $0] ?? []) }
        category = exercise.category
        rangeOfMotion = exercise.rangeOfMotion ?? 0
        stability = exercise.stability ?? 0
        bodyWeightPercent = (exercise.bodyweightFraction * 1000).rounded() / 10
        primaryJointActions = exercise.primaryJointActions
        secondaryJointActions = exercise.secondaryJointActions
        alternativeNames = String(exercise.alternativeNames.joined(separator: ", ").prefix(Self.alternativeNamesLimit))
        about = exercise.about ?? instructions ?? ""
        source = exercise
    }

    var trimmedName: String { name.trimmingCharacters(in: .whitespaces) }
    var isBuilt: Bool { !trimmedName.isEmpty && metrics.contains { $0 != nil } }
    var primaryMuscles: [Muscle] { Muscle.allCases.filter { muscles[$0] == .primary } }
    var secondaryMuscles: [Muscle] { Muscle.allCases.filter { muscles[$0] == .secondary } }
    var hasFinalDetails: Bool { bodyWeightPercent.map { (0...100).contains($0) } ?? false }

    mutating func cycle(_ muscle: Muscle) {
        muscles[muscle] = switch muscles[muscle] {
        case nil: .primary
        case .primary: .secondary
        case .secondary: nil
        }
    }

    func exercise() -> Exercise {
        let keepsMuscles = source.map { Set($0.primaryMuscles) == Set(primaryMuscles) && Set($0.secondaryMuscles) == Set(secondaryMuscles) } ?? false
        let (type, region): (ExerciseType, BodyRegion?) = if let source, source.restCategory == self.type {
            (source.type, source.region)
        } else {
            switch self.type {
            case .compoundUpper: (.compound, .upper)
            case .compoundLower: (.compound, .lower)
            case .upperIsolation: (.isolation, .upper)
            case .lowerIsolation: (.isolation, .lower)
            case .core: (.core, .core)
            }
        }
        var equipmentIDs: [String] = []
        for id in (resistance + support).flatMap(\.ids) where !equipmentIDs.contains(id) { equipmentIDs.append(id) }
        let about = about.trimmingCharacters(in: .whitespacesAndNewlines)
        return Exercise(
            id: "custom-\(UUID().uuidString.lowercased())",
            name: trimmedName,
            alternativeNames: alternativeNames.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty },
            type: type,
            primaryMuscles: primaryMuscles,
            secondaryMuscles: secondaryMuscles,
            primaryMuscleDetails: keepsMuscles ? source?.primaryMuscleDetails ?? [] : [],
            secondaryMuscleDetails: keepsMuscles ? source?.secondaryMuscleDetails ?? [] : [],
            movementPatterns: source?.movementPatterns ?? [],
            region: region,
            laterality: laterality,
            metrics: Array(Set(metrics.compactMap { $0 })).sorted { ExerciseMetric.wizardOrder.firstIndex(of: $0)! < ExerciseMetric.wizardOrder.firstIndex(of: $1)! },
            resistanceEquipment: resistance.map(\.name),
            supportEquipment: support.map(\.name),
            resistanceEquipmentIDs: resistance.map(\.ids),
            supportEquipmentIDs: support.map(\.ids),
            equipmentIDs: equipmentIDs,
            category: category,
            rangeOfMotion: rangeOfMotion == 0 ? nil : rangeOfMotion,
            stability: stability == 0 ? nil : stability,
            primaryJointActions: primaryJointActions,
            secondaryJointActions: secondaryJointActions,
            bodyweightFraction: (bodyWeightPercent ?? 0) / 100,
            about: about.isEmpty ? nil : about
        )
    }
}

/// Create Custom Exercise: Build your exercise, Select muscles, Select equipment, Final details, and the review. It
/// saves a new `CustomExercise`, also when `draft` duplicates an existing exercise; `onCreateAndAdd` adds the
/// "Create & Add" button for the picker.
struct CustomExerciseWizard: View {
    var onCreateAndAdd: ((ExerciseID) -> Void)?
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var draft: CustomExerciseDraft
    @State private var path: [Step] = []

    init(draft: CustomExerciseDraft = CustomExerciseDraft(), onCreateAndAdd: ((ExerciseID) -> Void)? = nil) {
        self.onCreateAndAdd = onCreateAndAdd
        _draft = State(initialValue: draft)
    }

    enum Step: Int, CaseIterable { case build, muscles, equipment, finalDetails, review }

    var body: some View {
        NavigationStack(path: $path) {
            step(.build)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Close", systemImage: "xmark") { dismiss() }
                    }
                }
                .navigationDestination(for: Step.self) { step($0) }
        }
    }

    private func step(_ step: Step) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text(title(step)).font(AppFont.title(24))
                switch step {
                case .build: BuildStep(draft: $draft)
                case .muscles: MuscleStep(draft: $draft)
                case .equipment: EquipmentStep(draft: $draft)
                case .finalDetails: FinalDetailsStep(draft: $draft)
                case .review: ReviewStep(draft: draft)
                }
            }
            .padding()
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Theme.background)
        .detailTitle("Create Custom Exercise")
        .safeAreaBar(edge: .top) {
            ProgressView(value: Double(step.rawValue + 1), total: Double(Step.allCases.count))
                .padding(.horizontal)
        }
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 10) {
                if step == .review {
                    if let onCreateAndAdd {
                        Button("Create & Add") { onCreateAndAdd(create()) }.secondaryPill()
                    }
                    Button("Create") { _ = create() }.primaryPill()
                } else {
                    Button("Next") { path.append(Step(rawValue: step.rawValue + 1)!) }
                        .primaryPill()
                        .disabled(!canAdvance(step))
                }
            }
            .padding(.horizontal)
        }
    }

    private func title(_ step: Step) -> String {
        switch step {
        case .build: "Build your exercise"
        case .muscles: "Select muscles"
        case .equipment: "Select equipment"
        case .finalDetails: "Final details"
        case .review: "Does everything look correct?"
        }
    }

    private func canAdvance(_ step: Step) -> Bool {
        switch step {
        case .build: draft.isBuilt
        case .muscles: !draft.primaryMuscles.isEmpty
        case .equipment: !draft.resistance.isEmpty
        case .finalDetails: draft.hasFinalDetails
        case .review: true
        }
    }

    private func create() -> ExerciseID {
        let exercise = draft.exercise()
        store.insert(CustomExercise(exercise))
        dismiss()
        return exercise.id
    }
}

private struct FieldLabel: View {
    let title: String
    var trailing: String?

    var body: some View {
        HStack {
            Text(title).font(AppFont.medium(14))
            Spacer()
            if let trailing { Text(trailing).font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary) }
        }
    }
}

private struct DropdownLabel: View {
    let text: String

    var body: some View {
        HStack {
            Text(text).font(AppFont.body(15)).foregroundStyle(Theme.textPrimary).lineLimit(1)
            Spacer()
            Image(systemName: "chevron.down").imageScale(.small).foregroundStyle(Theme.textSecondary)
        }
        .padding(.horizontal, 12)
        .frame(height: 44)
        .background(Theme.surfaceRaised, in: .rect(cornerRadius: Theme.smallCornerRadius))
    }
}

private struct BuildStep: View {
    @Binding var draft: CustomExerciseDraft

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            FieldLabel(title: "Exercise Name", trailing: "Required")
            TextField("Enter exercise name", text: $draft.name)
                .padding(.horizontal, 12)
                .frame(height: 44)
                .background(Theme.surfaceRaised, in: .rect(cornerRadius: Theme.smallCornerRadius))
                .accessibilityIdentifier("custom-name")
            FieldLabel(title: "Trackable Metric", trailing: "Required").padding(.top, 12)
            HStack(spacing: 8) {
                ForEach(draft.metrics.indices, id: \.self) { slot in
                    DescribedMenu(
                        options: [nil] + ExerciseMetric.wizardOrder,
                        selection: $draft.metrics[slot],
                        title: { $0?.displayName ?? "None" },
                        summary: { $0?.summary }
                    )
                    .accessibilityLabel("Trackable Metric \(slot + 1)")
                }
            }
            FieldLabel(title: "Type").padding(.top, 12)
            Menu {
                Picker("Type", selection: $draft.type) {
                    ForEach(RestCategory.allCases) { Text($0.displayName).tag($0) }
                }
            } label: {
                DropdownLabel(text: draft.type.displayName)
            }
            FieldLabel(title: "Laterality").padding(.top, 12)
            DescribedMenu(
                options: Laterality.allCases,
                selection: $draft.laterality,
                title: \.displayName,
                summary: \.summary
            )
        }
    }
}

private struct DescribedMenu<Option: Hashable>: View {
    let options: [Option]
    @Binding var selection: Option
    let title: (Option) -> String
    let summary: (Option) -> String?

    var body: some View {
        Menu {
            ForEach(options, id: \.self) { option in
                Button { selection = option } label: {
                    if option == selection { Image(systemName: "checkmark") }
                    Text(title(option))
                    if let summary = summary(option) { Text(summary) }
                }
            }
        } label: {
            DropdownLabel(text: title(selection))
        }
    }
}

private struct MuscleStep: View {
    @Binding var draft: CustomExerciseDraft

    private static let upper = MuscleFilterRow.order.filter { !$0.isLowerBody }
    private static let lower = MuscleFilterRow.order.filter(\.isLowerBody)

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            grid("Upper", Self.upper)
            grid("Lower", Self.lower)
            HStack {
                Text("\(draft.primaryMuscles.count) primary, \(draft.secondaryMuscles.count) secondary")
                Spacer()
                Button("Reset") { draft.muscles = [:] }.underline().disabled(draft.muscles.isEmpty)
            }
            .font(AppFont.medium(14))
            .foregroundStyle(Theme.textPrimary)
        }
    }

    private func grid(_ title: String, _ muscles: [Muscle]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(AppFont.headline(16))
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 14) {
                ForEach(muscles) { muscle in
                    let role = draft.muscles[muscle]
                    Button { draft.cycle(muscle) } label: {
                        VStack(spacing: 6) {
                            MuscleTile(muscle: muscle)
                                .frame(width: 72, height: 72)
                                .clipShape(.rect(cornerRadius: Theme.smallCornerRadius))
                                .overlay {
                                    RoundedRectangle(cornerRadius: Theme.smallCornerRadius)
                                        .strokeBorder(role == nil ? Theme.surfaceRaised : Theme.textPrimary, lineWidth: role == nil ? 1 : 2)
                                }
                                .overlay(alignment: .bottomTrailing) {
                                    if let role {
                                        Text(role == .primary ? "P" : "S")
                                            .font(AppFont.headline(11))
                                            .foregroundStyle(Theme.onPrimary)
                                            .frame(width: 18, height: 18)
                                            .background(Theme.textPrimary, in: .circle)
                                            .offset(x: 4, y: 4)
                                    }
                                }
                            Text(muscle.displayName).font(AppFont.caption(12)).foregroundStyle(Theme.textPrimary)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(muscle.displayName)
                    .accessibilityValue(role == .primary ? "Primary" : role == .secondary ? "Secondary" : "None")
                }
            }
        }
    }
}

private struct EquipmentStep: View {
    @Binding var draft: CustomExerciseDraft
    @Environment(ExerciseCatalog.self) private var catalog
    @State private var picking: EquipmentRole?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            section(.resistance, options: draft.resistance)
            Divider().overlay(Theme.separator)
            section(.support, options: draft.support)
        }
        .sheet(item: $picking) { role in
            EquipmentPickerSheet(
                title: role.title,
                equipmentIDs: Set(catalog.bundled.flatMap { (role == .resistance ? $0.resistanceEquipmentIDs : $0.supportEquipmentIDs).joined() }),
                selection: Binding {
                    let options = role == .resistance ? draft.resistance : draft.support
                    guard options.count == 1, let id = options[0].ids.first, options[0].ids.count == 1 else { return nil }
                    return EquipmentChoice(id: id, matching: [id])
                } set: { choice in
                    let equipment = choice.flatMap { catalog.equipment[$0.id] }
                    let options = equipment.map { [EquipmentOption(name: $0.name, ids: [$0.id])] } ?? []
                    switch role {
                    case .resistance:
                        draft.resistance = options
                        if let equipment { draft.category = ExerciseCategory(equipmentCategory: equipment.category) }
                    case .support:
                        draft.support = options
                    }
                }
            )
        }
    }

    private func section(_ role: EquipmentRole, options: [EquipmentOption]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(role.title).font(AppFont.medium(15))
                    Text(role.summary).font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
                    Text(role == .resistance ? "Required" : "Optional").font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                Button(options.isEmpty ? "Add" : "Change") { picking = role }
                    .buttonStyle(.bordered)
                    .buttonBorderShape(.capsule)
                    .accessibilityLabel(options.isEmpty ? "Add \(role.title)" : "Change \(role.title)")
            }
            EquipmentOptions(title: "", names: options.map(\.name), ids: options.map(\.ids))
        }
    }

    enum EquipmentRole: Identifiable {
        case resistance, support

        var id: Self { self }
        var title: String { self == .resistance ? "Resistance" : "Support" }
        var summary: String {
            switch self {
            case .resistance: "Equipment that adds load to the exercise"
            case .support: "Equipment that assists, stabilizes, or makes the movement possible, without adding resistance"
            }
        }
    }
}

private struct FinalDetailsStep: View {
    @Binding var draft: CustomExerciseDraft
    @Observe(BodyWeight.all) private var weighIns
    @Observe(AppSettings.current) private var settings
    @State private var percentText: String
    @State private var choosing: JointActionRole?
    @State private var editingDescription = false
    @FocusState private var editingPercent: Bool

    init(draft: Binding<CustomExerciseDraft>) {
        _draft = draft
        _percentText = State(initialValue: draft.wrappedValue.bodyWeightPercent.map { $0.formatted(.number.precision(.fractionLength(0...1))) } ?? "")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            rating("Range of Motion", value: $draft.rangeOfMotion)
            rating("Stability", value: $draft.stability).padding(.bottom, 12)
            FieldLabel(title: "Body Weight Contribution", trailing: "Required")
            HStack {
                TextField("", text: $percentText)
                    .keyboardType(.decimalPad)
                    .focused($editingPercent)
                    .accessibilityLabel("Body Weight Contribution")
                Text("%").foregroundStyle(Theme.textSecondary)
            }
            .padding(.horizontal, 12)
            .frame(height: 44)
            .background(Theme.surfaceRaised, in: .rect(cornerRadius: Theme.smallCornerRadius))
            .onChange(of: percentText) { _, text in
                draft.bodyWeightPercent = text.isEmpty ? nil : try? Double(text, format: .number)
            }
            Text(contributionLine).font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
            ForEach(JointActionRole.allCases) { role in
                FieldLabel(title: role.title).padding(.top, 12)
                Button { choosing = role } label: {
                    DropdownLabel(text: draft[keyPath: role.path].joined(separator: ", "))
                }
                .accessibilityLabel(role.title)
            }
            FieldLabel(title: "Alternate Names", trailing: "\(draft.alternativeNames.count)/\(CustomExerciseDraft.alternativeNamesLimit)")
                .padding(.top, 12)
            TextField("Optionally add other names", text: $draft.alternativeNames, axis: .vertical)
                .lineLimit(3...6)
                .padding(12)
                .background(Theme.surfaceRaised, in: .rect(cornerRadius: Theme.smallCornerRadius))
                .onChange(of: draft.alternativeNames) { _, text in
                    if text.count > CustomExerciseDraft.alternativeNamesLimit {
                        draft.alternativeNames = String(text.prefix(CustomExerciseDraft.alternativeNamesLimit))
                    }
                }
            Text("Separate names with a comma").font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Description").font(AppFont.medium(15))
                    Text(draft.about.isEmpty ? "Empty" : draft.about)
                        .font(AppFont.caption(12))
                        .foregroundStyle(Theme.textSecondary)
                        .lineLimit(3)
                }
                Spacer()
                Button("Edit") { editingDescription = true }
                    .buttonStyle(.bordered)
                    .buttonBorderShape(.capsule)
                    .accessibilityLabel("Edit Description")
            }
            .padding(.top, 16)
        }
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                if editingPercent {
                    Spacer()
                    Button("Done") { editingPercent = false }
                }
            }
        }
        .sheet(item: $choosing) { role in
            JointActionPicker(title: role.title, selection: Binding {
                draft[keyPath: role.path]
            } set: {
                draft[keyPath: role.path] = $0
            })
        }
        .sheet(isPresented: $editingDescription) {
            DescriptionEditor(text: $draft.about)
        }
    }

    private func rating(_ title: String, value: Binding<Int>) -> some View {
        Stepper(value: value, in: 0...5) {
            VStack(alignment: .leading, spacing: 6) {
                Text(title).font(AppFont.rowTitle)
                RatingBar(value: value.wrappedValue)
            }
        }
        .padding(.vertical, 6)
    }

    /// "18 lb at your current weight", from the newest weigh-in or the profile's weight.
    private var contributionLine: String {
        guard let percent = draft.bodyWeightPercent else { return "Enter the share of body weight the exercise moves" }
        guard (0...100).contains(percent) else { return "Enter a percentage from 0 to 100" }
        let unit = settings.weightUnit
        guard let bodyKg = currentBodyWeightKg(logged: weighIns, health: nil, manual: settings.profile.bodyWeightKg) else {
            return "Log your body weight to see the load this adds"
        }
        return "\(unit.label(kg: bodyKg * percent / 100)) at your current weight"
    }

    enum JointActionRole: CaseIterable, Identifiable {
        case primary, secondary

        var id: Self { self }
        var title: String { self == .primary ? "Primary Joint Action" : "Secondary Joint Action" }
        var path: WritableKeyPath<CustomExerciseDraft, [String]> {
            self == .primary ? \.primaryJointActions : \.secondaryJointActions
        }
    }
}

/// "Choose all that apply" over every joint action the catalog names.
private struct JointActionPicker: View {
    let title: String
    @Binding var selection: [String]
    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    var body: some View {
        let vocabulary = Set(catalog.bundled.flatMap { $0.primaryJointActions + $0.secondaryJointActions }).sorted()
        NavigationStack {
            List {
                Section {
                    ForEach(vocabulary.filter { query.isEmpty || $0.localizedStandardContains(query) }, id: \.self) { action in
                        let isSelected = selection.contains(action)
                        Button {
                            if isSelected { selection.removeAll { $0 == action } } else { selection = (selection + [action]).sorted() }
                        } label: {
                            HStack {
                                Text(action).font(AppFont.body(15)).foregroundStyle(Theme.textPrimary)
                                Spacer()
                                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(isSelected ? Theme.textPrimary : Theme.textTertiary)
                            }
                        }
                        .accessibilityAddTraits(isSelected ? .isSelected : [])
                        .listRowBackground(Theme.surface)
                    }
                } header: {
                    Text("Choose all that apply").font(AppFont.caption(12)).textCase(nil)
                }
            }
            .themedList()
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search joint actions")
            .detailTitle(title)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

private struct DescriptionEditor: View {
    @Binding var text: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            TextEditor(text: $text)
                .font(AppFont.body(15))
                .scrollContentBackground(.hidden)
                .padding(12)
                .background(Theme.surfaceRaised, in: .rect(cornerRadius: Theme.smallCornerRadius))
                .padding()
                .frame(maxHeight: .infinity, alignment: .top)
                .background(Theme.background)
                .accessibilityLabel("Description")
                .detailTitle("Description")
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { dismiss() }
                    }
                }
        }
    }
}

private struct ReviewStep: View {
    let draft: CustomExerciseDraft

    var body: some View {
        let exercise = draft.exercise()
        VStack(alignment: .leading, spacing: 16) {
            Label {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Fields can't be edited later").font(AppFont.headline(14))
                    Text("Check them before you create the exercise.").font(AppFont.caption(13))
                }
            } icon: {
                Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(Theme.rir(2))
            }
            .foregroundStyle(Theme.textPrimary)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surfaceRaised, in: .rect(cornerRadius: Theme.smallCornerRadius))
            summary("Exercise Name", exercise.name)
            summary("Trackable Metric", exercise.metricsLine)
            summary("Type", draft.type.displayName)
            summary("Laterality", exercise.laterality.displayName)
            SectionTitle("Target Muscles")
            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    ForEach(exercise.primaryMuscles) { MuscleTileCard(muscle: $0, details: ["Primary"]) }
                    ForEach(exercise.secondaryMuscles) { MuscleTileCard(muscle: $0, details: ["Secondary"]) }
                }
            }
            .scrollIndicators(.hidden)
            rating("Range of Motion", exercise.rangeOfMotion)
            rating("Stability", exercise.stability)
            EquipmentOptions(title: "Resistance Equipment", names: exercise.resistanceEquipment, ids: exercise.resistanceEquipmentIDs)
            EquipmentOptions(title: "Support Equipment", names: exercise.supportEquipment, ids: exercise.supportEquipmentIDs)
            summary("Body Weight Contribution", exercise.bodyweightFraction.formatted(.percent.precision(.fractionLength(0...1))))
            if !exercise.primaryJointActions.isEmpty {
                summary("Primary Joint Action", exercise.primaryJointActions.joined(separator: ", "))
            }
            if !exercise.secondaryJointActions.isEmpty {
                summary("Secondary Joint Action", exercise.secondaryJointActions.joined(separator: ", "))
            }
            if !exercise.alternativeNames.isEmpty {
                summary("Alternate Names", exercise.alternativeNames.joined(separator: ", "))
            }
            if let about = exercise.about {
                summary("Description", about)
            }
        }
    }

    private func rating(_ title: String, _ value: Int?) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(AppFont.medium(14))
                Text(value.map { "\($0)/5" } ?? "None").font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
            }
            Spacer()
            RatingBar(value: value ?? 0)
        }
    }

    private func summary(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(AppFont.medium(14))
            Text(value)
                .font(AppFont.body(15))
                .lineLimit(6)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                .overlay { RoundedRectangle(cornerRadius: Theme.smallCornerRadius).strokeBorder(Theme.surfaceRaised) }
        }
    }
}
