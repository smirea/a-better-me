import Foundation

/// What package photos say about one food (`server/src/food/foodLabel.ts`). A field no photo shows is nil.
struct FoodLabel: Codable, Hashable, Sendable {
    var name: String?
    var brand: String?
    var store: String?
    var nutrition: FoodNutrition?
}

/// Reads a food from package photos, all of them in one model call.
protocol FoodLabelReader: Sendable {
    func read(jpegs: [Data]) async throws -> FoodLabel
}

/// `POST /api/food-database/label` with the bundled owner token, the same server and token sync uses.
struct FoodLabelClient: FoodLabelReader {
    static let live = FoodLabelClient(endpoint: AppEnvironment.apiURL.appending(path: "api/food-database/label"), token: AppEnvironment.ownerToken)

    let endpoint: URL
    let token: String
    var session = URLSession.shared

    private struct Body: Encodable {
        struct Image: Encodable {
            let image: String
            let mediaType = "image/jpeg"
        }

        let images: [Image]
    }

    private struct Failure: Decodable { let error: String }

    func read(jpegs: [Data]) async throws -> FoodLabel {
        // A label took 5 to 6 seconds in testing; more photos take longer.
        var request = URLRequest(url: endpoint, timeoutInterval: 60)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(Body(images: jpegs.map { Body.Image(image: $0.base64EncodedString()) }))
        let (data, response) = try await session.data(for: request)
        guard let response = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        guard response.statusCode == 200 else {
            throw MealPhotoError(message: (try? JSONDecoder().decode(Failure.self, from: data))?.error ?? "The server answered \(response.statusCode).")
        }
        return try JSONDecoder().decode(FoodLabel.self, from: data)
    }
}

extension FoodDraft {
    /// This draft with what the label found written over it.
    func reading(_ label: FoodLabel) -> FoodDraft {
        var read = self
        if let name = label.name { read.name = name }
        if let brand = label.brand { read.brand = brand }
        if let store = label.store { read.store = store }
        if let nutrition = label.nutrition {
            var food = Food(name: read.name, nutrition: nutrition)
            food.icon = icon
            let parsed = FoodDraft(food)
            read.basis = parsed.basis
            read.servingWeight = parsed.servingWeight
            read.servingWeightUnit = parsed.servingWeightUnit
            read.servingQuantity = parsed.servingQuantity
            read.servingName = parsed.servingName
            read.measures = parsed.measures
            read.energyUnit = .kcal
            read.nutrients = parsed.nutrients
        }
        return read
    }

    /// Takes a new read of the photos, except where the owner changed a field since `baseline`, the draft as the last
    /// read (or the editor's opening) left it. The serving moves as one, since its fields only mean something together;
    /// each nutrient moves alone, so fixing calories by hand keeps that fix through a read of one more photo.
    mutating func merge(_ read: FoodDraft, over baseline: FoodDraft) {
        if name == baseline.name { name = read.name }
        if brand == baseline.brand { brand = read.brand }
        if store == baseline.store { store = read.store }
        if servingFields == baseline.servingFields {
            basis = read.basis
            servingWeight = read.servingWeight
            servingWeightUnit = read.servingWeightUnit
            servingQuantity = read.servingQuantity
            servingName = read.servingName
            measures = read.measures
        }
        if nutrients[.energy] == baseline.nutrients[.energy], energyUnit == baseline.energyUnit { energyUnit = read.energyUnit }
        for id in Set(read.nutrients.keys).union(baseline.nutrients.keys) where nutrients[id] == baseline.nutrients[id] {
            nutrients[id] = read.nutrients[id]
        }
    }

    private var servingFields: [String] {
        [basis.rawValue, servingWeight, servingWeightUnit.rawValue, servingQuantity, servingName]
            + measures.flatMap { [$0.id.uuidString, $0.quantity, $0.name, $0.size] }
    }
}
