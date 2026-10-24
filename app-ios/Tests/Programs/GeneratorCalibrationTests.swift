import Foundation
import Testing
@testable import App

/// The generator against the 20 programs MF generated (research spec §1.2). Exercise identity is random in MF, so the
/// comparison is structural: day layout, slot classes, set counts, reps, RIR, and weekly sets per muscle.
/// `scripts/calibrate-generator` runs this suite and prints the `CAL|` lines as a table.
@MainActor
struct GeneratorCalibrationTests {
    static let catalog = ExerciseCatalog()
    static let gym = Calibration.gym(catalog.equipment)

    static func program(_ id: String) -> MFProgram { Calibration.programs.first { $0.id == id }! }

    @Test func everyProgramKeepsMFsStructureAndRepScheme() {
        var worst = CalibrationError()
        for mf in Calibration.programs {
            let (error, _, _) = Calibration.measure(mf, catalog: Self.catalog, gym: Self.gym)
            print("CAL|\(error)")
            for line in error.days { print("DAY|\(line)") }
            #expect(error.structureMatches, "\(mf.id): day pattern, names, cycles, or deload differ")
            #expect(error.repMismatches == 0, "\(mf.id): rep tiers differ")
            #expect(error.rirMismatches == 0, "\(mf.id): RIR differs")
            worst.slotMismatches = max(worst.slotMismatches, error.slotMismatches)
            worst.compoundSetError = max(worst.compoundSetError, error.compoundSetError)
            worst.accessoryCountError = max(worst.accessoryCountError, error.accessoryCountError)
            worst.muscleSetMax = max(worst.muscleSetMax, error.muscleSetMax)
        }
        print("CAL|worst slots=\(worst.slotMismatches) Ksets=\(worst.compoundSetError) accN=\(worst.accessoryCountError) muscleMax=\(worst.muscleSetMax)")
    }

    /// The per-program error after calibration. A change that moves one of these numbers is a change to the generator's
    /// fit and must update the table in docs/decisions/workouts.md.
    @Test(arguments: [
        ("P1", 0, 1, 0), ("P2", 0, 1, 0), ("P3", 0, 0, 8), ("P4", 0, 1, 1), ("P5", 0, 3, 2),
        ("P6", 0, 0, 2), ("P7", 0, 1, 0), ("P8", 0, 1, 0), ("P9", 0, 1, 0), ("P10", 0, 1, 0),
        ("P11", 2, 3, 1), ("P12", 0, 4, 4), ("P13", 0, 0, 4), ("P14", 0, 0, 3), ("P15", 0, 0, 1),
        ("P16", 0, 1, 0), ("P17", 0, 1, 0), ("P18", 0, 1, 0), ("P19", 0, 0, 3), ("P20", 0, 0, 1),
        ("P21", 0, 3, 3), ("P22", 0, 2, 1), ("P23", 0, 1, 0),
    ])
    func fitPerProgram(id: String, slots: Int, compoundSets: Int, accessories: Int) {
        let (error, _, _) = Calibration.measure(Self.program(id), catalog: Self.catalog, gym: Self.gym)
        #expect(error.slotMismatches == slots, "\(id) slot mismatches")
        #expect(error.compoundSetError == compoundSets, "\(id) compound set error")
        #expect(error.accessoryCountError == accessories, "\(id) accessory count error")
    }

    @Test func p1SkeletonMatchesMFsSlidingWindow() {
        let (_, _, days) = Calibration.measure(Self.program("P1"), catalog: Self.catalog, gym: Self.gym)
        let compounds = days.map { $0.slots.filter { !$0.role.isAccessory }.map { "\($0.pattern!.rawValue) \($0.role) x\($0.sets)" } }
        #expect(compounds == [
            ["Horizontal Push primary x3", "Vertical Pull pullPrimary x2", "Vertical Push secondary x2", "Squat secondary x2"],
            ["Vertical Push primary x3", "Squat primary x2", "Horizontal Pull pullSecondary x2", "Hip Hinge secondary x2"],
            ["Horizontal Pull pullPrimary x3", "Hip Hinge primary x2", "Horizontal Push secondary x2", "Vertical Pull pullSecondary x2"],
        ])
        let accessories = days.map { $0.slots.filter(\.role.isAccessory).map { "\($0.muscle!.rawValue) x\($0.sets)" } }
        #expect(accessories == [
            ["side_delts x3", "chest x3", "calves x3", "upper_traps x3"],
            ["biceps x3", "rear_delts x3", "hamstrings x3", "upper_back x3"],
            ["triceps x3", "lats x3", "quads x3", "abs x3"],
        ])
    }

    @Test func p13KeepsEachPatternAtTwoSecondariesPerWeek() {
        let (_, _, days) = Calibration.measure(Self.program("P13"), catalog: Self.catalog, gym: Self.gym)
        var secondaries: [MovementPattern: Int] = [:]
        for slot in days.flatMap(\.slots) where slot.role == .secondary || slot.role == .pullSecondary {
            secondaries[slot.pattern!, default: 0] += 1
        }
        #expect(secondaries == Dictionary(uniqueKeysWithValues: MovementPattern.allCases.map { ($0, 2) }))
        #expect(days.map { $0.slots.filter { !$0.role.isAccessory }.count } == [4, 4, 3, 4, 3])
    }

    @Test func noExerciseRepeatsAndNoGroupingIsShared() {
        for mf in Calibration.programs {
            let (_, generated, _) = Calibration.measure(mf, catalog: Self.catalog, gym: Self.gym)
            let ids = generated.templates.flatMap(\.blocks).flatMap(\.exercises).map(\.exerciseID)
            #expect(Set(ids).count == ids.count, "\(mf.id) repeats an exercise")
            let groupings = ids.flatMap { Self.catalog.exercise($0)?.selection?.exclusionGroupings ?? [] }
            #expect(Set(groupings).count == groupings.count, "\(mf.id) shares an exclusion grouping")
        }
    }

    @Test func picksRespectTheGymAndTheAssessment() {
        let (_, generated, _) = Calibration.measure(Self.program("P2"), catalog: Self.catalog, gym: Self.gym)
        for id in generated.templates.flatMap(\.blocks).flatMap(\.exercises).map(\.exerciseID) {
            let exercise = Self.catalog.exercise(id)!
            #expect(Self.gym.hasEquipment(for: exercise), "\(exercise.name) needs equipment the gym lacks")
            #expect(ExerciseAssessment.allows(exercise, profile: Calibration.profile), "\(exercise.name) fails the assessment")
            #expect(exercise.selection?.preconditions.contains { $0.contains("vertical pull") || $0.contains("dip") } != true)
        }
    }

    @Test func generatedTemplatesCarrySevenCyclesAndTheProgramID() {
        let (_, generated, _) = Calibration.measure(Self.program("P1"), catalog: Self.catalog, gym: Self.gym)
        #expect(generated.program.cycles == 7)
        #expect(generated.program.config.deload == .lastCycle)
        #expect(generated.program.totalCycles == 8)
        #expect(generated.program.name == "Full Body")
        #expect(generated.templates.count == 3)
        for template in generated.templates {
            #expect(template.programID == generated.program.id)
            for item in template.blocks.flatMap(\.exercises) {
                #expect(item.cycleTargets?.count == 7)
                #expect(item.sets == item.cycleTargets?[0].sets)
            }
        }
        #expect(generated.program.days.map { $0.templateID != nil } == [true, false, true, false, true, false, false])
    }

    @Test func lessFocusDropsTheMuscleFromAccessoriesButNotCompounds() {
        let (_, _, days) = Calibration.measure(Self.program("P23"), catalog: Self.catalog, gym: Self.gym)
        let accessories = days.flatMap { $0.slots.filter(\.role.isAccessory).compactMap(\.muscle) }
        #expect(!accessories.contains(.triceps))
        #expect(!accessories.contains(.lats))
        #expect(accessories.count == 12)
        #expect(days.flatMap(\.slots).filter { !$0.role.isAccessory }.count == 12)
    }
}
