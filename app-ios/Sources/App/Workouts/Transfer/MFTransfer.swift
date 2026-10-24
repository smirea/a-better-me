import Foundation

/// What the screens call: file bytes in and out. Pure, so it runs off the main actor and in tests.
enum MFTransfer {
    static func export(_ template: WorkoutTemplate, exercises: [Exercise], gyms: [GymProfile], at date: Date = .now) throws -> Data {
        let sheet = WorkoutSheet.worksheet(template, names: names(exercises), gymName: gymName(template.gymID, gyms: gyms))
        return try XLSX.data(of: sheet, created: date)
    }

    static func export(_ program: Program, templates: [WorkoutTemplate], exercises: [Exercise], gyms: [GymProfile], at date: Date = .now) throws -> Data {
        let sheet = ProgramSheet.worksheet(program, templates: templates, names: names(exercises)) { gymName($0, gyms: gyms) }
        return try XLSX.data(of: sheet, created: date)
    }

    static func importWorkout(_ data: Data, exercises: [Exercise], gyms: [GymProfile]) throws -> Imported<WorkoutTemplate> {
        let sheet = try sheet(MFFormat.workoutSheet, kind: .workout, in: data)
        var resolver = ExerciseResolver(exercises: exercises)
        let template = try WorkoutSheet.template(from: sheet, resolver: &resolver) { gymID($0, gyms: gyms) }
        return Imported(value: template, newExercises: resolver.created)
    }

    static func importProgram(_ data: Data, exercises: [Exercise], gyms: [GymProfile]) throws -> Imported<GeneratedProgram> {
        let sheet = try sheet(MFFormat.programSheet, kind: .program, in: data)
        var resolver = ExerciseResolver(exercises: exercises)
        let program = try ProgramSheet.program(from: sheet, resolver: &resolver) { gymID($0, gyms: gyms) }
        return Imported(value: program, newExercises: resolver.created)
    }

    private static func sheet(_ name: String, kind: TransferKind, in data: Data) throws -> Worksheet {
        let sheets = try XLSX.worksheets(in: data)
        if let sheet = sheets.first(where: { $0.name == name }) { return sheet }
        let other = kind == .workout ? MFFormat.programSheet : MFFormat.workoutSheet
        if sheets.contains(where: { $0.name == other }) { throw TransferError.wrongKind(expected: kind) }
        throw TransferError.missingSheet(name)
    }

    private static func names(_ exercises: [Exercise]) -> [ExerciseID: String] {
        Dictionary(exercises.map { ($0.id, $0.name) }) { first, _ in first }
    }

    /// The template's gym, else the default gym the way `GymProfile.defaultGym` picks it, else none.
    private static func gymName(_ id: UUID?, gyms: [GymProfile]) -> String? {
        if let id, let gym = gyms.first(where: { $0.id == id }) { return gym.name }
        return (gyms.filter(\.isDefault).max { $0.updatedAt < $1.updatedAt } ?? gyms.min { $0.createdAt < $1.createdAt })?.name
    }

    private static func gymID(_ name: String, gyms: [GymProfile]) -> UUID? {
        gyms.first { $0.name.caseInsensitiveCompare(name) == .orderedSame }?.id
    }
}

/// An import's result and the flagged custom exercises it had to create, which the caller inserts with it.
struct Imported<Value> {
    var value: Value
    var newExercises: [Exercise]
}
