import Foundation

/// The standard load per equipment item in each unit. An item a gym stores no load for reads the display unit's set,
/// so a kg owner always gets kg plates and bars, also on a gym created in lb or through the agent API. The lb set is
/// MF's defaults, generated from the research capture by `scripts/gym-defaults.ts`; the kg set uses MF's kg bar
/// presets and our own plate, dumbbell, and stack steps. Items without one (benches, racks) have nothing to edit.
enum GymDefaults {
    private static let lbLoads = decode("equipment-loads")
    private static let kgLoads = decode("equipment-loads-kg")

    private static func decode(_ name: String) -> [EquipmentID: EquipmentLoad] {
        guard let url = Bundle.main.url(forResource: name, withExtension: "json") else {
            fatalError("Missing \(name).json. Regenerate it with `bun app-ios/scripts/gym-defaults.ts`.")
        }
        do {
            return try JSONDecoder().decode([EquipmentID: EquipmentLoad].self, from: Data(contentsOf: url))
        } catch {
            fatalError("\(name).json does not match EquipmentLoad: \(error)")
        }
    }

    static func load(for id: EquipmentID, unit: WeightUnit) -> EquipmentLoad? {
        (unit == .kg ? kgLoads : lbLoads)[id]
    }

    static func effectiveLoad(_ id: EquipmentID, in gym: GymProfile, unit: WeightUnit) -> EquipmentLoad? {
        gym.equipment[id]?.load ?? load(for: id, unit: unit)
    }
}
