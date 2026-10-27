import Foundation
import GRDB


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
    /// Pin-stack machines: "0 - 500 lb, 10 lb increments", one or more ranges, plus the micro-adjustments the stack
    /// takes on top of a pin position.
    case ranges(options: [WeightRange], micro: MicroAdjustment? = nil)
    /// A plate-loaded machine's or loadable accessory's own weight.
    case base(kg: Double)
    /// Band inventory by color.
    case bands(options: [BandOption])
}

struct WeightOption: Codable, Hashable {
    var kg: Double
    /// `nil` means unlimited (plates' Set Qty).
    var count: Int?
    /// The unit the weight was entered in. Without one, the unit it reads as a whole quarter in decides.
    var unit: WeightUnit?

    init(kg: Double, count: Int? = nil, unit: WeightUnit? = nil) {
        self.kg = kg
        self.count = count
        self.unit = unit
    }

    var nativeUnit: WeightUnit? { unit ?? WeightUnit.native(toKg: kg) }
}

/// MF's Add Micro-Adjustments on a pin-loaded machine: the small weights that fine-tune a pin position.
struct MicroAdjustment: Codable, Hashable {
    enum Kind: String, Codable, CaseIterable {
        case dial, pin, plates
    }

    var kind: Kind
    var weightsKg: [Double]

    /// Every extra the adjustment adds to a pin position, 0 first: one weight at a time for a dial or a pin stack,
    /// any combination of the listed plates for plates.
    var extrasKg: [Double] {
        let weights = weightsKg.filter { $0 > 0 }
        switch kind {
        case .dial, .pin: return [0] + weights
        case .plates: return weights.reduce([0.0]) { sums, weight in sums + sums.map { $0 + weight } }
        }
    }
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
