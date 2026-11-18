import GRDB
import ImageIO
import SwiftUI

/// One of a supplement's pictures filling the square it is given, or the first letter of its name without one. The JPEG
/// is read from `supplement_images` and decoded off main at the drawn pixel size; a cached decode shows in the first
/// frame. A sync can deliver the supplement a page before its picture, so the read waits for the row instead of giving up.
struct SupplementPicture: View {
    let image: UUID?
    let name: String
    var cornerRadius = Theme.smallCornerRadius

    @Environment(LocalStore.self) private var store
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
                guard let text = await SupplementPictures.jpeg(of: request.id, in: store.database.pool),
                      let bitmap = await SupplementPictures.decode(base64: text, pixels: request.pixels) else { return }
                SupplementPictures.store(bitmap, for: request)
                loaded = (request.id, bitmap)
            }
            .accessibilityHidden(true)
    }
}

/// Decoded pictures by picture id and drawn size. A picture's row is never rewritten, so its id is the whole key, and
/// a replaced picture's bitmaps age out.
@MainActor
enum SupplementPictures {
    struct Request: Hashable, Sendable {
        let id: UUID
        let pixels: Int

        var cacheKey: String { "\(id)@\(pixels)" }
    }

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

    /// The picture's base64 once its row is there, which a sync may deliver after the supplement. Nil when the wait
    /// is cancelled or the read fails.
    @concurrent nonisolated static func jpeg(of id: UUID, in pool: DatabasePool) async -> String? {
        let key = SupplementImage.key(id)
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

    /// Every picture asked for, in order, once all of their rows are on this device: what an editor opens with. A
    /// sync may deliver them after the supplement, so this waits. Nil when the wait is cancelled or the read fails.
    @concurrent nonisolated static func complete(_ ids: [UUID], in pool: DatabasePool) async -> [SupplementImage]? {
        let rows = ValueObservation.tracking { db in try ids.compactMap { try SupplementImage.fetchOne(db, key: SupplementImage.key($0)) } }
        do {
            for try await pictures in rows.values(in: pool) where pictures.count == ids.count { return pictures }
        } catch {
            LocalStore.log.error("Reading supplement pictures failed: \(String(describing: error))")
        }
        return nil
    }

    /// The pictures that are on this device now, in the order asked, which is what Quick Look can show.
    @concurrent nonisolated static func stored(_ ids: [UUID], in pool: DatabasePool) async -> [SupplementImage] {
        do {
            return try await pool.read { db in try ids.compactMap { try SupplementImage.fetchOne(db, key: SupplementImage.key($0)) } }
        } catch {
            LocalStore.log.error("Reading supplement pictures failed: \(String(describing: error))")
            return []
        }
    }

    /// The pictures as JPEG files Quick Look can page through, named after the supplement. A picture never changes, so
    /// its file is written once, in the temporary directory the system empties.
    @concurrent nonisolated static func files(of ids: [UUID], named name: String, in pool: DatabasePool) async -> [(id: UUID, url: URL)] {
        let folder = FileManager.default.temporaryDirectory.appending(path: "supplement-pictures")
        let title = name.replacing(/[\/:]/, with: " ")
        return await stored(ids, in: pool).enumerated().compactMap { index, picture in
            let directory = folder.appending(path: SupplementImage.key(picture.id))
            let url = directory.appending(path: ids.count > 1 ? "\(title) \(index + 1).jpg" : "\(title).jpg")
            if FileManager.default.fileExists(atPath: url.path) { return (picture.id, url) }
            do {
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                try picture.jpeg.write(to: url)
                return (picture.id, url)
            } catch {
                LocalStore.log.error("Writing a supplement picture for Quick Look failed: \(String(describing: error))")
                return nil
            }
        }
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
