import Foundation
import GRDB

/// The sync engine answers a cursor it cannot place in the server's space with a snapshot that replaces the device's
/// rows. A device that synced before the engine named spaces has no `_meta.space`, so its first sync after the upgrade
/// does that once, and rows only this device held would go. This keeps a copy of the file first, as `LegacyImport` does.
enum SpaceResync {
    static let backupName = "a-better-me.before-space-resync.sqlite"

    static func backUpIfNeeded(_ pool: DatabasePool) throws {
        let backup = URL(filePath: pool.path).deletingLastPathComponent().appending(path: backupName)
        guard !FileManager.default.fileExists(atPath: backup.path) else { return }
        let unplaced = try pool.read { db in
            try String.fetchOne(db, sql: "SELECT value FROM _meta WHERE key = 'space'") == nil
                && (Int.fetchOne(db, sql: "SELECT value FROM _meta WHERE key = 'cursor'") ?? 0) > 0
        }
        if unplaced { try pool.vacuum(into: backup.path) }
    }
}
