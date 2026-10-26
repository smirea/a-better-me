import Foundation

/// Branded foods by barcode and by name. The app reaches Open Food Facts only through our server
/// (`server/src/food/`), which maps its nutriments to registry ids, so the phone never parses Open Food Facts itself.
protocol BrandedFoodSource: Sendable {
    /// Nil when the database has no usable product for the barcode.
    func food(barcode: String) async throws -> Food?
    func search(_ query: String, limit: Int) async throws -> [Food]
}

/// `GET /api/food-database/...` with the bundled owner token, the same server and token sync uses.
struct FoodDatabaseClient: BrandedFoodSource {
    static let live = FoodDatabaseClient(endpoint: AppEnvironment.apiURL.appending(path: "api/food-database"), token: AppEnvironment.ownerToken)

    let endpoint: URL
    let token: String
    var session = URLSession.shared

    /// The server's answer: the app's `Food` row, which it caches as is.
    private struct Product: Decodable {
        let name: String
        let brand: String?
        let barcode: String
        let nutrition: FoodNutrition

        var food: Food { Food(.openFoodFacts(barcode: barcode), name: name, brand: brand, nutrition: nutrition) }
    }

    func food(barcode: String) async throws -> Food? {
        let (data, response) = try await get(endpoint.appending(path: "barcode/\(barcode)"))
        if response.statusCode == 404 { return nil }
        return try decode(Product.self, data, response).food
    }

    func search(_ query: String, limit: Int) async throws -> [Food] {
        let url = endpoint.appending(path: "search").appending(queryItems: [
            URLQueryItem(name: "q", value: query), URLQueryItem(name: "limit", value: String(limit)),
        ])
        let (data, response) = try await get(url)
        return try decode([Product].self, data, response).map(\.food)
    }

    private func get(_ url: URL) async throws -> (Data, HTTPURLResponse) {
        var request = URLRequest(url: url, timeoutInterval: 10)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await session.data(for: request)
        guard let response = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        return (data, response)
    }

    private func decode<T: Decodable>(_: T.Type, _ data: Data, _ response: HTTPURLResponse) throws -> T {
        guard response.statusCode == 200 else { throw URLError(.badServerResponse, userInfo: ["status": response.statusCode]) }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
