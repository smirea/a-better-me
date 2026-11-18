import Foundation

/// Turns the exercise names in a file into ids with the rules of `docs/research/mf-workouts/tools/programs-json.py`:
/// a case-insensitive match on the name first, then on an alternative name when exactly one exercise carries it, then on
/// the same words in another order when exactly one exercise has them (MF's older "Chest-Supported Elbows-Out Dumbbell
/// Row" is "Chest-Supported Dumbbell Row (Elbows-Out)" today). A name that matches nothing becomes a new custom exercise
/// flagged in its description, created once per distinct name. `scripts/import-macrofactor-workouts.ts` uses the same rules.
struct ExerciseResolver {
    /// The flagged exercises this import created, for the caller to insert and list.
    private(set) var created: [Exercise] = []
    private var byName: [String: ExerciseID] = [:]
    private var byAlternativeName: [String: Set<ExerciseID>] = [:]
    private var byWords: [String: Set<ExerciseID>] = [:]

    /// `exercises` is the catalog with the owner's custom exercises, so a re-import reuses an earlier import's customs.
    init(exercises: [Exercise]) {
        // A custom exercise named like a catalog one loses to it, so a file always lands on MF's id.
        for exercise in exercises.sorted(by: { !$0.isCustom && $1.isCustom }) {
            let key = Self.key(exercise.name)
            if byName[key] == nil { byName[key] = exercise.id }
            for alternative in exercise.alternativeNames { byAlternativeName[Self.key(alternative), default: []].insert(exercise.id) }
            for name in [exercise.name] + exercise.alternativeNames { byWords[Self.words(name), default: []].insert(exercise.id) }
        }
    }

    mutating func id(for name: String) -> ExerciseID {
        let key = Self.key(name)
        if let id = byName[key] { return id }
        if let ids = byAlternativeName[key], ids.count == 1, let id = ids.first { return id }
        if let ids = byWords[Self.words(name)], ids.count == 1, let id = ids.first { return id }
        let exercise = Exercise(
            id: "custom-\(UUID().uuidString.lowercased())",
            name: name.trimmingCharacters(in: .whitespaces),
            type: .other,
            primaryMuscles: [],
            metrics: [.weight, .reps],
            about: "Imported from a file. **\(name.trimmingCharacters(in: .whitespaces))** matched no exercise in the catalog, so it was added as a custom exercise. Edit it to set its muscles and type, or replace it in your workouts."
        )
        created.append(exercise)
        byName[key] = exercise.id
        return exercise.id
    }

    private static func key(_ name: String) -> String { name.trimmingCharacters(in: .whitespaces).lowercased() }

    private static func words(_ name: String) -> String {
        name.lowercased().replacing(/[()]/, with: " ").split(whereSeparator: \.isWhitespace).sorted().joined(separator: " ")
    }
}
