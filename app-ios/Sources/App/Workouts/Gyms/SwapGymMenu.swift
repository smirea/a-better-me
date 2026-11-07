import SwiftUI

/// Workout Options > Swap Gym for Workout: the gym a template's sessions start at. A template without one starts at
/// the default gym, so the default gym is checked until another is picked.
struct SwapGymMenu: View {
    let templateID: WorkoutTemplate.ID
    let gymID: UUID?
    @Environment(LocalStore.self) private var store
    @Observe(GymProfile.all) private var gyms

    var body: some View {
        let current = GymProfile.resolve(gymID, in: gyms)
        Menu {
            Picker("Gym", selection: Binding { current?.id } set: { id in store.edit(WorkoutTemplate.self, id: templateID) { $0.gymID = id } }) {
                ForEach(gyms) { gym in
                    Label(gym.name, systemImage: gym.icon).tag(Optional(gym.id))
                }
            }
        } label: {
            Label("Swap Gym for Workout", systemImage: "building.2")
            Text(current?.name ?? "No gym")
        }
    }
}
