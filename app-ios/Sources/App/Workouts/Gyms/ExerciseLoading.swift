import Foundation

extension Loading {
    /// What an exercise's chosen equipment loads in `gym`, for the session's weight stepper and plate calculator and the
    /// watch's Digital Crown.
    @MainActor static func of(
        _ item: BlockExercise, gym: GymProfile?, catalog: ExerciseCatalog, settings: AppSettings, exerciseSettings: [ExerciseSettings]
    ) -> Loading? {
        let availability = gym.map { GymAvailability(gym: $0, equipment: catalog.equipment) }
        guard let exercise = catalog.exercise(item.exerciseID),
              let weight = SetField.fields(for: exercise).first(where: \.isWeight),
              let option = exercise.chosenEquipment(item.equipment, in: availability) else { return nil }
        let overrides = ExerciseSettings.of(item.exerciseID, in: exerciseSettings)?.overrides
        let loads = GymLoads(gym: gym, overrides: overrides?.equipment ?? [:], catalog: catalog.equipment)
        return resolve(
            option: option, catalog: catalog.equipment, unit: settings.weightUnit, perSide: weight == .weight(perSide: true),
            calculator: gym.map { settings.workout.plateCalculator(for: $0.id) } ?? PlateCalculatorOptions(),
            barWeightKg: overrides?.barWeightKg ?? [:], load: loads.load
        )
    }
}
