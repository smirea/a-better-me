import Foundation

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

/// One way to load or set up an exercise: its name and the equipment it takes, like `Exercise.resistanceEquipment`
/// and `resistanceEquipmentIDs` at one index.
struct EquipmentOption: Hashable {
    var name: String
    var ids: [String]
}

extension ExerciseMetric {
    static let wizardOrder: [ExerciseMetric] = [
        .reps, .repsPerSide, .weight, .weightPerSide, .weightPerSidePersistent, .assistanceWeight,
        .duration, .durationPerSide, .distanceShort, .distanceShortPerSide, .distanceLong,
    ]
}
