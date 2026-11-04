import Foundation
import GRDB
import Testing
@testable import App

@MainActor
struct UnitDefaultsTests {
    private let barbell: EquipmentID = "19e5c6f170d8801cac93cf6853bd86b8"
    private let latPulldown: EquipmentID = "19e5c6f170d88007ba63e3e18e4933f8"
    private let catalog = ExerciseCatalog().equipment

    @Test func aNeverChosenUnitReadsLbAndAStoredKgStaysKg() throws {
        #expect(AppSettings().weightUnit == .lb)
        #expect(try AppSettings(row: Row(["id": "settings", "weight_unit": nil])).weightUnit == .lb)
        #expect(try AppSettings(row: Row(["id": "settings", "weight_unit": "kg"])).weightUnit == .kg)
    }

    @Test func aNewGymStoresNoLoads() {
        let equipment = GymTemplate.commercial.equipment(from: catalog)
        #expect(equipment[barbell] == GymEquipment(load: nil))
        #expect(equipment.values.allSatisfy { $0.load == nil })
    }

    /// The owner's gym came from the agent API with no stored loads and read MF's lb defaults in kg: a 20.41 kg bar,
    /// 20.41 / 2.27 / 1.13 kg plates, "70.31 kg" suggestions, and a 49.9 kg pulldown after a 45 kg set.
    @Test func anUnstoredGymInKgLoadsKgBarsPlatesAndStacks() throws {
        let gym = GymProfile(name: "Home", equipment: [barbell: GymEquipment(), Loading.weightPlatesID: GymEquipment(), latPulldown: GymEquipment()])
        let loads = GymLoads(gym: gym, overrides: [:], unit: .kg, catalog: catalog)

        let bench = try #require(Loading.resolve(option: [Loading.weightPlatesID, barbell], catalog: catalog, unit: .kg, load: loads.load))
        let plates = try #require(bench.plates)
        #expect(plates.baseWeight == 20)
        #expect(plates.plates.map(\.weight) == [25, 20, 15, 10, 5, 2.5, 1.25])
        #expect(plates.plan(for: 70).sentence(unit: "kg") == "25 kg on both sides + 20 kg bar weight = 70 kg")
        let benchWeights = LoadableWeights(loading: bench, unit: .kg)
        #expect(benchWeights.nearest(70.31) == 70)
        #expect(benchWeights.floor(71) == 70)

        let pulldown = try #require(Loading.resolve(option: [latPulldown], catalog: catalog, unit: .kg, load: loads.load))
        #expect(pulldown.step(from: 45, up: true) == 50)
        #expect(LoadableWeights(loading: pulldown, unit: .kg).nearest(49.9) == 50)
    }

    @Test func theSameGymInLbLoadsMFsLbDefaults() throws {
        let gym = GymProfile(name: "Home", equipment: [barbell: GymEquipment(), Loading.weightPlatesID: GymEquipment()])
        let loads = GymLoads(gym: gym, overrides: [:], unit: .lb, catalog: catalog)
        let plates = try #require(Loading.resolve(option: [barbell], catalog: catalog, unit: .lb, load: loads.load)?.plates)
        #expect(plates.plan(for: 185).sentence(unit: "lb") == "70 lb on both sides + 45 lb bar weight = 185 lb")
    }

    @Test func aStoredLoadKeepsItsPlatesInEitherUnit() throws {
        let gym = GymProfile(name: "Home", equipment: [
            barbell: GymEquipment(load: .weights(options: [WeightOption(kg: 20)])),
            Loading.weightPlatesID: GymEquipment(load: .weights(options: [20, 10, 5].map { WeightOption(kg: $0) })),
        ])
        let loads = GymLoads(gym: gym, overrides: [:], unit: .lb, catalog: catalog)
        let plates = try #require(Loading.resolve(option: [barbell], catalog: catalog, unit: .lb, load: loads.load)?.plates)
        #expect(plates.plates.map { ($0.weight * 100).rounded() / 100 } == [44.09, 22.05, 11.02])
    }
}
