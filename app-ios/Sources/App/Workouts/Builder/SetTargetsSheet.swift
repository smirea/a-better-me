import SwiftUI

/// The Targets sheet: set types, reps min and max, RIR, and per-set rest. The template editor and the live session's
/// Targets chip both present it; the builder thread owns it. Warm-up sets are offered only in the live session.
struct SetTargetsSheet: View {
    @Binding var exercise: BlockExercise
    let allowsWarmUp: Bool

    var body: some View { ComingSoon(title: "Targets") }
}
