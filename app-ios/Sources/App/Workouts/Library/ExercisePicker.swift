import SwiftUI

/// What the picker returns: the chosen exercises in selection order, and whether to group them ("Add as a superset?").
struct ExercisePick {
    var exerciseIDs: [ExerciseID]
    var asSuperset: Bool
}

enum ExercisePickerMode: Equatable {
    case add
    /// "Swapping with <name>": a single pick that replaces the given exercise.
    case swap(ExerciseID)
}

/// The full-height "add exercise" sheet. The builder and the live session present it; the library thread owns it.
/// Present it in a sheet; it dismisses itself after calling `onPick`.
struct ExercisePicker: View {
    let mode: ExercisePickerMode
    let onPick: (ExercisePick) -> Void

    var body: some View { ComingSoon(title: "Add Exercise") }
}

/// The Instructions · Details · History sheet. `action` adds the bottom button ("Add Exercise" from the picker).
struct ExerciseDetailSheet: View {
    let exerciseID: ExerciseID
    var action: (label: String, perform: () -> Void)?

    var body: some View { ComingSoon(title: "Exercise") }
}
