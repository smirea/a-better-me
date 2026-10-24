import Foundation
import Testing
@testable import App

/// Known rows of the committed MF exports, read with `python3 -I docs/research/mf-workouts/tools/xlsx.py`.
@MainActor
struct TransferImportTests {
    static let catalog = ExerciseCatalog().all
    static let gyms = [MFExports.gym]

    static func workout(_ file: String) throws -> WorkoutTemplate {
        try MFTransfer.importWorkout(MFExports.data(file), exercises: catalog, gyms: gyms).value
    }

    static func program(_ file: String) throws -> GeneratedProgram {
        try MFTransfer.importProgram(MFExports.data(file), exercises: catalog, gyms: gyms).value
    }

    @Test func dropFailureSupersetWorkout() throws {
        let template = try Self.workout("workout-zz-sp-test-superset-drop-failure-rest.xlsx")
        #expect(template.name == "ZZ SP Test")
        #expect(template.gymID == MFExports.gym.id)
        #expect(template.blocks.map { $0.exercises.map(\.exerciseID) } == [
            ["1a05c6f170d8802a950df7b6c710ffb4"],
            ["29f5c6f170d8800f9577c4c1d85c2900", "25d5c6f170d880c887a2fa457044342e"],
        ])
        #expect(template.blocks[0].exercises[0].sets.map(\.summary) == [
            "drop 8-8 @0 rest 0 (6-6 @0)",
            "standard 8-12 @2",
            "failure 8+ @0",
        ])
        #expect(template.blocks[1].exercises[0].sets.map(\.summary) == Array(repeating: "standard 10-15 @1", count: 3))
        #expect(template.blocks[1].exercises[1].sets.map(\.summary) == Array(repeating: "standard 10-10 @1", count: 3))
    }

    @Test func plainWorkout() throws {
        let template = try Self.workout("workout-zz-sp-test.xlsx")
        #expect(template.name == "ZZ SP Test")
        #expect(template.blocks.map(\.exercises.count) == [1, 1, 1])
        #expect(template.exercises.map(\.exerciseID) == [
            "1a05c6f170d8802a950df7b6c710ffb4", "29f5c6f170d8800f9577c4c1d85c2900", "25d5c6f170d880c887a2fa457044342e",
        ])
        #expect(template.exercises.map { $0.sets.map(\.summary) } == [
            Array(repeating: "standard 8-12 @2", count: 3),
            Array(repeating: "standard 10-15 @1", count: 3),
            Array(repeating: "standard 10-10 @1", count: 3),
        ])
    }

    @Test func fiveDayPushPullLegs() throws {
        let p3 = try Self.program("program-p3-hyp-5x-ppl-60-90.xlsx")
        #expect(p3.program.name == "ZZ P3 Hyp 5x PPL 60-90")
        #expect(p3.program.cycles == 7)
        #expect(p3.program.config.deload == .lastCycle)
        #expect(p3.program.config.periodization)
        #expect(p3.program.color == .red)
        #expect(p3.program.icon == ProgramColor.defaultIcon)
        #expect(p3.dayPattern == "WWWWWRR")
        #expect(p3.templates.map(\.name) == ["Push", "Hinge", "Pull", "Squat", "Accessories"])
        #expect(p3.templates.allSatisfy { $0.programID == p3.program.id })

        let push = try #require(p3.template("Push"))
        #expect(push.exercises.count == 11)
        let bench = push.exercises[0]
        #expect(bench.exerciseID == "1a05c6f170d8807c9f16f226db24074d")
        #expect(bench.sets.map(\.summary) == ["standard 11-13 @3", "standard 11-13 @2", "standard 11-13 @2", "standard 11-13 @1"])
        #expect(bench.cycleTargets?.count == 7)
        #expect(bench.cycleTargets?.allSatisfy { !$0.skip } == true)
        #expect(push.exercises[2].exerciseID == "1a05c6f170d8803ba48ec1443eab5978")
        #expect(push.exercises[2].sets.map(\.summary) == ["standard 14-16 @2", "standard 14-16 @1"])
        let squat = try #require(p3.template("Squat"))
        #expect(squat.exercises[0].exerciseID == "1a25c6f170d8800b8768c160b4808e67")
    }

    @Test func staticProgramHasNoPeriodization() throws {
        let p7 = try Self.program("program-p7-hyp-3x-fb-40-60-static.xlsx")
        #expect(p7.program.cycles == 7)
        #expect(!p7.program.config.periodization)
        #expect(p7.program.config.deload == .lastCycle)
        #expect(p7.dayPattern == "WRWRWRR")
        #expect(p7.templates.map(\.name) == ["Workout A", "Workout B", "Workout C"])
        #expect(p7.templates.flatMap(\.exercises).allSatisfy { $0.cycleTargets == nil })
        let first = try #require(p7.template("Workout A")?.exercises.first)
        #expect(first.exerciseID == "1a05c6f170d8807c9f16f226db24074d")
        #expect(first.sets.map(\.summary) == ["standard 7-9 @3", "standard 7-9 @2", "standard 7-9 @1"])
    }

    @Test func programWithoutDeload() throws {
        let p18 = try Self.program("program-p18-hyp-3x-fb-40-60-nodeload.xlsx")
        #expect(p18.program.config.deload == .none)
        #expect(p18.program.cycles == 7)
        #expect(p18.dayPattern == "WRWRWRR")
        let first = try #require(p18.template("Workout A")?.exercises.first)
        #expect(first.exerciseID == "19f5c6f170d88013ae78cc9e6c967813")
        #expect(first.sets.map(\.summary) == ["standard 11-13 @3", "standard 11-13 @2", "standard 11-13 @1"])
    }

    @Test func laterCycleTargetsDifferFromTheFirst() throws {
        let p6 = try Self.program("program-p6-both-5x-nopref-40-60-linear.xlsx")
        #expect(p6.dayPattern == "WWWWWRR")
        let bench = try #require(p6.template("Push")?.exercises.first)
        #expect(bench.exerciseID == "19f5c6f170d88013ae78cc9e6c967813")
        let cycles = try #require(bench.cycleTargets)
        #expect(cycles.map { $0.sets.first?.target?.repsMin } == [7, 7, 5, 4, 4, 2, 2])
        #expect(cycles[0].sets.map(\.summary) == ["standard 7-9 @3", "standard 7-9 @2", "standard 7-9 @1"])
        #expect(cycles[3].sets.map(\.summary) == ["standard 4-6 @3", "standard 4-6 @2", "standard 4-6 @1"])
        #expect(bench.sets == cycles[0].sets)
    }
}
