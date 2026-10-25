import SwiftUI

/// `scripts/body.svg`, the reference app's front and back figures side by side, flattened by `scripts/catalog.ts`
/// into `body.json`. Levels crops it to one side and each muscle tile to that muscle's square.
struct BodyFigure {
    enum Region {
        case silhouette, bone, muscle(Muscle)
    }

    struct Part {
        let region: Region
        let path: Path
    }

    let parts: [Part]
    let front: CGRect
    let back: CGRect
    let tiles: [Muscle: CGRect]

    func side(_ side: BodySide) -> CGRect { side == .front ? front : back }

    static let shared = load()

    // Dark-theme stand-ins for the reference app's light figure grays.
    static let silhouette = Color(hex: 0x2E2E2E)
    static let muscleBase = Color(hex: 0x4A4A4A)

    private struct File: Decodable {
        struct Path: Decodable {
            let region: String
            /// Each subpath is its start `[x, y]`, then `[x, y]` lines and `[x1, y1, x2, y2, x, y]` cubic curves.
            let subpaths: [[[Double]]]
        }

        let front: [Double]
        let back: [Double]
        let tiles: [String: [Double]]
        let parts: [Path]
    }

    private static func load() -> BodyFigure {
        guard let url = Bundle.main.url(forResource: "body", withExtension: "json") else {
            fatalError("Missing body.json. Regenerate it with `bun app-ios/scripts/catalog.ts`.")
        }
        let file: File
        do {
            file = try JSONDecoder().decode(File.self, from: Data(contentsOf: url))
        } catch {
            fatalError("body.json does not match its Swift type: \(error)")
        }
        return BodyFigure(
            parts: file.parts.map(part),
            front: rect(file.front),
            back: rect(file.back),
            tiles: Dictionary(uniqueKeysWithValues: file.tiles.map { name, box in
                guard let muscle = Muscle(rawValue: name) else { fatalError("body.json has a tile for unknown muscle \(name)") }
                return (muscle, rect(box))
            })
        )
    }

    private static func rect(_ box: [Double]) -> CGRect {
        guard box.count == 4 else { fatalError("body.json has a \(box.count)-value view box") }
        return CGRect(x: box[0], y: box[1], width: box[2], height: box[3])
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
        for subpath in source.subpaths {
            path.move(to: point(subpath[0][...]))
            for segment in subpath.dropFirst() {
                switch segment.count {
                case 2: path.addLine(to: point(segment[...]))
                case 6: path.addCurve(to: point(segment[4...]), control1: point(segment[0...]), control2: point(segment[2...]))
                default: fatalError("body.json has a \(segment.count)-value segment")
                }
            }
            path.closeSubpath()
        }
        return Part(region: region, path: path)
    }
}

/// The body figure cropped to `crop`, a rectangle in `body.svg` coordinates, with each region filled by `fill`.
struct BodyCrop: View {
    let crop: CGRect
    let fill: (BodyFigure.Region) -> Color

    var body: some View {
        let figure = BodyFigure.shared
        ZStack {
            ForEach(figure.parts.indices, id: \.self) { index in
                let part = figure.parts[index]
                if part.path.boundingRect.intersects(crop) {
                    CroppedShape(path: part.path, crop: crop).fill(fill(part.region))
                }
            }
        }
        .aspectRatio(crop.size, contentMode: .fit)
        .clipped()
        .accessibilityHidden(true)
    }
}

private struct CroppedShape: Shape {
    let path: Path
    let crop: CGRect

    func path(in rect: CGRect) -> Path {
        path.applying(CGAffineTransform(translationX: rect.minX, y: rect.minY)
            .scaledBy(x: rect.width / crop.width, y: rect.height / crop.height)
            .translatedBy(x: -crop.minX, y: -crop.minY))
    }
}
