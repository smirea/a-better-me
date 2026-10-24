import Foundation
import GRDB
import SyncEngine

enum LegacyImport {
    static let backupName = "a-better-me.before-sync-engine.sqlite"

    @MainActor static func run(_ pool: DatabasePool, tables: [SyncTable], migrate: () throws -> Void) throws {
        let imported = try pool.read { db in
            try db.tableExists("_meta") && Row.fetchOne(db, sql: "SELECT 1 FROM _meta WHERE key = 'legacy_import'") != nil
        }
        if imported {
            try migrate()
            return
        }
        let legacyTables = try pool.read { db in try tables.filter { try db.tableExists("ps_data__\($0.name)") } }
        let backup = URL(filePath: pool.path).deletingLastPathComponent().appending(path: backupName)
        if !legacyTables.isEmpty, !FileManager.default.fileExists(atPath: backup.path) {
            try pool.vacuum(into: backup.path)
        }
        // The views go first, because `CREATE TABLE IF NOT EXISTS` keeps a view of the same name.
        try pool.write { db in
            for table in tables where try db.viewExists(table.name) {
                try db.execute(sql: "DROP VIEW \"\(table.name)\"")
            }
        }
        try migrate()
        try pool.write { db in
            for table in legacyTables {
                let columns = try db.columns(in: table.name)
                let names = columns.map { "\"\($0.name)\"" }.joined(separator: ", ")
                let values = columns.map { column in
                    let extracted = column.name == "id" ? "id" : "json_extract(data, '$.\(column.name)')"
                    return column.defaultValueSQL.map { "coalesce(\(extracted), \($0))" } ?? extracted
                }.joined(separator: ", ")
                try db.execute(sql: "INSERT INTO \"\(table.name)\" (\(names)) SELECT \(values) FROM \"ps_data__\(table.name)\"")
            }
            for name in try String.fetchAll(db, sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name GLOB 'ps_*' AND name NOT GLOB 'ps_data__*'") {
                try db.execute(sql: "DROP TABLE \"\(name)\"")
            }
            try db.execute(sql: "INSERT INTO _meta (key, value) VALUES ('legacy_import', ?)", arguments: [Instant.text(.now)])
        }
    }
}
