import Foundation
import GRDB

extension Supplement {
    /// The library by name. Rows are small, since a picture's bytes are a file.
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
    /// be new: those it names and lacks are queued for upload before the row that lists them is written, and the files
    /// of ones it no longer names are dropped.
    func saveSupplement(_ supplement: Supplement, adding pictures: [NewPicture] = []) {
        write { try Self.save(supplement, adding: pictures, in: $0) }
    }

    nonisolated static func save(_ supplement: Supplement, adding pictures: [NewPicture] = [], in db: Database) throws {
        var saved = supplement
        saved.updatedAt = .now
        let stored = try Supplement.fetchOne(db, key: saved.key)?.images ?? []
        for picture in pictures where saved.images.contains(picture.id) && !stored.contains(picture.id) {
            try PictureFiles.shared.add(picture)
        }
        try put(saved, in: db)
        for id in stored where !saved.images.contains(id) { PictureFiles.shared.remove(id) }
    }

    func deleteSupplement(_ id: UUID) {
        write { db in
            let key = Supplement.key(id)
            let images = try Supplement.fetchOne(db, key: key)?.images ?? []
            _ = try Supplement.deleteOne(db, key: key)
            for image in images { PictureFiles.shared.remove(image) }
        }
    }

    func stopSupplement(_ id: UUID, on today: CalendarDay = .today) {
        edit(Supplement.self, id: id) { $0.stop(on: today) }
    }

    func startSupplement(_ id: UUID, on today: CalendarDay = .today) {
        edit(Supplement.self, id: id) { $0.start(on: today) }
    }
}
