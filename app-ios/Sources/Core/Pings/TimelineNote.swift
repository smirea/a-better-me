import Foundation
import GRDB

/// A row of the synced `timeline_notes` table: free text on the Pings timeline at a moment of a day, typed in the
/// composer at the bottom of the Pings tab. It belongs to no ping.
struct TimelineNote: SyncedRecord {
    static let table = "timeline_notes"

    var id: UUID
    var notedAt: Date
    var text: String

    init(id: UUID = UUID(), text: String, at date: Date = .now) {
        self.id = id
        self.text = text
        notedAt = date
    }

    init(row: Row) throws {
        id = try row.uuid("id")
        notedAt = try row.instant("noted_at")
        text = row["text"]
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = key
        container["noted_at"] = Instant.text(notedAt)
        container["text"] = text
    }

    static func on(_ day: CalendarDay, in db: Database, calendar: Calendar = .current) throws -> [TimelineNote] {
        try TimelineNote.filter(
            Column("noted_at") >= Instant.text(day.date(in: calendar))
                && Column("noted_at") < Instant.text(day.adding(days: 1).date(in: calendar))
        )
        .fetchAll(db)
    }
}
