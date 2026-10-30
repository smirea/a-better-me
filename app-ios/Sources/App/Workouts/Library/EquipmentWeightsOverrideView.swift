import SwiftUI

/// Exercise Overrides > Equipment Weights: per-item loads for one exercise that replace the gym profile's. Only items
/// that carry a load are listed; availability still comes from the gym.
struct EquipmentWeightsOverrideView: View {
    let exerciseID: ExerciseID
    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(LocalStore.self) private var store
    @Observe private var current: ExerciseSettings?
    @Observe(GymProfile.defaultGym) private var gym
    @Observe(AppSettings.current) private var settings
    @State private var editing: Equipment?

    init(exerciseID: ExerciseID) {
        self.exerciseID = exerciseID
        _current = Observe(ExerciseSettings.one(exerciseID))
    }

    var body: some View {
        let exercise = catalog.exercise(exerciseID)
        let overrides = current?.overrides.equipment ?? [:]
        let unit = settings.weightUnit
        Form {
            Section {
                Label {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("This impacts your workouts").font(AppFont.rowTitle)
                        Text("Settings below will override your gym profile weights for this exercise. Equipment availability is still determined by the profile.")
                            .font(AppFont.rowDetail)
                            .foregroundStyle(Theme.textSecondary)
                    }
                } icon: {
                    Image(systemName: "info.circle.fill")
                }
                .listRowBackground(Theme.accent.opacity(0.25))
            }
            ThemedSection("\(exercise?.name ?? "Exercise") Weights") {
                ForEach(items(of: exercise)) { item in
                    HStack(spacing: 14) {
                        EquipmentImage(equipmentID: item.id).frame(width: 32, height: 32)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.name).font(AppFont.rowTitle)
                            Text(overrides[item.id]?.summary(in: unit) ?? "Default")
                                .font(AppFont.rowDetail)
                                .foregroundStyle(Theme.textSecondary)
                                .lineLimit(2)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        Button("Edit") { editing = item }
                            .chipButton()
                            .controlSize(.small)
                    }
                }
            }
        }
        .themedList()
        .detailTitle("Weights")
        .sheet(item: $editing) { item in
            if let load = overrides[item.id] ?? gym.flatMap({ GymDefaults.effectiveLoad(item.id, in: $0) }) ?? GymDefaults.load(for: item.id) {
                EquipmentLoadEditor(equipment: item, load: load, unit: unit) { save($0, for: item.id) }
            }
        }
    }

    private func items(of exercise: Exercise?) -> [Equipment] {
        guard let exercise else { return [] }
        let listing = GymCatalog(catalog.equipment)
        var seen = Set<EquipmentID>()
        return exercise.resistanceEquipmentIDs.joined()
            .map(listing.listedID)
            .filter { seen.insert($0).inserted && GymDefaults.load(for: $0) != nil }
            .compactMap { catalog.equipment[$0] }
    }

    /// An empty map is stored as nil, so clearing the last item leaves the row unmodified.
    private func save(_ load: EquipmentLoad?, for id: EquipmentID) {
        store.modify(ExerciseSettings.self, id: exerciseID, orInsert: { ExerciseSettings(id: exerciseID) }) {
            var equipment = $0.overrides.equipment ?? [:]
            equipment[id] = load
            $0.overrides.equipment = equipment.isEmpty ? nil : equipment
        }
    }
}
