import Foundation
import Testing
@testable import App

private func bar(_ plates: [Double], counts: [Int?]? = nil, base: Double = 45) -> PlateLoading {
    let counts = counts ?? plates.map { _ in nil }
    return PlateLoading(base: .bar, baseWeight: base, plates: zip(plates, counts).map { .init(weight: $0, perSide: $1) }, sides: 2)
}

private let lb = WeightUnit.lb

struct PlateCalculatorTests {
    @Test func researchExample185OnA45Bar() {
        let plan = bar([45, 25]).plan(for: 185)
        #expect(plan.perSide == [45, 25])
        #expect(plan.legend.map { "\($0.count) x \(SetField.plain($0.weight))" } == ["1 x 45", "1 x 25"])
        #expect(plan.sentence(unit: "lb") == "70 lb on both sides + 45 lb bar weight = 185 lb")
    }

    @Test func researchExampleTargetBelowTheBar() {
        let plan = bar([45, 25]).plan(for: 0)
        #expect(plan.perSide == [])
        #expect(plan.sentence(unit: "lb") == "0 lb on both sides + 45 lb bar weight = 0 lb + extra 45 lb")
    }

    @Test func unloadableTargetRoundsUpToTheNextLoad() {
        let plan = bar([45, 25]).plan(for: 190)
        #expect(plan.perSide == [25, 25, 25])
        #expect(plan.total == 195)
        #expect(plan.sentence(unit: "lb") == "75 lb on both sides + 45 lb bar weight = 190 lb + extra 5 lb")
    }

    @Test func heaviestFirstBacktracksWhenTheBigPlateLeavesAGap() {
        #expect(bar([45, 35, 25]).plan(for: 165).perSide == [35, 25])
        #expect(bar([45, 35, 25, 10, 5, 2.5]).plan(for: 315).perSide == [45, 45, 45])
        #expect(bar([45, 35, 25, 10, 5, 2.5]).plan(for: 230).perSide == [45, 45, 2.5])
    }

    @Test func plateCountsSplitAcrossSidesAndCapTheLoad() {
        let limited = bar([45, 25], counts: [1, nil])
        #expect(limited.plan(for: 235).perSide == [45, 25, 25])
        let scarce = bar([45], counts: [1])
        let plan = scarce.plan(for: 315)
        #expect(plan.perSide == [45])
        #expect(plan.sentence(unit: "lb") == "45 lb on both sides + 45 lb bar weight = 315 lb - missing 180 lb")
    }

    @Test func singleSideMachineSaysOneSideAndBaseWeight() {
        let machine = PlateLoading(base: .machine, baseWeight: 20, plates: [.init(weight: 45, perSide: nil), .init(weight: 25, perSide: nil)], sides: 1)
        #expect(machine.plan(for: 90).sentence(unit: "lb") == "70 lb on one side + 20 lb base weight = 90 lb")
    }

    @Test func kgOwnerWithLbPlatesStillLoadsExactly() {
        let kg = WeightUnit.kg
        let loading = PlateLoading(base: .bar, baseWeight: kg.fromKg(lb.toKg(45)), plates: [45.0, 25].map { .init(weight: kg.fromKg(lb.toKg($0)), perSide: nil) }, sides: 2)
        #expect(loading.plan(for: 83.91).sentence(unit: "kg") == "31.75 kg on both sides + 20.41 kg bar weight = 83.91 kg")
    }
}

struct LoadableStepTests {
    @Test func plateStepperMovesBetweenLoadableTotals() {
        let loading = Loading.plates(bar([45, 25]))
        #expect(loading.step(from: 185, up: true) == 195)
        #expect(loading.step(from: 185, up: false) == 145)
        #expect(loading.step(from: 187, up: true) == 195)
        #expect(loading.step(from: 187, up: false) == 185)
        #expect(loading.step(from: 45, up: false) == nil)
        #expect(loading.step(from: 0, up: true) == 45)
    }

    @Test func pinStackSnapsToItsIncrement() throws {
        let catalog = [item("stack", "Pin Loaded Machines")].keyed
        let stack = EquipmentLoad.ranges(options: [WeightRange(minKg: 0, maxKg: lb.toKg(500), incrementKg: lb.toKg(10))])
        let loading = try #require(Loading.resolve(option: ["stack"], catalog: catalog, unit: lb) { _ in stack })
        #expect(loading.step(from: 183, up: true).map(SetField.plain) == "190")
        #expect(loading.step(from: 183, up: false).map(SetField.plain) == "180")
        #expect(loading.step(from: 500, up: true) == nil)
    }

    @Test func dumbbellsStepThroughTheRack() throws {
        let catalog = [item("dumbbells", "Free Weights")].keyed
        let rack = EquipmentLoad.weights(options: [25.0, 30, 35, 22.5].map { WeightOption(kg: lb.toKg($0)) })
        let loading = try #require(Loading.resolve(option: ["dumbbells"], catalog: catalog, unit: lb) { _ in rack })
        #expect(loading.step(from: 25, up: true).map(SetField.plain) == "30")
        #expect(loading.step(from: 25, up: false).map(SetField.plain) == "22.5")
        #expect(loading.step(from: 27, up: false).map(SetField.plain) == "25")
    }
}

struct EquipmentResolutionTests {
    private let catalog = [
        item("barbell", "Loadable Bars"),
        item(Loading.weightPlatesID, "Free Weights"),
        item("leg-press", "Plate Loaded Machines", weightKg: 53.5, laterality: .perSide),
        item("calf-raise", "Plate Loaded Machines", weightKg: 22.7, laterality: .singleSide),
        item("cable", "Pin Loaded Machines"),
        item("bands", "Bands & Ropes"),
    ].keyed

    @Test func barbellOptionUsesTheGymsBarAndPlates() {
        let gym = GymProfile(name: "Garage", equipment: [
            "barbell": GymEquipment(load: .weights(options: [WeightOption(kg: lb.toKg(45))])),
            Loading.weightPlatesID: GymEquipment(load: .weights(options: [WeightOption(kg: lb.toKg(45)), WeightOption(kg: lb.toKg(25))])),
        ])
        let loads = GymLoads(gym: gym, overrides: [:], catalog: catalog)
        let loading = Loading.resolve(option: [Loading.weightPlatesID, "barbell"], catalog: catalog, unit: lb, load: loads.load)
        #expect(loading?.plates?.plan(for: 185).sentence(unit: "lb") == "70 lb on both sides + 45 lb bar weight = 185 lb")
    }

    @Test func exerciseOverrideReplacesTheGymBar() {
        let gym = GymProfile(name: "Garage", equipment: [
            "barbell": GymEquipment(load: .weights(options: [WeightOption(kg: lb.toKg(45))])),
            Loading.weightPlatesID: GymEquipment(load: .weights(options: [WeightOption(kg: lb.toKg(45))])),
        ])
        let loads = GymLoads(gym: gym, overrides: ["barbell": .weights(options: [WeightOption(kg: lb.toKg(35))])], catalog: catalog)
        let loading = Loading.resolve(option: ["barbell"], catalog: catalog, unit: lb, load: loads.load)
        #expect(loading?.plates?.plan(for: 125).sentence(unit: "lb") == "45 lb on both sides + 35 lb bar weight = 125 lb")
    }

    @Test func plateLoadedMachineTakesPlatesItsOptionDoesntName() {
        let gym = GymProfile(name: "Gym", equipment: [
            "calf-raise": GymEquipment(load: nil),
            Loading.weightPlatesID: GymEquipment(load: .weights(options: [WeightOption(kg: lb.toKg(45))])),
        ])
        let loads = GymLoads(gym: gym, overrides: [:], catalog: catalog)
        let plates = Loading.resolve(option: ["calf-raise"], catalog: catalog, unit: .kg, load: loads.load)?.plates
        #expect(plates?.sides == 1)
        #expect(plates?.plan(for: 50).sentence(unit: "kg") == "40.82 kg on one side + 22.7 kg base weight = 50 kg + extra 13.52 kg")
    }

    @Test func gymWithoutPlatesLoadsOnlyTheBar() {
        let loads = GymLoads(gym: GymProfile(name: "Bar Only", equipment: ["barbell": GymEquipment(load: .weights(options: [WeightOption(kg: lb.toKg(45))]))]), overrides: [:], catalog: catalog)
        let plates = Loading.resolve(option: ["barbell", Loading.weightPlatesID], catalog: catalog, unit: lb, load: loads.load)?.plates
        #expect(plates?.plates == [])
        #expect(plates?.plan(for: 95).sentence(unit: "lb") == "0 lb on both sides + 45 lb bar weight = 95 lb - missing 50 lb")
    }

    @Test func bandsHaveNoLoading() {
        #expect(Loading.resolve(option: ["bands"], catalog: catalog, unit: lb) { _ in .bands(options: [BandOption(color: "Red")]) } == nil)
    }

    @Test func optionsTheGymLacksAreNumberedAndSkippedForTheDefault() {
        let exercise = Exercise(
            id: "curl", name: "Cable Curl", type: .isolation, primaryMuscles: [.biceps], metrics: [.weight, .reps],
            resistanceEquipmentIDs: [["leg-press"], ["cable"], ["barbell", Loading.weightPlatesID]]
        )
        let availability = GymAvailability(gym: GymProfile(name: "Gym", equipment: ["cable": GymEquipment(load: nil)]), equipment: catalog)
        let options = exercise.resistanceOptions(in: availability)
        #expect(options.filter { !$0.isAvailable }.map(\.unavailableLabel) == ["Option 1 not available in your gym", "Option 3 not available in your gym"])
        #expect(exercise.chosenEquipment(nil, in: availability) == ["cable"])
        #expect(exercise.chosenEquipment(["leg-press"], in: availability) == ["leg-press"])
        #expect(exercise.chosenEquipment(["dumbbells"], in: availability) == ["cable"])
    }
}

private func item(_ id: String, _ category: String, weightKg: Double? = nil, laterality: PlateLaterality? = nil) -> Equipment {
    Equipment(id: id, name: id, category: category, weightKg: weightKg, weightOptionsKg: [], plateLaterality: laterality, gymPresets: [], hasImage: false)
}

private extension [Equipment] {
    var keyed: [EquipmentID: Equipment] { Dictionary(uniqueKeysWithValues: map { ($0.id, $0) }) }
}
