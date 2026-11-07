import SwiftUI

extension SessionEditor {
    var sessionGym: GymProfile? {
        GymProfile.resolve(session.gymID, in: gyms)
    }

    var availability: GymAvailability? {
        sessionGym.map { GymAvailability(gym: $0, equipment: catalog.equipment) }
    }

    var calculatorOptions: PlateCalculatorOptions {
        sessionGym.map { defaults.workout.plateCalculator(for: $0.id) } ?? PlateCalculatorOptions()
    }

    func loading(for item: BlockExercise) -> Loading? {
        loadingAnswer(for: item).loading
    }

    func loadable(for item: BlockExercise) -> LoadableWeights {
        loadingAnswer(for: item).loadable
    }

    private func loadingAnswer(for item: BlockExercise) -> LoadingCache.Answer {
        loadings.answer(for: item, gym: sessionGym, catalog: catalog, settings: defaults, exerciseSettings: exerciseSettings)
    }

    func loading(at path: RowPath) -> Loading? {
        loading(for: blocks[path.block].exercises[path.exercise])
    }

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
            EquipmentSheet(
                exercise: exercise, availability: availability,
                choice: $blocks[position.block].exercises[position.exercise].equipment,
                support: $blocks[position.block].exercises[position.exercise].support
            ) {
                equipmentSettingsView()
            }
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
