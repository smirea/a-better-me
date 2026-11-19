import Foundation
import GRDB

/// Supplement pictures synced as base64 rows of `supplement_images` until they became files (`PictureFiles`). The
/// first launch after that writes each stored picture to the cache, queues the ones the server never received for
/// upload, and drops the table with its pending writes, which name a table the schema no longer has. The server moves
/// the rows it holds into the bucket itself, under the same ids. Delete this once the owner's phone has run it.
enum LegacySupplementImages {
    static func move(_ pool: DatabasePool, into files: PictureFiles) throws {
        try pool.write { db in
            guard try db.tableExists("supplement_images") else { return }
            let unsent = Set(try String.fetchAll(db, sql: "SELECT id FROM _outbox WHERE \"table\" = 'supplement_images'"))
            let rows = try Row.fetchCursor(db, sql: "SELECT id, jpeg FROM supplement_images")
            while let row = try rows.next() {
                let key: String = row["id"]
                let text: String = row["jpeg"]
                guard let id = UUID(uuidString: key), let jpeg = Data(base64Encoded: text) else { continue }
                let picture = NewPicture(id: id, jpeg: jpeg)
                if unsent.contains(key) { try files.add(picture) } else { files.keep(picture) }
            }
            try db.execute(sql: "DELETE FROM _outbox WHERE \"table\" = 'supplement_images'")
            try db.execute(sql: "DROP TABLE supplement_images")
        }
    }
}
