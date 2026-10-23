import Foundation

/// MF Workouts' exercise ID for catalog exercises, `custom-<uuid>` for the owner's own.
typealias ExerciseID = String

struct Exercise: Codable, Hashable, Identifiable {
    let id: ExerciseID
    var name: String
    var primaryMuscles: [Muscle]
    var secondaryMuscles: [Muscle]
    var equipment: [String]
    var kind: ExerciseKind
    /// Markdown with "Setting up", "Exercise technique", and "Description" sections.
    var instructions: String?
    /// Bundle resource names of the start and end position frames, without extension.
    var images: [String]
    var isCustom: Bool { id.hasPrefix("custom-") }
}

/// What a set of this exercise records. Drives which columns the set row shows.
enum ExerciseKind: String, Codable, CaseIterable {
    case weightReps
    case bodyweightReps
    case assistedBodyweight
    case duration
    case distance

    var tracksWeight: Bool { self == .weightReps || self == .bodyweightReps || self == .assistedBodyweight }
    var tracksReps: Bool { self != .duration && self != .distance }
}

/// The 22 muscle groups MF Workouts draws on its body diagrams (`assets/muscle_groups/*/<rawValue>.svg`).
enum Muscle: String, Codable, CaseIterable, Identifiable {
    case chest, frontDelts = "front_delts", sideDelts = "side_delts", rearDelts = "rear_delts"
    case lats, upperBack = "upper_back", upperTraps = "upper_traps", lowerBack = "lower_back", neck
    case biceps, triceps, forearms
    case abs, obliques, serratus
    case glutes, quads, hamstrings, adductors, abductors, calves, tibs

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .frontDelts: "Front Delts"
        case .sideDelts: "Side Delts"
        case .rearDelts: "Rear Delts"
        case .upperBack: "Upper Back"
        case .upperTraps: "Upper Traps"
        case .lowerBack: "Lower Back"
        case .tibs: "Tibialis"
        default: rawValue.capitalized
        }
    }
}
