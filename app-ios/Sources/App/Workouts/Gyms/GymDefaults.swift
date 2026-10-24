import Foundation

/// MF's default load per equipment item, generated from the research capture by `scripts/gym-defaults.ts`. Items
/// without one (benches, racks, most accessories) have nothing to edit.
enum GymDefaults {
    static let loads = decode("equipment-loads")

    /// The loads a gym created while the unit is kg stores explicitly, so switching units later never changes its
    /// plates. Bars and base weights are MF's kg presets; the rest are ours (see `scripts/gym-defaults.ts`).
    static let kgLoads = decode("equipment-loads-kg")

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

    static func load(for id: EquipmentID) -> EquipmentLoad? { loads[id] }

    static func effectiveLoad(_ id: EquipmentID, in gym: GymProfile) -> EquipmentLoad? {
        gym.equipment[id]?.load ?? load(for: id)
    }
}
