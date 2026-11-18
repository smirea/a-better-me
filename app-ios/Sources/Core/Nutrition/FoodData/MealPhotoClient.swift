import Foundation

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
