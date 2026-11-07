import Foundation
import GRDB

extension LocalStore {
    /// Makes `id` the one default gym.
    func setDefaultGym(_ id: UUID) {
        write { db in
            for gym in try GymProfile.fetchAll(db) where gym.isDefault != (gym.id == id) {
                var changed = gym
                changed.isDefault = gym.id == id
                try changed.update(db, from: gym)
            }
        }
    }
}
