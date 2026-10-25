import Foundation

/// The profile every owner starts with, like MF's first "Your Gym".
enum GymSeed {
    /// Used only once a first sync found no gym, so two devices seeding at once converge on one row.
    static let gymID = UUID(uuidString: "6A7B1E5D-4C2F-4E1B-9B0D-5F3A2C8E7D10")!

    /// Inserts the seed gym when the store has none, after the first completed sync, so a new device never seeds beside
    /// a gym the server already has.
    @MainActor static func run(_ store: LocalStore, equipment: [EquipmentID: Equipment]) async {
        for await synced in Observations({ store.lastSyncedAt != nil }) where synced {
            break
        }
        guard !Task.isCancelled else { return }
        store.write { db in
            guard try GymProfile.fetchCount(db) == 0 else { return }
            let unit = try AppSettings.fetchOne(db, key: AppSettings.rowID)?.weightUnit ?? .lb
            var gym = GymProfile(name: "Your Gym", icon: GymTemplate.commercial.icon, equipment: GymTemplate.commercial.equipment(from: equipment, unit: unit))
            gym.id = gymID
            gym.isDefault = true
            try gym.insert(db)
        }
    }
}
