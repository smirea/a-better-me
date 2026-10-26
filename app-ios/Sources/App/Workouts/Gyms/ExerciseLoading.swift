import Foundation

/// What each exercise's chosen equipment loads in a gym, for the session's weight stepper and plate calculator and the
/// watch's Digital Crown. The live editor asks on every render, which every keypad tap causes, and an answer costs the
/// gym's availability, its loads, and plate math, so answers are kept until the settings, the exercise settings, the
/// custom exercises, or the gym change.
@MainActor
final class LoadingCache {
    struct Answer: Equatable {
        var loading: Loading?
        var loadable: LoadableWeights
    }

    private struct Context: Equatable {
        var settings: AppSettings
        var exerciseSettings: [ExerciseSettings]
        var custom: [Exercise]
    }

    private struct Item: Hashable {
        var exerciseID: ExerciseID
        var equipment: [EquipmentID]?
    }

    private struct GymAnswers {
        var gym: GymProfile?
        var availability: GymAvailability?
        var answers: [Item: Answer] = [:]
    }

    private var context: Context?
    private var gyms: [UUID?: GymAnswers] = [:]

    func answer(
        for item: BlockExercise, gym: GymProfile?, catalog: ExerciseCatalog, settings: AppSettings, exerciseSettings: [ExerciseSettings]
    ) -> Answer {
        let context = Context(settings: settings, exerciseSettings: exerciseSettings, custom: catalog.custom)
        if context != self.context {
            self.context = context
            gyms = [:]
        }
        var entry = gyms[gym?.id].flatMap { $0.gym == gym ? $0 : nil }
            ?? GymAnswers(gym: gym, availability: gym.map { GymAvailability(gym: $0, equipment: catalog.equipment) })
        let key = Item(exerciseID: item.exerciseID, equipment: item.equipment)
        if let hit = entry.answers[key] { return hit }
        let loading = Self.loading(of: item, gym: gym, availability: entry.availability, catalog: catalog, settings: settings, exerciseSettings: exerciseSettings)
        let answer = Answer(loading: loading, loadable: LoadableWeights(loading: loading, unit: settings.weightUnit))
        entry.answers[key] = answer
        gyms[gym?.id] = entry
        return answer
    }

    private static func loading(
        of item: BlockExercise, gym: GymProfile?, availability: GymAvailability?, catalog: ExerciseCatalog, settings: AppSettings,
        exerciseSettings: [ExerciseSettings]
    ) -> Loading? {
        guard let exercise = catalog.exercise(item.exerciseID),
              let weight = SetField.fields(for: exercise).first(where: \.isWeight),
              let option = exercise.chosenEquipment(item.equipment, in: availability) else { return nil }
        let overrides = ExerciseSettings.of(item.exerciseID, in: exerciseSettings)?.overrides
        let loads = GymLoads(gym: gym, overrides: overrides?.equipment ?? [:], catalog: catalog.equipment)
        return Loading.resolve(
            option: option, catalog: catalog.equipment, unit: settings.weightUnit, perSide: weight == .weight(perSide: true),
            calculator: gym.map { settings.workout.plateCalculator(for: $0.id) } ?? PlateCalculatorOptions(),
            barWeightKg: overrides?.barWeightKg ?? [:], load: loads.load
        )
    }
}
