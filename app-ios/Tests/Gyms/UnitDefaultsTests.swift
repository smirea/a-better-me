import Foundation
import GRDB
import Testing
@testable import App

@MainActor
struct UnitDefaultsTests {
    private let barbell: EquipmentID = "19e5c6f170d8801cac93cf6853bd86b8"
    private let catalog = ExerciseCatalog().equipment

    @Test func aNeverChosenUnitReadsLbAndAStoredKgStaysKg() throws {
        #expect(AppSettings().weightUnit == .lb)
        #expect(try AppSettings(row: Row(["id": "settings", "weight_unit": nil])).weightUnit == .lb)
        #expect(try AppSettings(row: Row(["id": "settings", "weight_unit": "kg"])).weightUnit == .kg)
    }

    @Test func aKgGymStoresMetricPlatesAndBars() throws {
        let gym = GymProfile(name: "Your Gym", equipment: GymTemplate.commercial.equipment(from: catalog, unit: .kg))
        #expect(gym.equipment[barbell]?.load == .weights(options: [7, 15, 20].map { WeightOption(kg: $0) }))
        let loads = GymLoads(gym: gym, overrides: [:], catalog: catalog)
        let plates = try #require(Loading.resolve(option: [barbell], catalog: catalog, unit: .kg, load: loads.load)?.plates)
        #expect(plates.baseWeight == 20)
        #expect(plates.plates.map(\.weight) == [25, 20, 15, 10, 5, 2.5, 1.25])
    }

    @Test func aLbGymKeepsTheDefaultsUnstored() throws {
        let gym = GymProfile(name: "Your Gym", equipment: GymTemplate.commercial.equipment(from: catalog, unit: .lb))
        #expect(gym.equipment[barbell] == GymEquipment(load: nil))
        let loads = GymLoads(gym: gym, overrides: [:], catalog: catalog)
        let plates = try #require(Loading.resolve(option: [barbell], catalog: catalog, unit: .lb, load: loads.load)?.plates)
        #expect(plates.plan(for: 185).sentence(unit: "lb") == "70 lb on both sides + 45 lb bar weight = 185 lb")
    }
}
