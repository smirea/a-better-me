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

    @Test func researchExamplesOnTheDefaultPlates() {
        let plates = bar([2.5, 5, 10, 25, 35, 45])
        #expect(plates.plan(for: 150).perSide == [45, 5, 2.5])
        #expect(plates.plan(for: 135).perSide == [45])
        #expect(plates.plan(for: 45).sentence(unit: "lb") == "0 lb on both sides + 45 lb bar weight = 45 lb")
        #expect(plates.plan(for: 4955).sentence(unit: "lb") == "450 lb on both sides + 45 lb bar weight = 4955 lb - missing 4010 lb")
        #expect(plates.plan(for: 4955).legend.map(\.count) == [10])
    }

    @Test func unloadableTargetShowsWhatFits() {
        let plan = bar([45, 25]).plan(for: 190)
        #expect(plan.perSide == [45, 25])
        #expect(plan.sentence(unit: "lb") == "70 lb on both sides + 45 lb bar weight = 190 lb - missing 5 lb")
    }

    @Test func greedyNeverBacktracks() {
        #expect(bar([45, 35, 25]).plan(for: 165).sentence(unit: "lb") == "45 lb on both sides + 45 lb bar weight = 165 lb - missing 30 lb")
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

struct MixedUnitPlateTests {
    private let kg = WeightUnit.kg

    @Test func threeLbPlatesShownInKgStillReach315Lb() {
        let loading = PlateLoading(base: .bar, baseWeight: kg.fromKg(lb.toKg(45)), plates: [45.0, 25].map { .init(weight: kg.fromKg(lb.toKg($0)), perSide: nil) }, sides: 2)
        let plan = loading.plan(for: 142.88)
        #expect(plan.perSide.count == 3)
        #expect(plan.sentence(unit: "kg") == "61.23 kg on both sides + 20.41 kg bar weight = 142.88 kg")
    }

    @Test func kgPlatesShownInLbLoadExactlyWhatTheStepperPicked() throws {
        let loading = PlateLoading(base: .bar, baseWeight: lb.fromKg(20), plates: [.init(weight: lb.fromKg(1.25), perSide: nil)], sides: 2)
        let stepped = try #require(loading.step(from: 44.09, up: true))
        #expect(SetField.plain(stepped) == "49.6")
        #expect(loading.plan(for: stepped).sentence(unit: "lb") == "2.76 lb on both sides + 44.09 lb bar weight = 49.6 lb")
    }

    @Test func stepperReachesTheFullSleeveInKg() {
        let platesInKg = PlateLoading(base: .bar, baseWeight: kg.fromKg(lb.toKg(45)), plates: [45.0, 25].map { .init(weight: kg.fromKg(lb.toKg($0)), perSide: nil) }, sides: 2)
        #expect(platesInKg.step(from: 420, up: true).map(SetField.plain) == "428.64")
        let only45 = PlateLoading(base: .bar, baseWeight: kg.fromKg(lb.toKg(45)), plates: [.init(weight: kg.fromKg(lb.toKg(45)), perSide: nil)], sides: 2)
        #expect(only45.step(from: 142.88, up: true).map(SetField.plain) == "183.7")
    }

    @Test func absurdTargetStaysBoundedAndSaysWhatIsMissing() {
        let plan = bar([45]).plan(for: 999_999)
        #expect(plan.total == 945)
        #expect(bar([45]).step(from: 945, up: true) == nil)
    }
}

struct LoadableStepTests {
    @Test func plateStepperMovesBetweenLoadableTotals() {
        let loading = Loading.plates(bar([45, 25]))
        #expect(loading.step(from: 185, up: true) == 225)
        #expect(loading.step(from: 185, up: false) == 135)
        #expect(loading.step(from: 187, up: true) == 225)
        #expect(loading.step(from: 187, up: false) == 185)
        #expect(Loading.plates(bar([2.5, 5, 10, 25, 35, 45])).step(from: 185, up: true) == 190)
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
        #expect(plates?.plan(for: 50).sentence(unit: "kg") == "20.41 kg on one side + 22.7 kg base weight = 50 kg - missing 6.89 kg")
    }

    @Test func gymWithoutPlatesLoadsOnlyTheBar() {
        let loads = GymLoads(gym: GymProfile(name: "Bar Only", equipment: ["barbell": GymEquipment(load: .weights(options: [WeightOption(kg: lb.toKg(45))]))]), overrides: [:], catalog: catalog)
        let plates = Loading.resolve(option: ["barbell", Loading.weightPlatesID], catalog: catalog, unit: lb, load: loads.load)?.plates
        #expect(plates?.plates == [])
        #expect(plates?.plan(for: 95).sentence(unit: "lb") == "0 lb on both sides + 45 lb bar weight = 95 lb - missing 50 lb")
    }

    @Test func perSideFieldLoadsOneSideOfTheMachine() {
        let gym = GymProfile(name: "Gym", equipment: [
            "leg-press": GymEquipment(load: .base(kg: lb.toKg(100))),
            Loading.weightPlatesID: GymEquipment(load: .weights(options: [WeightOption(kg: lb.toKg(45)), WeightOption(kg: lb.toKg(25))])),
        ])
        let loads = GymLoads(gym: gym, overrides: [:], catalog: catalog)
        let plates = Loading.resolve(option: ["leg-press"], catalog: catalog, unit: lb, perSide: true, load: loads.load)?.plates
        #expect(plates?.plan(for: 140).sentence(unit: "lb") == "90 lb on one side + 50 lb base weight = 140 lb")
    }

    @Test func gripAttachmentDoesNotReplaceTheDumbbellRack() {
        let catalog = [item("dumbbells", "Free Weights"), item("fat-grips", "Loadable Accessories"), item("belt", "Loadable Accessories"), item(Loading.weightPlatesID, "Free Weights")].keyed
        let loads: [EquipmentID: EquipmentLoad] = [
            "dumbbells": .weights(options: [25.0, 30].map { WeightOption(kg: lb.toKg($0)) }),
            "fat-grips": .base(kg: 0), "belt": .base(kg: 0),
            Loading.weightPlatesID: .weights(options: [WeightOption(kg: lb.toKg(45))]),
        ]
        let grips = Loading.resolve(option: ["dumbbells", "fat-grips"], catalog: catalog, unit: lb) { loads[$0] }
        #expect(grips?.step(from: 25, up: true).map(SetField.plain) == "30")
        let belt = Loading.resolve(option: ["belt", Loading.weightPlatesID], catalog: catalog, unit: lb) { loads[$0] }
        #expect(belt?.plates?.plan(for: 90).sentence(unit: "lb") == "90 lb on one side + 0 lb base weight = 90 lb")
    }

    @Test func emptyRackOrZeroIncrementFallsBackToTheIncrement() {
        #expect(Loading.resolve(option: ["cable"], catalog: catalog, unit: lb) { _ in .weights(options: []) } == nil)
        #expect(Loading.resolve(option: ["cable"], catalog: catalog, unit: lb) { _ in .ranges(options: [WeightRange(minKg: 0, maxKg: 100, incrementKg: 0)]) } == nil)
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

struct PlateCalculatorOptionTests {
    private let catalog = [
        item("barbell", "Loadable Bars"),
        item(Loading.weightPlatesID, "Free Weights"),
        item(Loading.bumperPlatesID, "Free Weights"),
        item("stack", "Pin Loaded Machines"),
    ].keyed
    private let barbell = EquipmentLoad.weights(options: [45.0, 33, 15].map { WeightOption(kg: lb.toKg($0)) })
    private let plates = EquipmentLoad.weights(options: [45.0, 25, 10, 5, 2.5].map { WeightOption(kg: lb.toKg($0)) })

    private func resolve(calculator: PlateCalculatorOptions = PlateCalculatorOptions(), barWeightKg: [EquipmentID: Double] = [:], loads: [EquipmentID: EquipmentLoad]) -> PlateLoading? {
        Loading.resolve(option: ["barbell"], catalog: catalog, unit: lb, calculator: calculator, barWeightKg: barWeightKg) { loads[$0] }?.plates
    }

    @Test func theChosenBarWeightLoadsWhileTheBarStillListsIt() throws {
        let loads: [EquipmentID: EquipmentLoad] = ["barbell": barbell, Loading.weightPlatesID: plates]
        let heaviest = try #require(resolve(loads: loads))
        #expect(heaviest.baseWeights == [15, 33, 45])
        #expect(heaviest.baseID == "barbell")
        #expect(heaviest.plan(for: 135).sentence(unit: "lb") == "45 lb on both sides + 45 lb bar weight = 135 lb")
        let chosen = try #require(resolve(barWeightKg: ["barbell": lb.toKg(33)], loads: loads))
        #expect(chosen.plan(for: 123).sentence(unit: "lb") == "45 lb on both sides + 33 lb bar weight = 123 lb")
        let unlisted = try #require(resolve(barWeightKg: ["barbell": lb.toKg(20)], loads: loads))
        #expect(unlisted.baseWeight == 45)
    }

    @Test func bumperPlatesJoinThePlatesOnlyWhenIncluded() throws {
        let loads: [EquipmentID: EquipmentLoad] = [
            "barbell": barbell,
            Loading.weightPlatesID: .weights(options: [45.0, 25].map { WeightOption(kg: lb.toKg($0)) }),
            Loading.bumperPlatesID: .weights(options: [55.0, 10].map { WeightOption(kg: lb.toKg($0)) }),
        ]
        let steel = try #require(resolve(loads: loads))
        #expect(steel.plan(for: 205).sentence(unit: "lb") == "70 lb on both sides + 45 lb bar weight = 205 lb - missing 20 lb")
        let bumpers = try #require(resolve(calculator: PlateCalculatorOptions(includeBumperPlates: true), loads: loads))
        let plan = bumpers.plan(for: 205)
        #expect(plan.sentence(unit: "lb") == "80 lb on both sides + 45 lb bar weight = 205 lb")
        #expect(plan.loaded.map { ($0.weight, $0.isBumper) }.map { "\($0.0) \($0.1)" } == ["55.0 true", "25.0 false"])
        #expect(plan.legend.map { "\($0.count) x \(SetField.plain($0.weight))\($0.isBumper ? " bumper" : "")" } == ["1 x 55 bumper", "1 x 25"])
    }

    @Test func noBumperPlatesInTheGymAddsNothing() throws {
        let loads: [EquipmentID: EquipmentLoad] = ["barbell": barbell, Loading.weightPlatesID: plates]
        let loading = try #require(resolve(calculator: PlateCalculatorOptions(includeBumperPlates: true), loads: loads))
        #expect(loading.plates.map(\.weight) == [45, 25, 10, 5, 2.5])
    }

    @Test func aTenPercentOffsetOn200LbLoads220() throws {
        let loads: [EquipmentID: EquipmentLoad] = ["barbell": barbell, Loading.weightPlatesID: plates]
        let loading = try #require(resolve(loads: loads))
        let target = PlateOffset.percent(10).applied(to: 200, unit: lb)
        #expect(target == 220)
        #expect(loading.plan(for: target).sentence(unit: "lb") == "87.5 lb on both sides + 45 lb bar weight = 220 lb")
        #expect(loading.plan(for: PlateOffset.percent(-10).applied(to: 200, unit: lb)).perSide == [45, 10, 10, 2.5])
    }

    @Test func mixedUnitsOffKeepsTheDisplayUnitsPlates() throws {
        let mixed = EquipmentLoad.weights(options: [
            WeightOption(kg: lb.toKg(45)), WeightOption(kg: lb.toKg(25)), WeightOption(kg: 20), WeightOption(kg: 1.25),
            WeightOption(kg: lb.toKg(10), unit: .kg),
        ])
        let loads: [EquipmentID: EquipmentLoad] = ["barbell": barbell, Loading.weightPlatesID: mixed]
        let lbOnly = try #require(resolve(loads: loads))
        #expect(lbOnly.plates.map(\.weight) == [45, 25])
        let all = try #require(resolve(calculator: PlateCalculatorOptions(allowMixedUnits: true), loads: loads))
        #expect(all.plates.map { SetField.plain($0.weight) } == ["45", "44.09", "25", "10", "2.76"])
        let kgOnly = try #require(Loading.resolve(option: ["barbell"], catalog: catalog, unit: .kg) { loads[$0] }?.plates)
        #expect(kgOnly.plates.map { SetField.plain($0.weight) } == ["20", "4.54", "1.25"])
    }

    @Test func pinMicroStackStepsThroughEachWeightThenTheNextPin() throws {
        let stack = EquipmentLoad.ranges(
            options: [WeightRange(minKg: 0, maxKg: lb.toKg(500), incrementKg: lb.toKg(10))],
            micro: MicroAdjustment(kind: .pin, weightsKg: [lb.toKg(2.5), lb.toKg(5)])
        )
        let loading = try #require(Loading.resolve(option: ["stack"], catalog: catalog, unit: lb) { _ in stack })
        var steps: [Double] = [100]
        for _ in 0..<4 { steps.append(try #require(loading.step(from: steps.last!, up: true))) }
        #expect(steps.map(SetField.plain) == ["100", "102.5", "105", "110", "112.5"])
        #expect(loading.step(from: 505, up: true) == nil)
        #expect(loading.step(from: 102.5, up: false).map(SetField.plain) == "100")
    }

    @Test func microPlatesCombine() throws {
        let stack = EquipmentLoad.ranges(
            options: [WeightRange(minKg: 0, maxKg: lb.toKg(500), incrementKg: lb.toKg(10))],
            micro: MicroAdjustment(kind: .plates, weightsKg: [lb.toKg(2.5), lb.toKg(5)])
        )
        let loading = try #require(Loading.resolve(option: ["stack"], catalog: catalog, unit: lb) { _ in stack })
        var steps: [Double] = [100]
        for _ in 0..<4 { steps.append(try #require(loading.step(from: steps.last!, up: true))) }
        #expect(steps.map(SetField.plain) == ["100", "102.5", "105", "107.5", "110"])
    }
}

private func item(_ id: String, _ category: String, weightKg: Double? = nil, laterality: PlateLaterality? = nil) -> Equipment {
    Equipment(id: id, name: id, category: category, weightKg: weightKg, weightOptionsKg: [], plateLaterality: laterality, gymPresets: [], hasImage: false)
}

private extension [Equipment] {
    var keyed: [EquipmentID: Equipment] { Dictionary(uniqueKeysWithValues: map { ($0.id, $0) }) }
}
