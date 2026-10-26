import Foundation
import GRDB

/// A row of the synced `food_log_notes` table: a titled note on a day of the food log, at a time.
struct FoodLogNote: SyncedRecord {
    static let table = "food_log_notes"
    /// MacroFactor's cap per day, which the editor enforces.
    static let limitPerDay = 5

    enum Color: String, Codable, CaseIterable, Sendable { case red, blue, green, yellow, purple }

    var id: UUID
    var day: CalendarDay
    /// Minutes since midnight.
    var minute: Int
    var title: String
    var body = ""
    var color = Color.blue

    init(day: CalendarDay, minute: Int, title: String) {
        id = UUID()
        self.day = day
        self.minute = minute
        self.title = title
    }

    init(row: Row) throws {
        id = try row.uuid("id")
        day = try row.day("day")
        minute = row["minute"] ?? 720
        title = row["title"]
        body = row["body"] ?? ""
        color = (row["color"] as String?).flatMap(Color.init(rawValue:)) ?? .blue
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = key
        container["day"] = day.description
        container["minute"] = minute
        container["title"] = title
        container["body"] = body
        container["color"] = color.rawValue
    }
}
