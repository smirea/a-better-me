import Foundation
import GRDB

/// When a supplement is taken: `count` servings on each day from `start` through `end` that is one of `weekdays`.
/// Nothing is logged per day, so a day's supplements are the ones a regimen covers.
struct SupplementRegimen: Codable, Hashable, Sendable {
    enum Timing: String, Codable, CaseIterable, Sendable {
        case morning, afternoon, evening

        var title: String { rawValue.capitalized }
    }

    var start: CalendarDay
    /// The last day it is taken; none while it goes on.
    var end: CalendarDay?
    var count: Double = 1
    var timing: Timing?
    /// ISO weekdays, Monday 1. Empty is every day.
    var weekdays: [Int] = []
    /// Ids of `Tag` rows, such as the protocol this range belonged to.
    var tags: [UUID]?

    func spans(_ day: CalendarDay) -> Bool {
        start <= day && end.map { day <= $0 } != false
    }

    func covers(_ day: CalendarDay) -> Bool {
        spans(day) && (weekdays.isEmpty || weekdays.contains(day.weekday))
    }
}

/// A row of the synced `supplements` table: a pill from the owner's library, its label, and when it is taken.
struct Supplement: Stamped {
    static let table = "supplements"

    struct Serving: Codable, Hashable, Sendable {
        var quantity: Double = 1
        var unit = "capsule"
    }

    /// A Supplement Facts row, per serving. A proprietary blend's ingredient has no amount.
    struct Component: Codable, Hashable, Sendable {
        var name: String
        var amount: Double?
        var unit: String?
    }

    enum Status: Hashable, Sendable { case taking, upcoming, stopped }

    var id = UUID()
    var name: String
    var brand: String?
    /// Where it is bought.
    var url: String?
    var serving = Serving()
    var components: [Component] = []
    /// Oldest first.
    var regimens: [SupplementRegimen] = []
    var note = ""
    /// Its pictures' ids in `supplement_images`, in order. The first is the one lists show.
    var images: [UUID] = []
    /// Ids of `Tag` rows.
    var tags: [UUID] = []
    var createdAt = Date.now
    var updatedAt = Date.now

    init(name: String) {
        self.name = name
    }

    init(row: Row) throws {
        id = try row.uuid("id")
        name = row["name"]
        brand = row["brand"]
        url = row["url"]
        serving = try row.json("serving")
        components = try row.json("components")
        regimens = try row.json("regimens")
        note = row["note"] ?? ""
        images = try row.json("images")
        tags = try row.json("tags")
        createdAt = try row.instant("created_at")
        updatedAt = try row.instant("updated_at")
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = key
        container["name"] = name
        container["brand"] = brand
        container["url"] = url
        container["serving"] = try RowJSON.text(serving)
        container["components"] = try RowJSON.text(components)
        container["regimens"] = try RowJSON.text(regimens)
        container["note"] = note
        // As row ids are written, lowercase, where `UUID`'s own encoding is uppercase.
        container["images"] = try RowJSON.text(images.map(SupplementImage.key))
        container["tags"] = try RowJSON.text(tags.map(Tag.key))
        container["created_at"] = Instant.text(createdAt)
        container["updated_at"] = Instant.text(updatedAt)
    }
}

extension Supplement {
    func regimen(on day: CalendarDay) -> SupplementRegimen? {
        regimens.first { $0.covers(day) }
    }

    /// The regimen that is running or still to start as of `today`: the one the editor edits and Stop ends.
    func currentRegimen(on today: CalendarDay) -> Int? {
        regimens.lastIndex { $0.end.map { $0 >= today } != false }
    }

    func status(on today: CalendarDay) -> Status {
        guard let index = currentRegimen(on: today) else { return .stopped }
        return regimens[index].start <= today ? .taking : .upcoming
    }

    /// Ends every regimen that reaches `today`, so yesterday is the last day it shows. One that would not have run a
    /// day is dropped instead of kept as a range that covers nothing.
    mutating func stop(on today: CalendarDay) {
        let yesterday = today.adding(days: -1)
        regimens = regimens.compactMap { regimen in
            guard regimen.end.map({ $0 >= today }) != false else { return regimen }
            guard regimen.start <= yesterday else { return nil }
            var ended = regimen
            ended.end = yesterday
            return ended
        }
    }

    /// Takes it again from `today`, the way it was last taken.
    mutating func start(on today: CalendarDay) {
        guard currentRegimen(on: today) == nil else { return }
        var regimen = regimens.last ?? SupplementRegimen(start: today)
        regimen.start = today
        regimen.end = nil
        regimens.append(regimen)
    }
}

/// A supplement on a day it is taken, with that day's regimen.
struct DaySupplement: Identifiable, Hashable, Sendable {
    let supplement: Supplement
    let regimen: SupplementRegimen

    var id: UUID { supplement.id }
}

extension [Supplement] {
    /// The day's supplements in the order they are taken: morning, afternoon, evening, then the ones with no set time,
    /// each by name.
    func taken(on day: CalendarDay) -> [DaySupplement] {
        let timings = SupplementRegimen.Timing.allCases
        return compactMap { supplement in supplement.regimen(on: day).map { DaySupplement(supplement: supplement, regimen: $0) } }
            .sorted { lhs, rhs in
                let order = (
                    lhs.regimen.timing.flatMap(timings.firstIndex) ?? timings.count,
                    rhs.regimen.timing.flatMap(timings.firstIndex) ?? timings.count
                )
                guard order.0 == order.1 else { return order.0 < order.1 }
                return lhs.supplement.name.localizedCaseInsensitiveCompare(rhs.supplement.name) == .orderedAscending
            }
    }
}

/// A row of the synced `supplement_images` table: one picture of a supplement, named by `Supplement.images`. It is a
/// JPEG no longer than `MealPhotoImage.maxPixels`, the size an editor's photo already has, stored as base64 text
/// because the sync engine carries values, not files. A row is never rewritten, so its id is also its cache key.
struct SupplementImage: SyncedRecord {
    static let table = "supplement_images"

    var id: UUID
    var jpeg: Data
    var updatedAt = Date.now

    init(id: UUID, jpeg: Data) {
        self.id = id
        self.jpeg = jpeg
    }

    init(row: Row) throws {
        id = try row.uuid("id")
        let text: String = row["jpeg"]
        guard let jpeg = Data(base64Encoded: text) else { throw RowDecodingError(description: "jpeg is not base64") }
        self.jpeg = jpeg
        updatedAt = try row.instant("updated_at")
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = key
        container["jpeg"] = jpeg.base64EncodedString()
        container["updated_at"] = Instant.text(updatedAt)
    }
}

/// A row of the synced `tags` table: a label supplements and their regimens are grouped under, such as a protocol.
struct Tag: Stamped {
    static let table = "tags"

    var id = UUID()
    var name: String
    /// `#rrggbb`.
    var color: String
    var note = ""
    var createdAt = Date.now
    var updatedAt = Date.now

    init(name: String, color: String) {
        self.name = name
        self.color = color
    }

    init(row: Row) throws {
        id = try row.uuid("id")
        name = row["name"]
        color = row["color"]
        note = row["note"] ?? ""
        createdAt = try row.instant("created_at")
        updatedAt = try row.instant("updated_at")
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = key
        container["name"] = name
        container["color"] = color
        container["note"] = note
        container["created_at"] = Instant.text(createdAt)
        container["updated_at"] = Instant.text(updatedAt)
    }
}

enum SupplementFormat {
    static let weekdayShort = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    /// "2 capsules" for `count` servings.
    static func amount(_ serving: Supplement.Serving, count: Double = 1) -> String {
        let quantity = serving.quantity * count
        return "\(NumberText.plain(quantity)) \(unit(serving.unit, for: quantity))"
    }

    /// The unit as typed, made plural for more than one when it ends in a singular word, so a serving of 1 capsule
    /// taken twice reads "2 capsules" and 2 of "Veggie Capsule" reads "2 Veggie Capsules". Abbreviations ("g", "ml",
    /// "CFU") and units already plural stay as typed.
    static func unit(_ unit: String, for quantity: Double) -> String {
        guard quantity > 1, let last = unit.split(separator: " ").last, last.count >= 4, last.allSatisfy(\.isLetter),
              last.dropFirst() == last.dropFirst().lowercased(), last.last != "s" else { return unit }
        if last.hasSuffix("y"), let before = last.dropLast().last, !"aeiou".contains(before) { return unit.dropLast() + "ies" }
        return unit + (["ch", "sh", "x"].contains { last.hasSuffix($0) } ? "es" : "s")
    }

    static func days(_ weekdays: [Int]) -> String {
        let days = Set(weekdays).filter { (1...7).contains($0) }.sorted()
        return days.isEmpty || days.count == 7 ? "Every day" : days.map { weekdayShort[$0 - 1] }.joined(separator: ", ")
    }

    /// "2 capsules · Mon, Thu · Morning".
    static func schedule(_ regimen: SupplementRegimen, of serving: Supplement.Serving) -> String {
        ([amount(serving, count: regimen.count), days(regimen.weekdays)] + [regimen.timing?.title].compactMap(\.self))
            .joined(separator: " · ")
    }

    /// A day's line: the amount and when, without the days, since the row is already on one.
    static func dose(_ regimen: SupplementRegimen, of serving: Supplement.Serving) -> String {
        ([amount(serving, count: regimen.count)] + [regimen.timing?.title].compactMap(\.self)).joined(separator: " · ")
    }

    static func component(_ component: Supplement.Component, count: Double = 1) -> String? {
        guard let amount = component.amount else { return nil }
        return [NumberText.plain(amount * count), component.unit].compactMap(\.self).joined(separator: " ")
    }
}
