import ImageIO
import SwiftUI

/// One of a supplement's pictures filling the square it is given, or the first letter of its name without one. The JPEG
/// is a file (`PictureFiles`), fetched once and decoded off main at the drawn pixel size; a cached decode shows in the
/// first frame. A picture neither this device nor the server holds yet is asked for again while it is on screen.
struct SupplementPicture: View {
    let image: UUID?
    let name: String
    var cornerRadius = Theme.smallCornerRadius

    @Environment(\.displayScale) private var displayScale
    @State private var side: CGFloat = 0
    @State private var loaded: (id: UUID, image: UIImage)?

    init(image: UUID?, name: String, cornerRadius: CGFloat = Theme.smallCornerRadius) {
        self.image = image
        self.name = name
        self.cornerRadius = cornerRadius
    }

    /// The supplement's first picture, the one lists show.
    init(_ supplement: Supplement, cornerRadius: CGFloat = Theme.smallCornerRadius) {
        self.init(image: supplement.images.first, name: supplement.name, cornerRadius: cornerRadius)
    }

    var body: some View {
        let request = image.flatMap { side > 0 ? SupplementPictures.Request(id: $0, pixels: Int((side * displayScale).rounded(.up))) : nil }
        let bitmap = image.flatMap { id in
            request.flatMap(SupplementPictures.cached)
                ?? loaded.flatMap { $0.id == id ? $0.image : nil }
                ?? SupplementPictures.latest(id)
        }
        Color.clear
            .overlay {
                if let bitmap {
                    Image(uiImage: bitmap).resizable().scaledToFill()
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
                while !Task.isCancelled {
                    if let data = await PictureFiles.shared.data(request.id) {
                        guard let bitmap = await SupplementPictures.decode(data, pixels: request.pixels) else { return }
                        SupplementPictures.store(bitmap, for: request)
                        loaded = (request.id, bitmap)
                        return
                    }
                    try? await Task.sleep(for: SupplementPictures.retryMissing)
                }
            }
            .accessibilityHidden(true)
    }
}

/// Decoded pictures by picture id and drawn size. A picture's bytes never change, so its id is the whole key, and a
/// replaced picture's bitmaps age out.
@MainActor
enum SupplementPictures {
    struct Request: Hashable, Sendable {
        let id: UUID
        let pixels: Int

        var cacheKey: String { "\(id)@\(pixels)" }
    }

    /// How long a missing picture waits before it is asked for again, as when the device is offline.
    static let retryMissing = Duration.seconds(30)

    private static let bySize: NSCache<NSString, UIImage> = {
        let cache = NSCache<NSString, UIImage>()
        cache.totalCostLimit = 24 * 1024 * 1024
        return cache
    }()

    /// The last decode of each picture at any size, shown while a view measures itself or decodes a new size.
    private static let byPicture: NSCache<NSString, UIImage> = {
        let cache = NSCache<NSString, UIImage>()
        cache.totalCostLimit = 8 * 1024 * 1024
        return cache
    }()

    static func cached(_ request: Request) -> UIImage? { bySize.object(forKey: request.cacheKey as NSString) }

    static func latest(_ id: UUID) -> UIImage? { byPicture.object(forKey: id.uuidString as NSString) }

    static func store(_ image: UIImage, for request: Request) {
        let cost = image.cgImage.map { $0.bytesPerRow * $0.height } ?? 0
        bySize.setObject(image, forKey: request.cacheKey as NSString, cost: cost)
        byPicture.setObject(image, forKey: request.id.uuidString as NSString, cost: cost)
    }

    /// Every picture asked for, in order, when all of them are on this device or the server: what an editor opens
    /// with. Nil when one is missing, so the editor keeps the stored pictures as they are.
    @concurrent nonisolated static func complete(_ ids: [UUID]) async -> [NewPicture]? {
        var pictures: [NewPicture] = []
        for id in ids {
            guard let jpeg = await PictureFiles.shared.data(id) else { return nil }
            pictures.append(NewPicture(id: id, jpeg: jpeg))
        }
        return pictures
    }

    /// The pictures as JPEG files Quick Look can page through, named after the supplement. A picture never changes, so
    /// its file is written once, in the temporary directory the system empties. One that cannot be read is left out.
    @concurrent nonisolated static func files(of ids: [UUID], named name: String) async -> [(id: UUID, url: URL)] {
        let folder = FileManager.default.temporaryDirectory.appending(path: "supplement-pictures")
        let title = name.replacing(/[\/:]/, with: " ")
        var files: [(id: UUID, url: URL)] = []
        for (index, id) in ids.enumerated() {
            let directory = folder.appending(path: id.uuidString.lowercased())
            let url = directory.appending(path: ids.count > 1 ? "\(title) \(index + 1).jpg" : "\(title).jpg")
            if FileManager.default.fileExists(atPath: url.path) {
                files.append((id, url))
                continue
            }
            guard let jpeg = await PictureFiles.shared.data(id) else { continue }
            do {
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                try jpeg.write(to: url)
                files.append((id, url))
            } catch {
                LocalStore.log.error("Writing a supplement picture for Quick Look failed: \(String(describing: error))")
            }
        }
        return files
    }

    /// A bitmap whose short side covers a `pixels` square, so filling it never upsamples or decodes on main.
    @concurrent nonisolated static func decode(_ data: Data, pixels: Int) async -> UIImage? {
        guard let source = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary),
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
