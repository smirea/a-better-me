import Foundation
import ImageIO
import UniformTypeIdentifiers

/// One food the server's photo model saw: what to call it, the generic name to search the food database for, and its
/// edible weight. The model never estimates nutrition; the logger matches `search` and scales by `grams`.
struct RecognizedFood: Codable, Hashable, Sendable {
    var name: String
    var search: String
    var grams: Double
    var confidence: Double
}

/// Names the foods in a meal photo. The phone reaches Gemini only through our server (`server/src/food/mealPhoto.ts`),
/// which holds the key.
protocol MealRecognizer: Sendable {
    func recognize(jpeg: Data, note: String?) async throws -> [RecognizedFood]
}

struct MealPhotoError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

/// `POST /api/food-database/photo` with the bundled owner token, the same server and token sync uses.
struct MealPhotoClient: MealRecognizer {
    static let live = MealPhotoClient(endpoint: AppEnvironment.apiURL.appending(path: "api/food-database/photo"), token: AppEnvironment.ownerToken)

    let endpoint: URL
    let token: String
    var session = URLSession.shared

    private struct Body: Encodable {
        let image: String
        let mediaType = "image/jpeg"
        let note: String?
    }

    private struct Answer: Decodable { let items: [RecognizedFood] }
    private struct Failure: Decodable { let error: String }

    func recognize(jpeg: Data, note: String?) async throws -> [RecognizedFood] {
        // The model thinks before it answers: a plate took 3 to 10 seconds in testing.
        var request = URLRequest(url: endpoint, timeoutInterval: 45)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(Body(image: jpeg.base64EncodedString(), note: note))
        let (data, response) = try await session.data(for: request)
        guard let response = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        guard response.statusCode == 200 else {
            throw MealPhotoError(message: (try? JSONDecoder().decode(Failure.self, from: data))?.error ?? "The server answered \(response.statusCode).")
        }
        return try JSONDecoder().decode(Answer.self, from: data).items
    }
}

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
