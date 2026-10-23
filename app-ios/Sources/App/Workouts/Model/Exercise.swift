import Foundation

/// MF Workouts' exercise ID for catalog exercises, `custom-<uuid>` for the owner's own.
typealias ExerciseID = String

/// Field names and values mirror `scripts/catalog.ts`, which generates them from the reference app's own export.
struct Exercise: Codable, Hashable, Identifiable {
    let id: ExerciseID
    var name: String
    var alternativeNames: [String] = []
    var type: ExerciseType
    var primaryMuscles: [Muscle]
    var secondaryMuscles: [Muscle] = []
    /// Anatomical names such as "Deltoid Anterior Head".
    var primaryMuscleDetails: [String] = []
    var secondaryMuscleDetails: [String] = []
    var movementPatterns: [String] = []
    var laterality: Laterality = .bilateral
    /// What each set records, in display order.
    var metrics: [ExerciseMetric]
    /// Alternative ways to load the exercise, e.g. "Barbell and weight plates".
    var resistanceEquipment: [String] = []
    /// Alternative setups, e.g. "Flat bench and power rack".
    var supportEquipment: [String] = []
    var equipmentIDs: [String] = []
    /// Share of body weight moved, which MF adds to the logged load for bodyweight exercises.
    var bodyweightFraction: Double = 0
    var searchBoost: Int = 0
    /// Instructions live in `Instructions/<id>.md`, loaded on demand through `ExerciseCatalog.instructions(for:)`.
    var hasInstructions = false
    var articleIDs: [String] = []
    /// Bundle resource names of the video's poster frames (start and end positions), without extension.
    var images: [String] = []

    var isCustom: Bool { id.hasPrefix("custom-") }
    var tracksWeight: Bool { metrics.contains { $0.isWeight } }
    var tracksReps: Bool { metrics.contains { $0 == .reps || $0 == .repsPerSide } }
}

enum ExerciseType: String, Codable, CaseIterable {
    case compound, isolation, core, other
}

enum Laterality: String, Codable, CaseIterable {
    case bilateral, unilateral, asymmetrical
}

enum ExerciseMetric: String, Codable, CaseIterable {
    case weight, assistanceWeight, weightPerSide, weightPerSidePersistent
    case reps, repsPerSide
    case duration, durationPerSide
    case distanceShort, distanceShortPerSide, distanceLong

    var isWeight: Bool {
        self == .weight || self == .assistanceWeight || self == .weightPerSide || self == .weightPerSidePersistent
    }

    var isPerSide: Bool { rawValue.contains("PerSide") }
}

/// MF Workouts' 23 feature muscle groups. All but hip flexors have body-diagram art in the reference app.
enum Muscle: String, Codable, CaseIterable, Identifiable {
    case chest, frontDelts = "front_delts", sideDelts = "side_delts", rearDelts = "rear_delts"
    case lats, upperBack = "upper_back", upperTraps = "upper_traps", lowerBack = "lower_back", neck
    case biceps, triceps, forearms
    case abs, obliques, serratus
    case glutes, quads, hamstrings, adductors, abductors, hipFlexors = "hip_flexors", calves, tibs

    var id: String { rawValue }

    var displayName: String {
        rawValue.split(separator: "_").map(\.capitalized).joined(separator: " ")
    }
}

struct Equipment: Codable, Hashable, Identifiable {
    let id: String
    var name: String
    /// "Free Weights", "Cable Machines", and the other equipment filter groups.
    var category: String
    var weightKg: Double?
    var incrementKg: Double?
    var hasImage: Bool
}

/// The reference app's long-form exercise notes, such as "Flat versus incline variations for chest development".
struct Article: Codable, Hashable, Identifiable {
    let id: String
    var title: String
}
