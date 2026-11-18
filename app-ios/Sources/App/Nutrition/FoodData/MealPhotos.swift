import Foundation
import ImageIO
import UniformTypeIdentifiers

enum MealPhotoImage {
    /// Long side in pixels. Gemini bills an image by its tiles, and 1024 keeps a plate's foods legible.
    static let maxPixels = 1024

    /// Any photo the picker or camera gives (HEIC, JPEG, PNG) as an upright JPEG no longer than `maxPixels`, decoded at
    /// that size so a 48 MP photo never lands in memory whole. Nil when the data is not an image.
    static func jpeg(from data: Data, maxPixels: Int = maxPixels) -> Data? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixels,
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
        let output = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(output, UTType.jpeg.identifier as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: 0.7] as CFDictionary)
        guard CGImageDestinationFinalize(destination) else { return nil }
        return output as Data
    }
}
