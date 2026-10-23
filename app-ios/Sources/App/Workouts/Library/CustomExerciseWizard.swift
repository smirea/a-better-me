import SwiftData
import SwiftUI

/// What the owner fills in before a custom exercise exists. MF's Final details step (range of motion, stability,
/// body weight contribution, joint actions, description) and support equipment are cut: nothing in milestone 1 reads them.
struct CustomExerciseDraft {
    var name = ""
    var metrics: [ExerciseMetric?] = [nil, nil]
    var type = RestCategory.compoundUpper
    var laterality = Laterality.bilateral
    var muscles: [Muscle: MuscleRole] = [:]
    var resistance: Equipment?
    var alternativeNames = ""

    enum MuscleRole { case primary, secondary }

    static let alternativeNamesLimit = 300

    var trimmedName: String { name.trimmingCharacters(in: .whitespaces) }
    var isBuilt: Bool { !trimmedName.isEmpty && metrics.contains { $0 != nil } }
    var primaryMuscles: [Muscle] { Muscle.allCases.filter { muscles[$0] == .primary } }
    var secondaryMuscles: [Muscle] { Muscle.allCases.filter { muscles[$0] == .secondary } }

    mutating func cycle(_ muscle: Muscle) {
        muscles[muscle] = switch muscles[muscle] {
        case nil: .primary
        case .primary: .secondary
        case .secondary: nil
        }
    }

    func exercise() -> Exercise {
        let (type, region): (ExerciseType, BodyRegion) = switch self.type {
        case .compoundUpper: (.compound, .upper)
        case .compoundLower: (.compound, .lower)
        case .upperIsolation: (.isolation, .upper)
        case .lowerIsolation: (.isolation, .lower)
        case .core: (.core, .core)
        }
        return Exercise(
            id: "custom-\(UUID().uuidString.lowercased())",
            name: trimmedName,
            alternativeNames: alternativeNames.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty },
            type: type,
            primaryMuscles: primaryMuscles,
            secondaryMuscles: secondaryMuscles,
            region: region,
            laterality: laterality,
            metrics: Array(Set(metrics.compactMap { $0 })).sorted { ExerciseMetric.wizardOrder.firstIndex(of: $0)! < ExerciseMetric.wizardOrder.firstIndex(of: $1)! },
            resistanceEquipment: resistance.map { [$0.name] } ?? [],
            resistanceEquipmentIDs: resistance.map { [[$0.id]] } ?? [],
            equipmentIDs: resistance.map { [$0.id] } ?? [],
            category: resistance.map { ExerciseCategory(equipmentCategory: $0.category) } ?? .other
        )
    }
}

/// Create Custom Exercise: Build your exercise, Select muscles, Select equipment, and the review. It saves a
/// `CustomExercise`; `onCreateAndAdd` adds the "Create & Add" button for the picker.
struct CustomExerciseWizard: View {
    var onCreateAndAdd: ((ExerciseID) -> Void)?
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var draft = CustomExerciseDraft()
    @State private var path: [Step] = []

    enum Step: Int, CaseIterable { case build, muscles, equipment, review }

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
        .tint(Theme.textPrimary)
    }

    private func step(_ step: Step) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text(title(step)).font(AppFont.title(24))
                switch step {
                case .build: BuildStep(draft: $draft)
                case .muscles: MuscleStep(draft: $draft)
                case .equipment: EquipmentStep(draft: $draft)
                case .review: ReviewStep(draft: draft)
                }
            }
            .padding()
        }
        .background(Theme.background)
        .navigationTitle("Create Custom Exercise")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaBar(edge: .top) {
            ProgressView(value: Double(step.rawValue + 1), total: Double(Step.allCases.count))
                .tint(Theme.textPrimary)
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
        case .review: "Does everything look correct?"
        }
    }

    private func canAdvance(_ step: Step) -> Bool {
        switch step {
        case .build: draft.isBuilt
        case .muscles: !draft.primaryMuscles.isEmpty
        case .equipment: draft.resistance != nil
        case .review: true
        }
    }

    private func create() -> ExerciseID {
        let exercise = draft.exercise()
        context.insert(CustomExercise(exercise))
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
                                            .foregroundStyle(Color.black)
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
    @State private var picking = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Resistance").font(AppFont.medium(15))
                    Text("Equipment that adds load to the exercise").font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
                    Text("Required").font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                Button(draft.resistance == nil ? "Add" : "Change") { picking = true }
                    .buttonStyle(.bordered)
                    .buttonBorderShape(.capsule)
                    .tint(Theme.textPrimary)
            }
            if let resistance = draft.resistance {
                EquipmentOptions(title: "", names: [resistance.name], ids: [[resistance.id]])
            }
            Divider().overlay(Theme.separator)
            HStack {
                FieldLabel(title: "Alternate Names", trailing: "\(draft.alternativeNames.count)/\(CustomExerciseDraft.alternativeNamesLimit)")
            }
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
        }
        .sheet(isPresented: $picking) {
            EquipmentPickerSheet(
                title: "Resistance",
                equipmentIDs: Set(catalog.bundled.flatMap { $0.resistanceEquipmentIDs.joined() }),
                selection: Binding {
                    draft.resistance.map { EquipmentChoice(id: $0.id, matching: [$0.id]) }
                } set: {
                    draft.resistance = $0.flatMap { catalog.equipment[$0.id] }
                }
            )
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
                    ForEach(exercise.primaryMuscles) { TargetMuscleCard(muscle: $0, role: "Primary") }
                    ForEach(exercise.secondaryMuscles) { TargetMuscleCard(muscle: $0, role: "Secondary") }
                }
            }
            .scrollIndicators(.hidden)
            EquipmentOptions(title: "Resistance Equipment", names: exercise.resistanceEquipment, ids: exercise.resistanceEquipmentIDs)
            if !exercise.alternativeNames.isEmpty {
                summary("Alternate Names", exercise.alternativeNames.joined(separator: ", "))
            }
        }
    }

    private func summary(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(AppFont.medium(14))
            Text(value)
                .font(AppFont.body(15))
                .padding(.horizontal, 12)
                .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                .overlay { RoundedRectangle(cornerRadius: Theme.smallCornerRadius).strokeBorder(Theme.surfaceRaised) }
        }
    }
}
