import SwiftUI

/// The session's gym and what each exercise's chosen equipment loads in it, for the Equipment chip, the plate
/// calculator, and the weight stepper.
extension SessionEditor {
    /// The gym the session started at, or the default gym for a session without one or whose gym was removed.
    var sessionGym: GymProfile? {
        let id = session.gymID
        return gyms.first { $0.id == id } ?? defaultGym
    }

    var availability: GymAvailability? {
        sessionGym.map { GymAvailability(gym: $0, equipment: catalog.equipment) }
    }

    /// The session gym's calculator switches; every switch is off without a gym.
    var calculatorOptions: PlateCalculatorOptions {
        sessionGym.map { defaults.workout.plateCalculator(for: $0.id) } ?? PlateCalculatorOptions()
    }

    func loading(for item: BlockExercise) -> Loading? {
        guard let exercise = catalog.exercise(item.exerciseID),
              let weight = SetField.fields(for: exercise).first(where: \.isWeight),
              let option = exercise.chosenEquipment(item.equipment, in: availability) else { return nil }
        let overrides = ExerciseSettings.of(item.exerciseID, in: exerciseSettings)?.overrides
        let loads = GymLoads(gym: sessionGym, overrides: overrides?.equipment ?? [:], catalog: catalog.equipment)
        return Loading.resolve(
            option: option, catalog: catalog.equipment, unit: unit, perSide: weight == .weight(perSide: true),
            calculator: calculatorOptions, barWeightKg: overrides?.barWeightKg ?? [:], load: loads.load
        )
    }

    func loading(at path: RowPath) -> Loading? {
        loading(for: blocks[path.block].exercises[path.exercise])
    }

    /// The exercise's offset, only where the gym's Offset Weight is on.
    func plateOffset(of exerciseID: ExerciseID) -> PlateOffset? {
        guard calculatorOptions.offsetWeight else { return nil }
        return ExerciseSettings.of(exerciseID, in: exerciseSettings)?.overrides.plateOffset
    }

    /// The calculator above the weight keypad, for plate-loaded equipment. It loads the typed weight moved by the
    /// exercise's offset, and its bar menu writes the bar choice to the exercise's overrides.
    @ViewBuilder
    func plateCalculator(for focus: KeypadFocus) -> some View {
        if focus.field.isWeight, blocks.contains(focus.row), let plates = loading(at: focus.row)?.plates {
            let exerciseID = blocks[focus.row.block].exercises[focus.row.exercise].exerciseID
            let typed = Double(focus.text) ?? 0
            let offset = plateOffset(of: exerciseID)
            PlateCalculatorView(
                plan: plates.plan(for: offset?.applied(to: typed, unit: unit) ?? typed), unit: unit, isExpanded: store.platesExpanded,
                requested: typed, offset: offset, showsOffset: calculatorOptions.offsetWeight,
                onBar: { weight in
                    guard let baseID = plates.baseID else { return }
                    let kg = unit.toKg(weight)
                    localStore.modify(ExerciseSettings.self, id: exerciseID, orInsert: { ExerciseSettings(id: exerciseID) }) {
                        $0.overrides.barWeightKg = ($0.overrides.barWeightKg ?? [:]).merging([baseID: kg]) { $1 }
                    }
                },
                onOffset: { sheet = .equipmentSettings }
            )
        }
    }

    @ViewBuilder
    func equipmentSheet() -> some View {
        if let position = currentPosition,
           let exercise = catalog.exercise(blocks[position.block].exercises[position.exercise].exerciseID) {
            EquipmentSheet(exercise: exercise, availability: availability, choice: $blocks[position.block].exercises[position.exercise].equipment)
        }
    }

    /// The Equipment sheet's sliders button and the calculator's offset chip: this exercise's bar, offset, and weights.
    @ViewBuilder
    func equipmentSettingsView() -> some View {
        if let position = currentPosition {
            let item = blocks[position.block].exercises[position.exercise]
            EquipmentSettingsView(exerciseID: item.exerciseID, loading: loading(for: item), offsetEnabled: calculatorOptions.offsetWeight)
        }
    }
}
