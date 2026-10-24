import Foundation
import GRDB

/// A row of one synced table, read and written through GRDB over PowerSync's view of it. The id column is the record's
/// `key`: a lowercase UUID for workouts and sessions, the exercise id for the rest.
protocol SyncedRecord: FetchableRecord, PersistableRecord, Identifiable, Hashable, Sendable where ID: Sendable {
    static var table: String { get }
    static func key(_ id: ID) -> String
}

extension SyncedRecord {
    static var databaseTableName: String { table }
    var key: String { Self.key(id) }
}

extension SyncedRecord where ID == UUID {
    static func key(_ id: UUID) -> String { id.uuidString.lowercased() }
}

extension SyncedRecord where ID == String {
    static func key(_ id: String) -> String { id }
}

struct RowDecodingError: Error, CustomStringConvertible {
    let description: String
}

extension Row {
    func uuid(_ column: String) throws -> UUID {
        let text: String = self[column]
        guard let id = UUID(uuidString: text) else { throw RowDecodingError(description: "\(column) is not a UUID: \(text)") }
        return id
    }

    func instant(_ column: String) throws -> Date {
        guard let date = try instant(column, optional: true) else { throw RowDecodingError(description: "\(column) is null") }
        return date
    }

    func instant(_ column: String, optional: Bool) throws -> Date? {
        guard let text: String = self[column] else { return nil }
        guard let date = Instant.parse(text) else { throw RowDecodingError(description: "\(column) is not an instant: \(text)") }
        return date
    }

    func json<T: Decodable>(_ column: String) throws -> T {
        let text: String = self[column]
        return try RowJSON.decoder.decode(T.self, from: Data(text.utf8))
    }

    /// A settings-like JSON column read over `defaults`, so a key the stored text lacks takes the default and a row
    /// written before a key existed needs no migration. The stored tree is deep-merged over the encoded default:
    /// objects merge key by key, everything else replaces, and a root of another JSON kind is discarded. A NULL
    /// column, text that is not JSON, or a merged tree that does not decode reads as `defaults`, and the last two log.
    func json<T: Codable>(_ column: String, over defaults: T) -> T {
        guard let text: String = self[column] else { return defaults }
        do {
            let stored = try JSONSerialization.jsonObject(with: Data(text.utf8), options: .fragmentsAllowed)
            let base = try JSONSerialization.jsonObject(with: RowJSON.encoder.encode(defaults), options: .fragmentsAllowed)
            let merged = switch (stored, base) {
            case (is [String: Any], is [String: Any]), (is [Any], is [Any]): Self.merge(stored, over: base)
            default: base
            }
            let data = try JSONSerialization.data(withJSONObject: merged, options: .fragmentsAllowed)
            return try RowJSON.decoder.decode(T.self, from: data)
        } catch {
            LocalStore.log.error("\(column) did not decode, reading defaults: \(String(describing: error))")
            return defaults
        }
    }

    private static func merge(_ stored: Any, over base: Any) -> Any {
        guard let stored = stored as? [String: Any], let base = base as? [String: Any] else { return stored }
        var merged = base
        for (key, value) in stored {
            merged[key] = base[key].map { merge(value, over: $0) } ?? value
        }
        return merged
    }

    /// PowerSync stores a boolean as 0 or 1; Postgres may stream it back as text.
    func flag(_ column: String) -> Bool {
        let value: DatabaseValue = self[column]
        switch value.storage {
        case let .int64(number): return number != 0
        case let .string(text): return text == "1" || text == "true"
        case let .double(number): return number != 0
        default: return false
        }
    }
}

/// Timestamps on the wire and in SQLite: ISO 8601 in UTC with fractional seconds, which Postgres' `timestamptz`
/// accepts and which sorts as text. Parsing also takes what Postgres and PowerSync emit: a space before the time,
/// microseconds, and an offset with or without minutes.
enum Instant {
    private static let calendar: Calendar = {
        var calendar = Calendar(identifier: .iso8601)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }()

    static func text(_ date: Date) -> String {
        let rounded = Date(timeIntervalSince1970: (date.timeIntervalSince1970 * 1000).rounded() / 1000)
        let parts = calendar.dateComponents([.year, .month, .day, .hour, .minute, .second, .nanosecond], from: rounded)
        let millis = Int((Double(parts.nanosecond ?? 0) / 1_000_000).rounded())
        return String(
            format: "%04d-%02d-%02dT%02d:%02d:%02d.%03dZ",
            parts.year!, parts.month!, parts.day!, parts.hour!, parts.minute!, parts.second!, millis
        )
    }

    static func parse(_ text: String) -> Date? {
        var scanner = text.utf8.makeIterator()
        func digits(_ count: Int) -> Int? {
            var value = 0
            for _ in 0..<count {
                guard let byte = scanner.next(), (48...57).contains(byte) else { return nil }
                value = value * 10 + Int(byte - 48)
            }
            return value
        }
        guard let year = digits(4), scanner.next() == 45, let month = digits(2), scanner.next() == 45, let day = digits(2) else { return nil }
        var components = DateComponents(year: year, month: month, day: day)
        var next = scanner.next()
        if next == 84 || next == 32 {
            guard let hour = digits(2), scanner.next() == 58, let minute = digits(2) else { return nil }
            components.hour = hour
            components.minute = minute
            next = scanner.next()
            if next == 58 {
                guard let second = digits(2) else { return nil }
                components.second = second
                next = scanner.next()
            }
            if next == 46 {
                var fraction = 0.0
                var scale = 0.1
                while let byte = scanner.next() {
                    guard (48...57).contains(byte) else { next = byte; break }
                    fraction += Double(byte - 48) * scale
                    scale /= 10
                    next = nil
                }
                components.nanosecond = Int((fraction * 1e9).rounded())
            }
        }
        var offset = 0
        switch next {
        case nil, 90: break
        case 43, 45:
            guard let hours = digits(2) else { return nil }
            var minutes = 0
            if let separator = scanner.next() {
                guard separator == 58, let value = digits(2) else { return nil }
                minutes = value
            }
            offset = (hours * 3600 + minutes * 60) * (next == 45 ? -1 : 1)
        default: return nil
        }
        guard scanner.next() == nil, let date = calendar.date(from: components) else { return nil }
        return date.addingTimeInterval(TimeInterval(-offset))
    }
}

/// The JSON columns (`blocks`, `exercise`) and the Codable value trees inside them. Keys are sorted so the same value
/// always encodes to the same text, and dates are ISO 8601 so an export reads without the app.
enum RowJSON {
    static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        encoder.dateEncodingStrategy = .custom { date, encoder in
            var container = encoder.singleValueContainer()
            try container.encode(Instant.text(date))
        }
        return encoder
    }()

    static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let text = try decoder.singleValueContainer().decode(String.self)
            guard let date = Instant.parse(text) else {
                throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Not an instant: \(text)"))
            }
            return date
        }
        return decoder
    }()

    static func text(_ value: some Encodable) throws -> String {
        String(decoding: try encoder.encode(value), as: UTF8.self)
    }
}
