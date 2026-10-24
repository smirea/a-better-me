import Foundation
@testable import App

/// The MF exports committed under `docs/research/mf-workouts/exports/`.
enum MFExports {
    static let directory = Calibration.root.appending(path: "docs/research/mf-workouts/exports")

    static let programs = files(prefix: "program-")
    static let workouts = files(prefix: "workout-")

    static func data(_ file: String) throws -> Data { try Data(contentsOf: directory.appending(path: file)) }

    /// The gym every export names, "Aquasol 6770", with a fixed id so imports compare.
    static let gym: GymProfile = {
        var gym = GymProfile(name: "Aquasol 6770")
        gym.id = UUID(uuidString: "00000000-0000-0000-0000-000000006770")!
        gym.isDefault = true
        return gym
    }()

    private static func files(prefix: String) -> [String] {
        let names = (try? FileManager.default.contentsOfDirectory(atPath: directory.path)) ?? []
        return names.filter { $0.hasPrefix(prefix) && $0.hasSuffix(".xlsx") }.sorted()
    }
}

/// An imported workout or program with every UUID replaced by its position, so two imports of the same file compare.
enum Normalized {
    struct Set: Hashable {
        var type: SetType
        var target: SetTarget?
        var rest: Int?
        var subTargets: [SetTarget?]
    }

    struct Exercise: Hashable {
        var id: ExerciseID
        var sets: [Set]
        var rest: Int?
        var note: String?
        var cycles: [[Set]]?
        var skips: [Bool]?
    }

    struct Template: Hashable {
        var name: String
        var notes: String
        var gymID: UUID?
        var inProgram: Bool
        var blocks: [[Exercise]]
    }

    struct Program: Hashable {
        var name: String
        var color: ProgramColor
        var icon: String
        var cycles: Int
        var deload: Deload
        var periodization: Bool
        /// Each day's template index, `nil` for a rest day.
        var days: [Int?]
        var templates: [Template]
    }

    static func sets(_ sets: [WorkoutSet]) -> [Set] {
        sets.map { Set(type: $0.type, target: $0.target, rest: $0.restSeconds, subTargets: $0.subSets.map(\.target)) }
    }

    static func template(_ template: WorkoutTemplate, programID: UUID? = nil) -> Template {
        Template(
            name: template.name,
            notes: template.notes,
            gymID: template.gymID,
            inProgram: programID != nil && template.programID == programID,
            blocks: template.blocks.map { block in
                block.exercises.map { exercise in
                    Exercise(
                        id: exercise.exerciseID,
                        sets: sets(exercise.sets),
                        rest: exercise.restSeconds,
                        note: exercise.note,
                        cycles: exercise.cycleTargets?.map { sets($0.sets) },
                        skips: exercise.cycleTargets?.map(\.skip)
                    )
                }
            }
        )
    }

    static func program(_ generated: GeneratedProgram) -> Program {
        let program = generated.program
        return Program(
            name: program.name,
            color: program.color,
            icon: program.icon,
            cycles: program.cycles,
            deload: program.config.deload,
            periodization: program.config.periodization,
            days: program.days.map { day in day.templateID.flatMap { id in generated.templates.firstIndex { $0.id == id } } },
            templates: generated.templates.map { template($0, programID: program.id) }
        )
    }
}

extension WorkoutTemplate {
    var exercises: [BlockExercise] { blocks.flatMap(\.exercises) }
}

extension GeneratedProgram {
    func template(_ name: String) -> WorkoutTemplate? { templates.first { $0.name == name } }

    /// "W" for a workout day, "R" for a rest day.
    var dayPattern: String { program.days.map { $0.templateID == nil ? "R" : "W" }.joined() }
}

extension WorkoutSet {
    /// "Standard 8-12 @2", "Failure 8+ @0", "Drop 8-8 @0 rest 0 (6-6 @0)": a set in one comparable line.
    var summary: String {
        func reps(_ target: SetTarget?) -> String {
            let min = target?.repsMin.map(String.init) ?? "?"
            return target?.repsMax.map { "\(min)-\($0)" } ?? "\(min)+"
        }
        func rir(_ target: SetTarget?) -> String { target?.rir.map { " @\($0)" } ?? "" }
        var line = "\(type.rawValue) \(reps(target))\(rir(target))"
        if let restSeconds { line += " rest \(restSeconds)" }
        if let duration = target?.durationSeconds { line += " for \(duration)s" }
        if !subSets.isEmpty { line += " (" + subSets.map { reps($0.target) + rir($0.target) }.joined(separator: ", ") + ")" }
        return line
    }
}

extension Worksheet {
    /// Each row's cell text, as `tools/xlsx.py` prints it: numbers with their decimal, blanks empty.
    var texts: [[String]] {
        rows.map { row in
            row.map { cell in
                switch cell.value {
                case .text(let text): text
                case .number(let number): "\(number)"
                case nil: ""
                }
            }
        }
    }
}
