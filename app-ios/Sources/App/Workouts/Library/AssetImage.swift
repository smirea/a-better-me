import ImageIO
import SwiftUI
import UIKit

/// One of an exercise's position frames, or a placeholder until `AssetStore` downloads it.
struct ExerciseImage: View {
    let exercise: Exercise
    var frame = 0

    var body: some View {
        AssetImage(path: exercise.images[safe: frame].map { "ExerciseImages/\($0).webp" }, contentMode: .fill) {
            ZStack {
                Theme.surfaceRaised
                Image(systemName: "figure.strengthtraining.traditional")
                    .font(.system(size: 24))
                    .foregroundStyle(Theme.textTertiary)
            }
        }
    }
}

struct EquipmentImage: View {
    let equipmentID: String

    var body: some View {
        AssetImage(path: "EquipmentImages/\(equipmentID).webp", contentMode: .fit) {
            Image(systemName: "dumbbell").resizable().scaledToFit().foregroundStyle(Theme.textTertiary).padding(4)
        }
    }
}

/// A downloaded image, decoded off main at the pixel size it is drawn at and filling the space it is offered. A cached
/// decode shows in the first frame; otherwise the placeholder stays until the decode is ready.
struct AssetImage<Placeholder: View>: View {
    let path: String?
    let contentMode: ContentMode
    @ViewBuilder var placeholder: Placeholder
    @Environment(\.displayScale) private var displayScale
    @State private var size = CGSize.zero
    @State private var loaded: (path: String, image: UIImage)?

    var body: some View {
        // `AssetStore.url` is a dictionary lookup that also re-renders this view when a missing file arrives.
        let url = path.flatMap { AssetStore.shared.url($0) }
        let request = url.flatMap { url in path.flatMap { ImageRequest(path: $0, url: url, size: size, scale: displayScale, contentMode: contentMode) } }
        let image = url == nil ? nil : request.flatMap(DownsampledImages.cached)
            ?? loaded.flatMap { $0.path == path ? $0.image : nil }
            ?? path.flatMap(DownsampledImages.latest)
        Color.clear
            .overlay {
                if let image {
                    Image(uiImage: image).resizable().aspectRatio(contentMode: contentMode)
                } else {
                    placeholder
                }
            }
            .onGeometryChange(for: CGSize.self, of: \.size) { size = $0 }
            .task(id: request) {
                guard let request, DownsampledImages.cached(request) == nil,
                      let image = await DownsampledImages.decode(request) else { return }
                DownsampledImages.store(image, for: request)
                loaded = (request.path, image)
            }
    }
}

struct ImageRequest: Hashable, Sendable {
    let path: String
    let url: URL
    /// The drawn size in pixels, rounded up.
    let width: Int
    let height: Int
    let fills: Bool

    init?(path: String, url: URL, size: CGSize, scale: CGFloat, contentMode: ContentMode) {
        guard size.width > 0, size.height > 0 else { return nil }
        self.path = path
        self.url = url
        width = Int((size.width * scale).rounded(.up))
        height = Int((size.height * scale).rounded(.up))
        fills = contentMode == .fill
    }

    var cacheKey: String { "\(path)@\(width)x\(height)\(fills ? "f" : "")" }

    /// The longest side, in pixels, that a `width` by `height` source needs so that, scaled to fill or fit the drawn
    /// size, it is never upsampled. Never larger than the source.
    static func maxPixelSize(sourceWidth: Int, sourceHeight: Int, width: Int, height: Int, fills: Bool) -> Int {
        let longest = max(sourceWidth, sourceHeight)
        let forWidth = (width * longest + sourceWidth - 1) / sourceWidth
        let forHeight = (height * longest + sourceHeight - 1) / sourceHeight
        return min(longest, fills ? max(forWidth, forHeight) : min(forWidth, forHeight))
    }
}

/// Decoded images by path and drawn size. Bitmaps cost their byte size, so the limit bounds memory, not count.
@MainActor
enum DownsampledImages {
    private static let bySize: NSCache<NSString, UIImage> = {
        let cache = NSCache<NSString, UIImage>()
        cache.totalCostLimit = 48 * 1024 * 1024
        return cache
    }()

    /// The last decode of each path at any size, shown while a view measures itself or decodes a new size.
    private static let byPath: NSCache<NSString, UIImage> = {
        let cache = NSCache<NSString, UIImage>()
        cache.totalCostLimit = 16 * 1024 * 1024
        return cache
    }()

    static func cached(_ request: ImageRequest) -> UIImage? { bySize.object(forKey: request.cacheKey as NSString) }

    static func latest(_ path: String) -> UIImage? { byPath.object(forKey: path as NSString) }

    static func store(_ image: UIImage, for request: ImageRequest) {
        let cost = image.cgImage.map { $0.bytesPerRow * $0.height } ?? 0
        bySize.setObject(image, forKey: request.cacheKey as NSString, cost: cost)
        byPath.setObject(image, forKey: request.path as NSString, cost: cost)
    }

    /// Decodes the thumbnail into a bitmap here, so drawing it on main never decodes.
    @concurrent nonisolated static func decode(_ request: ImageRequest) async -> UIImage? {
        guard let source = CGImageSourceCreateWithURL(request.url as CFURL, [kCGImageSourceShouldCache: false] as CFDictionary),
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let sourceWidth = properties[kCGImagePropertyPixelWidth] as? Int,
              let sourceHeight = properties[kCGImagePropertyPixelHeight] as? Int,
              sourceWidth > 0, sourceHeight > 0 else { return nil }
        let maxPixelSize = ImageRequest.maxPixelSize(
            sourceWidth: sourceWidth, sourceHeight: sourceHeight, width: request.width, height: request.height, fills: request.fills
        )
        let options = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixelSize,
        ] as CFDictionary
        return CGImageSourceCreateThumbnailAtIndex(source, 0, options).map { UIImage(cgImage: $0) }
    }
}
