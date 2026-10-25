import SwiftUI

enum BodySide {
    case front, back

    mutating func toggle() { self = self == .front ? .back : .front }
}

/// The whole-body figure with each muscle filled blue in proportion to its value, as on the Levels tab and the
/// Workout Complete summary. A muscle reaches full blue at `fullAt`; any value above zero gets a visible tint.
struct BodyMap: View {
    let values: [Muscle: Double]
    let side: BodySide
    var fullAt: Double = 10

    var body: some View {
        BodyCrop(crop: BodyFigure.shared.side(side)) { region in
            switch region {
            case .silhouette: BodyFigure.silhouette
            case .bone: BodyFigure.muscleBase
            case .muscle(let muscle):
                if let value = values[muscle], value > 0 {
                    BodyFigure.muscleBase.mix(with: Theme.muscle, by: 0.35 + 0.65 * min(value / fullAt, 1))
                } else {
                    BodyFigure.muscleBase
                }
            }
        }
    }
}
