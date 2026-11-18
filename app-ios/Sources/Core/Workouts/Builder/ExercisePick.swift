import Foundation

/// What the picker returns: the chosen exercises in selection order, and whether to group them ("Add as a superset?").
struct ExercisePick {
    var exerciseIDs: [ExerciseID]
    var asSuperset: Bool
}
