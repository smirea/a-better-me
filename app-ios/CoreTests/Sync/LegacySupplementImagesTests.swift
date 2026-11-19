import Foundation
import GRDB
import SyncEngine
import Testing
@testable import Core

@MainActor
struct LegacySupplementImagesTests {
    @Test func keepsEveryStoredPictureAsAFileAndQueuesOnlyTheOnesTheServerNeverReceived() throws {
        let pool = try LegacyImportTests.freshPool()
        let client = SyncClient(database: pool, schema: syncSchema, endpoint: URL(string: "http://localhost")!, token: { nil })
        try client.migrate()
        let folder = URL(filePath: pool.path).deletingLastPathComponent()
        let files = PictureFiles(cache: folder.appending(path: "cache"), queue: folder.appending(path: "queue"))
        let synced = UUID(uuidString: "0b0e7a52-6f0c-4b65-9d57-2a0d3c1e9f10")!
        let unsent = UUID(uuidString: "9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f")!
        let (first, second) = (Data([0xff, 0xd8, 0xff, 1]), Data([0xff, 0xd8, 0xff, 2]))
        try pool.write { db in
            try db.execute(sql: "CREATE TABLE supplement_images (id TEXT PRIMARY KEY, jpeg TEXT NOT NULL, updated_at TEXT NOT NULL)")
            try db.execute(
                sql: "INSERT INTO supplement_images VALUES (?, ?, 'now'), (?, ?, 'now')",
                arguments: [synced.uuidString.lowercased(), first.base64EncodedString(), unsent.uuidString.lowercased(), second.base64EncodedString()]
            )
            try db.execute(
                sql: "INSERT INTO _outbox (\"table\", id, op) VALUES ('supplement_images', ?, 'insert')",
                arguments: [unsent.uuidString.lowercased()]
            )
        }

        try LegacySupplementImages.move(pool, into: files)
        try LegacySupplementImages.move(pool, into: files)

        #expect(files.local(synced) == first)
        #expect(files.local(unsent) == second)
        #expect(files.queued == [unsent])
        let (tableLeft, writesLeft) = try pool.read { db in
            (try db.tableExists("supplement_images"), try Int.fetchOne(db, sql: "SELECT count(*) FROM _outbox"))
        }
        #expect(!tableLeft)
        #expect(writesLeft == 0)
    }
}
