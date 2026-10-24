import Foundation

/// The profile every owner starts with, like MF's first "Your Gym".
enum GymSeed {
    /// Fixed, so two devices that both seed before syncing converge on one row instead of two "Your Gym"s.
    static let gymID = UUID(uuidString: "6A7B1E5D-4C2F-4E1B-9B0D-5F3A2C8E7D10")!

    /// Inserts the seed gym when the store has none. With a token it first waits for a completed sync, so a new
    /// device never seeds beside a gym the server already has.
    @MainActor static func run(_ store: LocalStore, equipment: [EquipmentID: Equipment]) async {
        for await ready in Observations({ !store.hasToken || store.lastSyncedAt != nil }) where ready {
            break
        }
        guard !Task.isCancelled else { return }
        var gym = GymProfile(name: "Your Gym", icon: GymTemplate.commercial.icon, equipment: GymTemplate.commercial.equipment(from: equipment))
        gym.id = gymID
        gym.isDefault = true
        let seed = gym
        store.write { db in
            guard try GymProfile.fetchCount(db) == 0 else { return }
            try seed.insert(db)
        }
    }
}
