import Foundation
import GRDB

/// The bundled USDA generic foods, `Resources/Nutrition/usda-foods.sqlite`, made by `app-ios/scripts/usda-foods.ts`
/// from SR Legacy. Names and ranking priors load into memory once, about 7,300 rows; nutrition is decoded only for the
/// rows a search returns.
final class USDACatalog: Sendable {
    struct Entry: Sendable {
        let fdcID: Int
        let name: String
        let text: FoodText
        /// The generator's ranking nudge: plus for the staples an owner expects first, minus for brands and dishes.
        let prior: Double
    }

    static let bundled: USDACatalog = {
        guard let url = Bundle.main.url(forResource: "usda-foods", withExtension: "sqlite") else {
            fatalError("Missing usda-foods.sqlite in the app bundle. Run bun app-ios/scripts/usda-foods.ts.")
        }
        do {
            var configuration = Configuration()
            configuration.readonly = true
            return try USDACatalog(DatabaseQueue(path: url.path, configuration: configuration))
        } catch {
            fatalError("usda-foods.sqlite does not open: \(error)")
        }
    }()

    let entries: [Entry]
    private let database: DatabaseQueue

    init(_ database: DatabaseQueue) throws {
        self.database = database
        entries = try database.read { db in
            try Row.fetchAll(db, sql: "SELECT fdc_id, name, prior FROM foods ORDER BY fdc_id").map { row in
                let name: String = row["name"]
                return Entry(fdcID: row["fdc_id"], name: name, text: FoodText(name), prior: row["prior"])
            }
        }
    }

    /// The best `limit` matches for `terms`, best first, each with its score including the prior.
    func search(_ terms: [String], limit: Int) -> [(entry: Entry, score: Double)] {
        var matches: [(entry: Entry, score: Double)] = []
        for entry in entries {
            if let score = entry.text.score(terms) { matches.append((entry, score + entry.prior)) }
        }
        return Array(matches.sorted { ($0.score, -$0.entry.name.count) > ($1.score, -$1.entry.name.count) }.prefix(limit))
    }

    /// The foods with these ids as the rows the app caches (`usda-<fdcId>`), keyed by id; unknown ids are left out.
    func foods(_ ids: [Int]) throws -> [Int: Food] {
        guard !ids.isEmpty else { return [:] }
        let rows = try database.read { db in
            try Row.fetchAll(db, sql: "SELECT fdc_id, name, nutrition FROM foods WHERE fdc_id IN (\(ids.map(String.init).joined(separator: ",")))")
        }
        let decoder = JSONDecoder()
        return try Dictionary(uniqueKeysWithValues: rows.map { row in
            let id: Int = row["fdc_id"]
            let json: String = row["nutrition"]
            let nutrition = try decoder.decode(FoodNutrition.self, from: Data(json.utf8))
            return (id, Food(.usda(fdcID: id), name: row["name"], nutrition: nutrition))
        })
    }
}
