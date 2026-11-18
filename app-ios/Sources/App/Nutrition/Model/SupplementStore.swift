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

/// What a save does to a supplement's picture. `replace` takes any image data and stores it at `SupplementImage.maxPixels`.
enum SupplementPictureChange: Sendable {
    case keep
    case replace(Data)
}

extension LocalStore {
    /// Inserts or updates the supplement, and its picture in the same transaction, so `imageAt` never names a picture
    /// that is not there.
    func saveSupplement(_ supplement: Supplement, picture: SupplementPictureChange = .keep) {
        write { try Self.save(supplement, picture: picture, in: $0) }
    }

    nonisolated static func save(_ supplement: Supplement, picture: SupplementPictureChange, in db: Database) throws {
        var saved = supplement
        saved.updatedAt = .now
        if case let .replace(data) = picture, let jpeg = MealPhotoImage.jpeg(from: data, maxPixels: SupplementImage.maxPixels) {
            var image = SupplementImage(id: saved.id, jpeg: jpeg)
            image.updatedAt = saved.updatedAt
            try put(image, in: db)
            saved.imageAt = saved.updatedAt
        }
        try put(saved, in: db)
    }

    func deleteSupplement(_ id: UUID) {
        write { db in
            _ = try Supplement.deleteOne(db, key: Supplement.key(id))
            _ = try SupplementImage.deleteOne(db, key: SupplementImage.key(id))
        }
    }

    func stopSupplement(_ id: UUID, on today: CalendarDay = .today) {
        edit(Supplement.self, id: id) { $0.stop(on: today) }
    }

    func startSupplement(_ id: UUID, on today: CalendarDay = .today) {
        edit(Supplement.self, id: id) { $0.start(on: today) }
    }
}
