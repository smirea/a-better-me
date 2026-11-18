import GRDB
import ImageIO
import SwiftUI

/// A supplement's picture filling the square it is given, or the first letter of its name without one. The JPEG is read
/// from `supplement_images` and decoded off main at the drawn pixel size; a cached decode shows in the first frame.
/// A sync can deliver the supplement a page before its picture, so the read waits for the row instead of giving up.
struct SupplementPicture: View {
    let id: UUID
    let imageAt: Date?
    let name: String
    var cornerRadius = Theme.smallCornerRadius

    @Environment(LocalStore.self) private var store
    @Environment(\.displayScale) private var displayScale
    @State private var side: CGFloat = 0
    @State private var loaded: (version: String, image: UIImage)?

    init(id: UUID, imageAt: Date?, name: String, cornerRadius: CGFloat = Theme.smallCornerRadius) {
        self.id = id
        self.imageAt = imageAt
        self.name = name
        self.cornerRadius = cornerRadius
    }

    init(_ supplement: Supplement, cornerRadius: CGFloat = Theme.smallCornerRadius) {
        self.init(id: supplement.id, imageAt: supplement.imageAt, name: supplement.name, cornerRadius: cornerRadius)
    }

    var body: some View {
        let version = imageAt.map { "\(Supplement.key(id))@\(Instant.text($0))" }
        let request = version.flatMap { side > 0 ? SupplementPictures.Request(version: $0, id: id, pixels: Int((side * displayScale).rounded(.up))) : nil }
        let image = version.flatMap { version in
            request.flatMap(SupplementPictures.cached)
                ?? loaded.flatMap { $0.version == version ? $0.image : nil }
                ?? SupplementPictures.latest(version)
        }
        Color.clear
            .overlay {
                if let image {
                    Image(uiImage: image).resizable().scaledToFill()
                } else {
                    Theme.surfaceRaised.overlay {
                        Text(name.trimmingCharacters(in: .whitespaces).prefix(1).uppercased())
                            .font(AppFont.headline(max(12, side * 0.4)))
                            .foregroundStyle(Theme.textSecondary)
                    }
                }
            }
            .clipShape(.rect(cornerRadius: cornerRadius))
            .onGeometryChange(for: CGFloat.self) { min($0.size.width, $0.size.height) } action: { side = $0 }
            .task(id: request) {
                guard let request, SupplementPictures.cached(request) == nil else { return }
                guard let text = await SupplementPictures.jpeg(of: request.id, in: store.database.pool),
                      let image = await SupplementPictures.decode(base64: text, pixels: request.pixels) else { return }
                SupplementPictures.store(image, for: request)
                loaded = (request.version, image)
            }
            .accessibilityHidden(true)
    }
}

/// Decoded pictures by version and drawn size. A version is the supplement's id and `imageAt`, so a replaced picture
/// is a new key and the old bitmaps age out.
@MainActor
enum SupplementPictures {
    struct Request: Hashable, Sendable {
        let version: String
        let id: UUID
        let pixels: Int

        var cacheKey: String { "\(version)@\(pixels)" }
    }

    private static let bySize: NSCache<NSString, UIImage> = {
        let cache = NSCache<NSString, UIImage>()
        cache.totalCostLimit = 24 * 1024 * 1024
        return cache
    }()

    /// The last decode of each version at any size, shown while a view measures itself or decodes a new size.
    private static let byVersion: NSCache<NSString, UIImage> = {
        let cache = NSCache<NSString, UIImage>()
        cache.totalCostLimit = 8 * 1024 * 1024
        return cache
    }()

    static func cached(_ request: Request) -> UIImage? { bySize.object(forKey: request.cacheKey as NSString) }

    static func latest(_ version: String) -> UIImage? { byVersion.object(forKey: version as NSString) }

    static func store(_ image: UIImage, for request: Request) {
        let cost = image.cgImage.map { $0.bytesPerRow * $0.height } ?? 0
        bySize.setObject(image, forKey: request.cacheKey as NSString, cost: cost)
        byVersion.setObject(image, forKey: request.version as NSString, cost: cost)
    }

    /// The picture's base64 once its row is there, which a sync may deliver after the supplement. Nil when the wait
    /// is cancelled or the read fails.
    @concurrent nonisolated static func jpeg(of id: UUID, in pool: DatabasePool) async -> String? {
        let key = Supplement.key(id)
        let rows = ValueObservation.tracking {
            try String.fetchOne($0, sql: "SELECT jpeg FROM supplement_images WHERE id = ?", arguments: [key])
        }
        do {
            for try await text in rows.values(in: pool) {
                if let text { return text }
            }
        } catch {
            LocalStore.log.error("Reading a supplement picture failed: \(String(describing: error))")
        }
        return nil
    }

    /// A bitmap whose short side covers a `pixels` square, so filling it never upsamples or decodes on main.
    @concurrent nonisolated static func decode(base64: String, pixels: Int) async -> UIImage? {
        guard let data = Data(base64Encoded: base64),
              let source = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary),
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let width = properties[kCGImagePropertyPixelWidth] as? Int,
              let height = properties[kCGImagePropertyPixelHeight] as? Int,
              width > 0, height > 0 else { return nil }
        let options = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: ImageRequest.maxPixelSize(sourceWidth: width, sourceHeight: height, width: pixels, height: pixels, fills: true),
        ] as CFDictionary
        return CGImageSourceCreateThumbnailAtIndex(source, 0, options).map { UIImage(cgImage: $0) }
    }
}
