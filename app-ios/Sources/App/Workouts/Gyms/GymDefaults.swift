import Foundation

/// MF's default load per equipment item, generated from the research capture by `scripts/gym-defaults.ts`. Items
/// without one (benches, racks, most accessories) have nothing to edit.
enum GymDefaults {
    static let loads: [EquipmentID: EquipmentLoad] = {
        guard let url = Bundle.main.url(forResource: "equipment-loads", withExtension: "json") else {
            fatalError("Missing equipment-loads.json. Regenerate it with `bun app-ios/scripts/gym-defaults.ts`.")
        }
        do {
            return try JSONDecoder().decode([EquipmentID: EquipmentLoad].self, from: Data(contentsOf: url))
        } catch {
            fatalError("equipment-loads.json does not match EquipmentLoad: \(error)")
        }
    }()

    static func load(for id: EquipmentID) -> EquipmentLoad? { loads[id] }

    /// The gym's own load for the item, or the default.
    static func effectiveLoad(_ id: EquipmentID, in gym: GymProfile) -> EquipmentLoad? {
        gym.equipment[id]?.load ?? load(for: id)
    }
}
