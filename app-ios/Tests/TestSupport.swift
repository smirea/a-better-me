import Foundation
import GRDB
@testable import App

/// UTC with Monday first, the calendar date-based suites compute in.
let utc: Calendar = {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "UTC")!
    calendar.firstWeekday = 2
    return calendar
}()

/// 8 AM UTC on a `YYYY-MM-DD` day.
func day(_ text: String, _ hour: Int = 8) -> Date {
    let parts = text.split(separator: "-").map { Int($0)! }
    return utc.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: hour))!
}

typealias Engine = NutritionEngine

func calendarDay(_ text: String) -> CalendarDay { CalendarDay(text)! }

/// 120 kcal, 10 g protein, 4 g fat, 12 g carbs, and 2 g fiber per 100 g; a container is 150 g.
let yogurt = FoodSnapshot(
    foodID: "usda-171304", source: .usda, name: "Yogurt", brand: nil,
    nutrition: FoodNutrition(
        nutrients: [.energy: 120, .protein: 10, .fat: 4, .carbs: 12, .fiber: 2], baseGrams: 100,
        measures: [Measure(name: "container", quantity: 1, servings: 1.5)]
    )
)

/// A catalog in the generator's shape over a few rows, with the priors the generator gives them.
func fixtureCatalog(_ rows: [(id: Int, name: String, prior: Double, nutrition: String)]) throws -> USDACatalog {
    let database = try DatabaseQueue()
    try database.write { db in
        try db.execute(sql: "CREATE TABLE foods (fdc_id INTEGER PRIMARY KEY, name TEXT NOT NULL, prior REAL NOT NULL, nutrition TEXT NOT NULL)")
        for row in rows {
            try db.execute(sql: "INSERT INTO foods VALUES (?, ?, ?, ?)", arguments: [row.id, row.name, row.prior, row.nutrition])
        }
    }
    return try USDACatalog(database)
}

/// Answers from fixed foods, or fails like a phone without a network.
struct StubBranded: BrandedFoodSource {
    var products: [String: Food] = [:]
    var hits: [Food] = []
    var offline = false

    func food(barcode: String) async throws -> Food? {
        if offline { throw URLError(.notConnectedToInternet) }
        return products[barcode]
    }

    func search(_ query: String, limit: Int) async throws -> [Food] {
        if offline { throw URLError(.notConnectedToInternet) }
        return hits
    }
}
