import Foundation
import GRDB

extension Supplement {
    /// The library by name. Rows are small, since the pictures live in `supplement_images`.
    static let all = DatabaseQuery([Supplement]()) { db in
        try Supplement.fetchAll(db).sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    static func one(_ id: UUID) -> DatabaseQuery<Supplement?> {
        DatabaseQuery(nil) { try Supplement.fetchOne($0, key: key(id)) }
    }
}

extension Tag {
    static let byID = DatabaseQuery([UUID: Tag]()) { db in
        try Dictionary(uniqueKeysWithValues: Tag.fetchAll(db).map { ($0.id, $0) })
    }
}

extension LocalStore {
    /// Inserts or updates the supplement, whose `images` says which pictures it has. `pictures` holds the ones that may
    /// be new: those it names and lacks are inserted, and stored ones it no longer names are deleted, in the same
    /// transaction. A picture it names whose row has not synced yet is left to arrive.
    func saveSupplement(_ supplement: Supplement, adding pictures: [SupplementImage] = []) {
        write { try Self.save(supplement, adding: pictures, in: $0) }
    }

    nonisolated static func save(_ supplement: Supplement, adding pictures: [SupplementImage] = [], in db: Database) throws {
        var saved = supplement
        saved.updatedAt = .now
        let stored = try Supplement.fetchOne(db, key: saved.key)?.images ?? []
        for id in stored where !saved.images.contains(id) {
            _ = try SupplementImage.deleteOne(db, key: SupplementImage.key(id))
        }
        for picture in pictures where saved.images.contains(picture.id) && !stored.contains(picture.id) {
            try put(picture, in: db)
        }
        try put(saved, in: db)
    }

    func deleteSupplement(_ id: UUID) {
        write { db in
            let key = Supplement.key(id)
            for image in try Supplement.fetchOne(db, key: key)?.images ?? [] {
                _ = try SupplementImage.deleteOne(db, key: SupplementImage.key(image))
            }
            _ = try Supplement.deleteOne(db, key: key)
        }
    }

    func stopSupplement(_ id: UUID, on today: CalendarDay = .today) {
        edit(Supplement.self, id: id) { $0.stop(on: today) }
    }

    func startSupplement(_ id: UUID, on today: CalendarDay = .today) {
        edit(Supplement.self, id: id) { $0.start(on: today) }
    }
}
