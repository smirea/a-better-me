import Foundation
import GRDB

/// A date on the owner's calendar, the nutrition log's unit: stored as `YYYY-MM-DD` text, which sorts as text and never
/// moves through a time zone, so dinner logged while traveling stays on the day it was eaten.
struct CalendarDay: Hashable, Comparable, Codable, Sendable, CustomStringConvertible {
    let year: Int
    let month: Int
    let day: Int

    private static let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }()

    /// Strict `YYYY-MM-DD` of a real date.
    init?(_ text: String) {
        let parts = text.split(separator: "-", omittingEmptySubsequences: false)
        guard text.utf8.count == 10, parts.count == 3, parts[0].count == 4, parts[1].count == 2, parts[2].count == 2,
              let year = Int(parts[0]), let month = Int(parts[1]), let day = Int(parts[2]) else { return nil }
        let components = DateComponents(year: year, month: month, day: day)
        guard components.isValidDate(in: Self.calendar) else { return nil }
        self.year = year
        self.month = month
        self.day = day
    }

    /// The day `date` falls on in `calendar`, the device's own by default.
    init(_ date: Date, in calendar: Calendar = .current) {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        year = parts.year!
        month = parts.month!
        day = parts.day!
    }

    static var today: CalendarDay { CalendarDay(.now) }

    var description: String { String(format: "%04d-%02d-%02d", year, month, day) }

    /// Midnight UTC of the day, only for day arithmetic.
    private var utcDate: Date { Self.calendar.date(from: DateComponents(year: year, month: month, day: day))! }

    func adding(days: Int) -> CalendarDay {
        CalendarDay(Self.calendar.date(byAdding: .day, value: days, to: utcDate)!, in: Self.calendar)
    }

    /// ISO weekday: Monday 1 through Sunday 7.
    var weekday: Int { (Self.calendar.component(.weekday, from: utcDate) + 5) % 7 + 1 }

    static func < (lhs: CalendarDay, rhs: CalendarDay) -> Bool {
        (lhs.year, lhs.month, lhs.day) < (rhs.year, rhs.month, rhs.day)
    }

    init(from decoder: any Decoder) throws {
        let text = try decoder.singleValueContainer().decode(String.self)
        guard let day = CalendarDay(text) else {
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Not a day: \(text)"))
        }
        self = day
    }

    func encode(to encoder: any Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(description)
    }
}

extension SyncedRecord where ID == CalendarDay {
    static func key(_ id: CalendarDay) -> String { id.description }
}

extension Row {
    func day(_ column: String) throws -> CalendarDay {
        let text: String = self[column]
        guard let day = CalendarDay(text) else { throw RowDecodingError(description: "\(column) is not a day: \(text)") }
        return day
    }
}

extension CalendarDay {
    var monday: CalendarDay { adding(days: 1 - weekday) }

    /// The ISO week (Monday first) that holds the day.
    var week: [CalendarDay] { (0..<7).map { monday.adding(days: $0) } }

    /// Whole days from `self` to `other`, negative when `other` is earlier.
    func days(to other: CalendarDay) -> Int {
        Self.calendar.dateComponents([.day], from: utcDate, to: other.utcDate).day!
    }

    /// Noon of the day on the device's calendar: a `Date` for pickers and formatters that no zone shift moves to
    /// another day.
    var date: Date {
        Calendar.current.date(from: DateComponents(year: year, month: month, day: day, hour: 12))!
    }

    /// The moment `minute` minutes after the day's midnight in `calendar`, as an entry's or note's minute counts.
    func date(atMinute minute: Int, in calendar: Calendar = .current) -> Date {
        calendar.date(from: DateComponents(year: year, month: month, day: day, hour: minute / 60, minute: minute % 60))!
    }
}

extension Date {
    /// Minutes since midnight in `calendar`, 0 through 1439.
    func minuteOfDay(in calendar: Calendar = .current) -> Int {
        let parts = calendar.dateComponents([.hour, .minute], from: self)
        return parts.hour! * 60 + parts.minute!
    }
}
