import Foundation
import Testing
@testable import App

/// Name resolution, cells MF's sample files never show (several drops, durations, skips, notes), and the errors.
@MainActor
struct TransferCodecTests {
    static let catalog = ExerciseCatalog().all
    static let gyms = [MFExports.gym]
    static let floorPress = "1a05c6f170d8802a950df7b6c710ffb4"
    static let legExtension = "1a25c6f170d880c59f17ce7802758fc3"
    static let backSquat = "1a25c6f170d8803d8231d083fdd65458"

    static func set(_ min: Int?, _ max: Int?, type: SetType = .standard, rir: Int? = nil, rest: Int? = nil, duration: Int? = nil) -> WorkoutSet {
        WorkoutSet(type: type, target: SetTarget(repsMin: min, repsMax: max, rir: rir, durationSeconds: duration), restSeconds: rest)
    }

    static func sheet(_ data: Data) throws -> Worksheet { try #require(try XLSX.worksheets(in: data).first) }

    @Test func resolverPrefersNamesThenUniqueAlternativeNames() {
        var resolver = ExerciseResolver(exercises: Self.catalog)
        #expect(resolver.id(for: "barbell floor press") == Self.floorPress)
        #expect(resolver.id(for: "High-To-Low Cable Rear Delt Fly") == "2a15c6f170d88066b38fd65f8757716f")
        // An alternative name of Horizontal Cable Fly, and the name of another exercise: the name wins.
        #expect(resolver.id(for: "Horizontal Cable Crossover") == "1a05c6f170d880d08e75f6f7c2ebde9e")
        #expect(resolver.created.isEmpty)
        // Carried by two exercises, so it matches neither.
        let ambiguous = resolver.id(for: "GHD Hyperextension")
        #expect(ambiguous.hasPrefix("custom-"))
        #expect(resolver.created.map(\.name) == ["GHD Hyperextension"])
    }

    @Test func unmatchedNameCreatesOneFlaggedCustomThatTheNextImportReuses() throws {
        let custom = Exercise(id: "custom-original", name: "Banded Zercher Walk", type: .compound, primaryMuscles: [.quads], metrics: [.weight, .reps])
        var template = WorkoutTemplate(name: "Odd Day", blocks: [
            WorkoutBlock(exercises: [BlockExercise(exerciseID: custom.id, sets: [Self.set(8, 10, rir: 2)])]),
            WorkoutBlock(exercises: [BlockExercise(exerciseID: Self.floorPress, sets: [Self.set(5, 5, rir: 1)])]),
            WorkoutBlock(exercises: [BlockExercise(exerciseID: custom.id, sets: [Self.set(12, 12)])]),
        ])
        template.gymID = MFExports.gym.id
        let file = try MFTransfer.export(template, exercises: Self.catalog + [custom], gyms: Self.gyms)

        let first = try MFTransfer.importWorkout(file, exercises: Self.catalog, gyms: Self.gyms)
        #expect(first.newExercises.count == 1)
        let created = try #require(first.newExercises.first)
        #expect(created.name == "Banded Zercher Walk")
        #expect(created.isCustom && created.id != custom.id)
        #expect(created.type == .other)
        #expect(created.primaryMuscles.isEmpty)
        #expect(created.metrics == [.weight, .reps])
        #expect(created.about?.contains("Imported from a file") == true)
        #expect(first.value.exercises.map(\.exerciseID) == [created.id, Self.floorPress, created.id])

        let second = try MFTransfer.importWorkout(file, exercises: Self.catalog + first.newExercises, gyms: Self.gyms)
        #expect(second.newExercises.isEmpty)
        #expect(second.value.exercises.map(\.exerciseID) == [created.id, Self.floorPress, created.id])
    }

    @Test func workoutCellsForDropsDurationsNotesAndTwoSupersets() throws {
        var drop = Self.set(8, 8, type: .drop, rir: 1, rest: 120)
        drop.subSets = [SubSet(target: SetTarget(repsMin: 6, repsMax: 6, rir: 1)), SubSet(target: SetTarget(repsMin: 4, repsMax: 4, rir: 0))]
        let press = BlockExercise(exerciseID: Self.floorPress, sets: [drop, Self.set(6, nil, type: .failure, rir: 0)], restSeconds: 90, note: "Pause on the floor")
        let template = WorkoutTemplate(name: "Legs & Press", blocks: [
            WorkoutBlock(exercises: [press]),
            WorkoutBlock(exercises: [
                BlockExercise(exerciseID: Self.legExtension, sets: [Self.set(nil, nil, duration: 45)]),
                BlockExercise(exerciseID: Self.backSquat, sets: [Self.set(10, 10, type: .warmUp)]),
            ]),
            WorkoutBlock(exercises: [
                BlockExercise(exerciseID: Self.backSquat, sets: [Self.set(5, 5, rir: 2)]),
                BlockExercise(exerciseID: Self.legExtension, sets: [Self.set(12, 15, rir: 1)]),
                BlockExercise(exerciseID: Self.floorPress, sets: [Self.set(15, 15, type: .myo, rir: 0)]),
            ]),
        ])
        let file = try MFTransfer.export(template, exercises: Self.catalog, gyms: [])
        let sheet = try Self.sheet(file)
        #expect(sheet.texts == [
            ["", "Exercise", "Notes", "Set 1 Type", "Set 1 Rep Range", "Set 1 RIR", "Set 1 Rest", "Set 1 Duration", "Set 2 Type", "Set 2 Rep Range", "Set 2 RIR", "Set 2 Rest", "Set 2 Duration"],
            ["Legs & Press", "Barbell Floor Press", "Pause on the floor", "Drop Set", "8 - 8 (6 - 6) (4 - 4)", "1 (1) (0)", "120.0", "", "Failure Set", "6+", "0.0", "90.0", ""],
            ["", "Leg Extension ∈ SS1", "", "Standard Set", "", "", "", "45.0", "", "", "", "", ""],
            ["", "Barbell Back Squat ∈ SS1", "", "Warm-Up Set", "10 - 10", "", "", "", "", "", "", "", ""],
            ["", "Barbell Back Squat ∈ SS2", "", "Standard Set", "5 - 5", "2.0", "", "", "", "", "", "", ""],
            ["", "Leg Extension ∈ SS2", "", "Standard Set", "12 - 15", "1.0", "", "", "", "", "", "", ""],
            ["", "Barbell Floor Press ∈ SS2", "", "Myo Set", "15 - 15", "0.0", "", "", "", "", "", "", ""],
        ])
        #expect(sheet.mergedRows == [2...7])

        let back = try MFTransfer.importWorkout(file, exercises: Self.catalog, gyms: []).value
        #expect(back.name == "Legs & Press")
        #expect(back.gymID == nil)
        #expect(back.blocks.map(\.exercises.count) == [1, 2, 3])
        #expect(back.blocks[0].exercises[0].note == "Pause on the floor")
        #expect(back.blocks[0].exercises[0].sets.map(\.summary) == ["drop 8-8 @1 rest 120 (6-6 @1, 4-4 @0)", "failure 6+ @0 rest 90"])
        #expect(back.blocks[1].exercises[0].sets.map(\.summary) == ["standard ?+ for 45s"])
    }

    @Test func readsCommaSeparatedSubRowsAndIgnoresDistance() throws {
        let sheet = Worksheet(name: MFFormat.workoutSheet, rows: [
            [.empty, .text("Exercise"), .text("Set 1 Type"), .text("Set 1 Rep Range"), .text("Set 1 RIR"), .text("Set 1 Rest"), .text("Set 1 Distance")],
            [.text("Drops @ Home Gym"), .text("Barbell Floor Press"), .text("Myo Set"), .text("12 - 15 (5 - 5, 4 - 4)"), .text("1 (0)"), .text("1:30"), .number(400)],
        ])
        var resolver = ExerciseResolver(exercises: Self.catalog)
        let template = try WorkoutSheet.template(from: sheet, resolver: &resolver) { $0 == "Home Gym" ? MFExports.gym.id : nil }
        #expect(template.name == "Drops")
        #expect(template.gymID == MFExports.gym.id)
        // The second sub-row has no RIR of its own, so it shares the set's.
        #expect(template.exercises.map { $0.sets.map(\.summary) } == [["myo 12-15 @1 rest 90 (5-5 @0, 4-4 @1)"]])
    }

    @Test func programExportWritesSkipsAndFallsBackToPlainSetsPastTheTargets() throws {
        var template = WorkoutTemplate(name: "Lower", blocks: [
            WorkoutBlock(exercises: [BlockExercise(
                exerciseID: Self.backSquat,
                sets: [Self.set(8, 10, rir: 2)],
                cycleTargets: [CycleTargets(sets: [Self.set(8, 10, rir: 2)]), CycleTargets(sets: [Self.set(6, 8, rir: 1)], skip: true)]
            )]),
        ])
        template.gymID = MFExports.gym.id
        var program = Program(name: "Three Weeks", color: .teal, icon: "flame.fill", cycles: 3, config: ProgramConfig(deload: .firstCycle, periodization: true))
        program.days = [ProgramDay(templateID: template.id), ProgramDay()]
        template.programID = program.id
        let file = try MFTransfer.export(program, templates: [template], exercises: Self.catalog, gyms: Self.gyms)
        #expect(try Self.sheet(file).texts == [
            ["Program: Three Weeks", "Cycles: 3", "Deload: First Cycle", "Color: Teal", "Icon: Flame", "", "", ""],
            ["Block 1", "", "", "", "", "", "", ""],
            ["Cycle 1", "Exercise", "Skipped", "Notes", "Set 1 Type", "Set 1 Rep Range", "Set 1 RIR", "Set 1 Rest"],
            ["Lower @ Aquasol 6770", "Barbell Back Squat", "No", "", "Standard Set", "8 - 10", "2.0", ""],
            ["Rest", "", "", "", "", "", "", ""],
            ["Cycle 2", "Exercise", "Skipped", "Notes", "Set 1 Type", "Set 1 Rep Range", "Set 1 RIR", "Set 1 Rest"],
            ["Lower @ Aquasol 6770", "Barbell Back Squat", "Yes", "", "Standard Set", "6 - 8", "1.0", ""],
            ["Rest", "", "", "", "", "", "", ""],
            ["Cycle 3", "Exercise", "Skipped", "Notes", "Set 1 Type", "Set 1 Rep Range", "Set 1 RIR", "Set 1 Rest"],
            ["Lower @ Aquasol 6770", "Barbell Back Squat", "No", "", "Standard Set", "8 - 10", "2.0", ""],
            ["Rest", "", "", "", "", "", "", ""],
        ])

        let back = try MFTransfer.importProgram(file, exercises: Self.catalog, gyms: Self.gyms).value
        #expect(back.program.color == .teal)
        #expect(back.program.icon == "flame.fill")
        #expect(back.program.config.deload == .firstCycle)
        #expect(back.dayPattern == "WR")
        let squat = try #require(back.templates.first?.exercises.first)
        #expect(squat.cycleTargets?.map(\.skip) == [false, true, false])
        #expect(squat.cycleTargets?.map { $0.sets.map(\.summary) } == [["standard 8-10 @2"], ["standard 6-8 @1"], ["standard 8-10 @2"]])

        program.config.periodization = false
        let flat = try Self.sheet(MFTransfer.export(program, templates: [template], exercises: Self.catalog, gyms: Self.gyms))
        #expect(flat.texts.map(\.[0]) == ["Program: Three Weeks", "Block 1", "Cycle 1", "Lower @ Aquasol 6770", "Rest"])
    }

    @Test func cycleThatDropsAnExerciseIsMalformed() throws {
        var sheet = try Self.sheet(MFExports.data("program-p3-hyp-5x-ppl-60-90.xlsx"))
        let cycle2 = try #require(sheet.rows.firstIndex { $0.first?.value == .text("Cycle 2") })
        sheet.rows.remove(at: cycle2 + 2)
        var resolver = ExerciseResolver(exercises: Self.catalog)
        #expect(throws: TransferError.malformedRow(cycle2 + 3, "Cycle 2 lists different exercises than cycle 1.")) {
            try ProgramSheet.program(from: sheet, resolver: &resolver) { _ in nil }
        }
    }

    @Test func wrongKindAndNonZipFilesThrow() throws {
        let workout = try MFExports.data("workout-zz-sp-test.xlsx")
        let program = try MFExports.data("program-p7-hyp-3x-fb-40-60-static.xlsx")
        #expect(throws: TransferError.wrongKind(expected: .program)) {
            try MFTransfer.importProgram(workout, exercises: Self.catalog, gyms: [])
        }
        #expect(throws: TransferError.wrongKind(expected: .workout)) {
            try MFTransfer.importWorkout(program, exercises: Self.catalog, gyms: [])
        }
        #expect(throws: TransferError.notAnXLSX) {
            try MFTransfer.importWorkout(Data("Exercise,Notes\n".utf8), exercises: Self.catalog, gyms: [])
        }
    }

    @Test func fileNameIsTheLocalTimestamp() throws {
        let date = try #require(Calendar.current.date(from: DateComponents(year: 2026, month: 10, day: 24, hour: 15, minute: 30, second: 5)))
        #expect(MFFormat.fileName(at: date) == "MacroFactor-20261024153005.xlsx")
    }

    @Test func zipEntriesSurviveTheirOwnArchive() throws {
        let parts: [(path: String, data: Data)] = [("a.txt", Data("hello hello hello".utf8)), ("dir/b.xml", Data(repeating: 0x41, count: 5000)), ("empty", Data())]
        let archive = try Zip.archive(parts, modified: .now)
        let entries = try Zip.entries(of: archive)
        #expect(entries == Dictionary(uniqueKeysWithValues: parts.map { ($0.path, $0.data) }))
        #expect(Zip.crc32(Array("The quick brown fox jumps over the lazy dog".utf8)) == 0x414F_A339)
    }
}
