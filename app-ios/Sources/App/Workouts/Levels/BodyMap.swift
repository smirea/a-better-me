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
        let figure = BodyFigure.shared
        ZStack {
            ForEach(figure.parts(side).indices, id: \.self) { index in
                let part = figure.parts(side)[index]
                FigureShape(path: part.path, size: figure.size).fill(color(part.region))
            }
        }
        .aspectRatio(figure.size, contentMode: .fit)
        .accessibilityHidden(true)
    }

    private func color(_ region: BodyFigure.Region) -> Color {
        switch region {
        case .silhouette: return Self.silhouette
        case .bone: return Self.muscleBase
        case .muscle(let muscle):
            guard let value = values[muscle], value > 0 else { return Self.muscleBase }
            return Self.muscleBase.mix(with: Theme.muscle, by: 0.35 + 0.65 * min(value / fullAt, 1))
        }
    }

    // The grays `scripts/catalog.ts` swaps into the muscle tiles, so the figure and the tiles match.
    private static let silhouette = Color(hex: 0x2E2E2E)
    private static let muscleBase = Color(hex: 0x4A4A4A)
}

private struct FigureShape: Shape {
    let path: Path
    let size: CGSize

    func path(in rect: CGRect) -> Path {
        path.applying(CGAffineTransform(translationX: rect.minX, y: rect.minY)
            .scaledBy(x: rect.width / size.width, y: rect.height / size.height))
    }
}

/// The reference app's `avatar_male_{front,back}.svg`, flattened by `scripts/catalog.ts` into `body.json`.
private struct BodyFigure {
    enum Region {
        case silhouette, bone, muscle(Muscle)
    }

    struct Part {
        let region: Region
        let path: Path
    }

    let size: CGSize
    let front: [Part]
    let back: [Part]

    func parts(_ side: BodySide) -> [Part] { side == .front ? front : back }

    static let shared = load()

    private struct File: Decodable {
        struct Path: Decodable {
            let region: String
            let start: [Double]
            /// `[x, y]` lines and `[x1, y1, x2, y2, x, y]` cubic curves.
            let segments: [[Double]]
        }

        let width: Double
        let height: Double
        let front: [Path]
        let back: [Path]
    }

    private static func load() -> BodyFigure {
        let file: File = ExerciseCatalog.load("body")
        return BodyFigure(
            size: CGSize(width: file.width, height: file.height),
            front: file.front.map(part),
            back: file.back.map(part)
        )
    }

    private static func part(_ source: File.Path) -> Part {
        let region: Region
        switch source.region {
        case "body": region = .silhouette
        case "bone": region = .bone
        default:
            guard let muscle = Muscle(rawValue: source.region) else { fatalError("body.json names unknown muscle \(source.region)") }
            region = .muscle(muscle)
        }
        let point = { (values: ArraySlice<Double>) in CGPoint(x: values[values.startIndex], y: values[values.startIndex + 1]) }
        var path = Path()
        path.move(to: point(source.start[...]))
        for segment in source.segments {
            switch segment.count {
            case 2: path.addLine(to: point(segment[...]))
            case 6: path.addCurve(to: point(segment[4...]), control1: point(segment[0...]), control2: point(segment[2...]))
            default: fatalError("body.json has a \(segment.count)-value segment")
            }
        }
        path.closeSubpath()
        return Part(region: region, path: path)
    }
}
