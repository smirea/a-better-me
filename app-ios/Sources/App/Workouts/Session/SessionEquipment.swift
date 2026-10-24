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

    func loading(for item: BlockExercise) -> Loading? {
        guard let exercise = catalog.exercise(item.exerciseID),
              let weight = SetField.fields(for: exercise).first(where: \.isWeight),
              let option = exercise.chosenEquipment(item.equipment, in: availability) else { return nil }
        let overrides = ExerciseSettings.of(item.exerciseID, in: exerciseSettings)?.overrides.equipment ?? [:]
        let loads = GymLoads(gym: sessionGym, overrides: overrides, catalog: catalog.equipment)
        return Loading.resolve(option: option, catalog: catalog.equipment, unit: unit, perSide: weight == .weight(perSide: true), load: loads.load)
    }

    func loading(at path: RowPath) -> Loading? {
        loading(for: blocks[path.block].exercises[path.exercise])
    }

    /// The calculator above the weight keypad, for plate-loaded equipment.
    @ViewBuilder
    func plateCalculator(for focus: KeypadFocus) -> some View {
        if focus.field.isWeight, blocks.contains(focus.row), let plates = loading(at: focus.row)?.plates {
            PlateCalculatorView(plan: plates.plan(for: Double(focus.text) ?? 0), unit: unit, isExpanded: store.platesExpanded)
        }
    }

    @ViewBuilder
    func equipmentSheet() -> some View {
        if let position = currentPosition,
           let exercise = catalog.exercise(blocks[position.block].exercises[position.exercise].exerciseID) {
            EquipmentSheet(exercise: exercise, availability: availability, choice: $blocks[position.block].exercises[position.exercise].equipment)
        }
    }
}
