import Foundation

/// The profile every owner starts with, like MF's first "Your Gym".
enum GymSeed {
    /// Used only once a first sync found no gym, so two devices seeding at once converge on one row.
    static let gymID = UUID(uuidString: "6A7B1E5D-4C2F-4E1B-9B0D-5F3A2C8E7D10")!

    /// Inserts the seed gym when the store has none. With a token it first waits for a completed sync, so a new
    /// device never seeds beside a gym the server already has. Without one it seeds under a fresh id: the upload is a
    /// whole-row put, so a shared id would replace another device's edited gym once this device pairs, and a duplicate
    /// the owner can remove is the lesser harm.
    @MainActor static func run(_ store: LocalStore, equipment: [EquipmentID: Equipment]) async {
        for await ready in Observations({ !store.hasToken || store.lastSyncedAt != nil }) where ready {
            break
        }
        guard !Task.isCancelled else { return }
        var gym = GymProfile(name: "Your Gym", icon: GymTemplate.commercial.icon, equipment: GymTemplate.commercial.equipment(from: equipment))
        if store.hasToken { gym.id = gymID }
        gym.isDefault = true
        let seed = gym
        store.write { db in
            guard try GymProfile.fetchCount(db) == 0 else { return }
            try seed.insert(db)
        }
    }
}
