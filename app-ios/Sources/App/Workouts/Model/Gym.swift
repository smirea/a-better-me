import Foundation
import GRDB

typealias EquipmentID = String

/// A row of the synced `gym_profiles` table: a place to train and the equipment it has. At most one profile is meant to
/// be the default; `LocalStore.setDefaultGym` keeps it so and `GymProfile.defaultGym` resolves a double state.
struct GymProfile: SyncedRecord {
    static let table = "gym_profiles"

    var id: UUID
    var name: String
    /// An SF Symbol name.
    var icon: String
    var isDefault = false
    /// The selected equipment. A key present means selected; its value overrides the catalog's weights.
    var equipment: [EquipmentID: GymEquipment] = [:]
    var createdAt: Date
    var updatedAt: Date

    init(name: String, icon: String = "building.2", equipment: [EquipmentID: GymEquipment] = [:]) {
        id = UUID()
        self.name = name
        self.icon = icon
        self.equipment = equipment
        createdAt = .now
        updatedAt = .now
    }

    init(row: Row) throws {
        id = try row.uuid("id")
        name = row["name"]
        icon = row["icon"] ?? "building.2"
        isDefault = row.flag("is_default")
        equipment = row.json("equipment", over: [EquipmentID: GymEquipment]())
        createdAt = try row.instant("created_at")
        updatedAt = try row.instant("updated_at")
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = key
        container["name"] = name
        container["icon"] = icon
        container["is_default"] = isDefault ? 1 : 0
        container["equipment"] = try RowJSON.text(equipment)
        container["created_at"] = Instant.text(createdAt)
        container["updated_at"] = Instant.text(updatedAt)
    }

    func hasEquipment(for exercise: Exercise) -> Bool {
        func hasOption(among alternatives: [[EquipmentID]]) -> Bool {
            alternatives.isEmpty || alternatives.contains { $0.allSatisfy { equipment[$0] != nil } }
        }
        return hasOption(among: exercise.resistanceEquipmentIDs) && hasOption(among: exercise.supportEquipmentIDs)
    }
}

struct GymEquipment: Codable, Hashable {
    /// `nil` uses the catalog's weights for this item.
    var load: EquipmentLoad?
}

/// The four ways MF describes what an item can load. Which one applies follows the item's catalog category, and an item
/// holds exactly one. Synthesized `Codable` writes `{"weights":{"options":[...]}}` and `{"base":{"kg":52.2}}`.
enum EquipmentLoad: Codable, Hashable {
    /// Dumbbells, kettlebells, plates, bars of several weights.
    case weights(options: [WeightOption])
    /// Pin-stack machines: "0 - 500 lb, 10 lb increments", one or more ranges.
    case ranges(options: [WeightRange])
    /// A plate-loaded machine's or loadable accessory's own weight.
    case base(kg: Double)
    /// Band inventory by color.
    case bands(options: [BandOption])
}

struct WeightOption: Codable, Hashable {
    var kg: Double
    /// `nil` means unlimited (plates' Set Qty).
    var count: Int?
}

struct WeightRange: Codable, Hashable {
    var minKg: Double
    var maxKg: Double
    var incrementKg: Double
}

struct BandOption: Codable, Hashable {
    var color: String
    var count: Int?
}
