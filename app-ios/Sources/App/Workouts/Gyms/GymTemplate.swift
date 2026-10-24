import Foundation

/// The gym types Add New Gym Profile offers. Each but Everything starts from the catalog's matching preset flags.
enum GymTemplate: String, CaseIterable, Identifiable {
    case commercial, warehouse, local, garage, home, everything

    var id: String { rawValue }

    var title: String {
        switch self {
        case .commercial: "Commercial Gym"
        case .warehouse: "Warehouse Gym"
        case .local: "Local Gym"
        case .garage: "Garage Gym"
        case .home: "Home Gym"
        case .everything: "Everything Gym"
        }
    }

    /// MF's strings, except Commercial: the binary has no description for it, so ours is written to match.
    var summary: String {
        switch self {
        case .commercial: "A fully equipped gym with free weights, cable machines, and plate- and pin-loaded machines"
        case .warehouse: "A strength-focused space with racks, barbells, plates, benches, and some machines"
        case .local: "Gym with essential equipment like racks, barbells, plates, benches, and cable machines"
        case .garage: "A home setup with a rack, barbell, plates, a bench, and dumbbells"
        case .home: "A compact space with dumbbells, kettlebells, bands, and household furniture"
        case .everything: "A gym that includes every piece of equipment"
        }
    }

    var icon: String {
        switch self {
        case .commercial, .local: "building.2.fill"
        case .warehouse: "building.columns.fill"
        case .garage, .home: "house.fill"
        case .everything: "star.fill"
        }
    }

    private var preset: GymPreset? {
        switch self {
        case .commercial: .commercial
        case .warehouse: .warehouse
        case .local: .local
        case .garage: .garage
        case .home: .home
        case .everything: nil
        }
    }

    /// Selected items with the catalog's default loads. A flag on a singular selects the plural the gym lists.
    func equipment(from catalog: [EquipmentID: Equipment]) -> [EquipmentID: GymEquipment] {
        let gymCatalog = GymCatalog(catalog)
        let listed = Set(gymCatalog.items.map(\.id))
        let ids: Set<EquipmentID> = if let preset {
            Set(catalog.values.filter { $0.gymPresets.contains(preset) }.map { gymCatalog.listedID($0.id) }).intersection(listed)
        } else {
            listed
        }
        return Dictionary(uniqueKeysWithValues: ids.map { ($0, GymEquipment(load: nil)) })
    }
}
