import Foundation

/// What a gym provides. Exercises name singular items ("Dumbbell") while a gym lists the plural ("Dumbbells"), and
/// the one Bodyweight item ("Bodyweight Only") is never listed because every gym has it.
struct GymAvailability {
    private let provided: Set<EquipmentID>

    init(gym: GymProfile, equipment: [EquipmentID: Equipment]) {
        var provided = Set(gym.equipment.keys)
        for id in gym.equipment.keys {
            if let singular = equipment[id]?.pluralOf { provided.insert(singular) }
        }
        for item in equipment.values where item.category == GymCatalog.alwaysAvailableCategory {
            provided.insert(item.id)
        }
        self.provided = provided
    }

    func provides(_ id: EquipmentID) -> Bool { provided.contains(id) }

    /// Some resistance option and some support option are fully provided. An exercise with no options of a kind
    /// needs nothing of it.
    func isAvailable(_ exercise: Exercise) -> Bool {
        func satisfied(_ options: [[EquipmentID]]) -> Bool {
            options.isEmpty || options.contains { $0.allSatisfy(provides) }
        }
        return satisfied(exercise.resistanceEquipmentIDs) && satisfied(exercise.supportEquipmentIDs)
    }

    static func isAvailable(_ exercise: Exercise, in gym: GymProfile, equipment: [EquipmentID: Equipment]) -> Bool {
        GymAvailability(gym: gym, equipment: equipment).isAvailable(exercise)
    }
}

/// The items a gym profile lists: every catalog item except the singulars that have a plural and the always-available
/// Bodyweight item.
struct GymCatalog {
    static let alwaysAvailableCategory = "Bodyweight"

    let items: [Equipment]
    private let pluralOfSingular: [EquipmentID: EquipmentID]

    init(_ equipment: [EquipmentID: Equipment]) {
        pluralOfSingular = Dictionary(equipment.values.compactMap { item in item.pluralOf.map { ($0, item.id) } }) { first, _ in first }
        let singulars = pluralOfSingular
        items = equipment.values
            .filter { singulars[$0.id] == nil && $0.category != Self.alwaysAvailableCategory }
            .sorted {
                let (left, right) = (EquipmentCategoryOrder.index($0.category), EquipmentCategoryOrder.index($1.category))
                return left != right ? left < right : $0.name.localizedStandardCompare($1.name) == .orderedAscending
            }
    }

    func listedID(_ id: EquipmentID) -> EquipmentID { pluralOfSingular[id] ?? id }
}
