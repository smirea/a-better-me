import Foundation
import GRDB
import SyncEngine
import Testing
@testable import App

@MainActor
struct LegacyImportTests {
    static let upper = "10586719-1c40-44d5-a034-79debc185598"
    static let lower = "2b4a0a5c-7c2e-4d0e-9a39-6b1f3f0c1a77"
    static let viewTriggerThatFailsIfFired = """
        CREATE TRIGGER "ps_view_insert_workout_templates" INSTEAD OF INSERT ON "workout_templates" FOR EACH ROW BEGIN
        INSERT INTO "ps_data__workout_templates" SELECT NEW.id, json_object('name', legacy_strip_subtype(NEW."name"));
        INSERT INTO legacy_crud(op,id,type) VALUES ('PUT', NEW.id, 'workout_templates');
        END
        """

    static func freshPool() throws -> DatabasePool {
        let directory = FileManager.default.temporaryDirectory.appending(path: "legacy-import-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return try DatabasePool(path: directory.appending(path: "a-better-me.sqlite").path)
    }

    static func backup(beside pool: DatabasePool) -> URL {
        URL(filePath: pool.path).deletingLastPathComponent().appending(path: "a-better-me.before-sync-engine.sqlite")
    }

    static func legacyPool() throws -> DatabasePool {
        let pool = try freshPool()
        try pool.write { db in
            try db.execute(sql: #"CREATE TABLE "ps_data__workout_templates"(id TEXT PRIMARY KEY NOT NULL, data TEXT)"#)
            try db.execute(sql: #"CREATE TABLE "ps_data__gym_profiles"(id TEXT PRIMARY KEY NOT NULL, data TEXT)"#)
            try db.execute(sql: #"CREATE TABLE ps_crud (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT, tx_id INTEGER)"#)
            try db.execute(sql: #"CREATE TABLE ps_kv(key TEXT PRIMARY KEY NOT NULL, value BLOB)"#)
            try db.execute(sql: """
                CREATE VIEW "workout_templates"("id", "name", "notes", "blocks", "program_id", "gym_id", "archived", "created_at", "updated_at") AS SELECT id, CAST(json_extract(data, '$.name') as text), CAST(json_extract(data, '$.notes') as text), CAST(json_extract(data, '$.blocks') as text), CAST(json_extract(data, '$.program_id') as text), CAST(json_extract(data, '$.gym_id') as text), CAST(json_extract(data, '$.archived') as integer), CAST(json_extract(data, '$.created_at') as text), CAST(json_extract(data, '$.updated_at') as text) FROM "ps_data__workout_templates"
                """)
            try db.execute(sql: viewTriggerThatFailsIfFired)
            try db.execute(sql: #"INSERT INTO ps_crud (data, tx_id) VALUES ('{"op":"PUT","type":"workout_templates"}', 1)"#)
            try db.execute(
                sql: #"INSERT INTO "ps_data__workout_templates" VALUES (?, ?), (?, ?)"#,
                arguments: [
                    upper, #"{"name":"Upper","notes":"","blocks":"[]","program_id":null,"gym_id":null,"archived":1,"created_at":"2026-10-24T16:06:20.081Z","updated_at":"2026-10-24T16:06:20.081Z"}"#,
                    lower, #"{"name":"Lower","blocks":"[]","created_at":"2026-10-25T08:00:00.000Z","updated_at":"2026-10-25T08:00:00.000Z"}"#,
                ]
            )
            try db.execute(
                sql: #"INSERT INTO "ps_data__gym_profiles" VALUES (?, ?)"#,
                arguments: ["6a7b1e5d-4c2f-4e1b-9b0d-5f3a2c8e7d10", #"{"name":"Your Gym","icon":"building.2.fill","is_default":1,"equipment":"{}","created_at":"2026-10-24T16:06:20.081Z","updated_at":"2026-10-24T16:06:20.081Z"}"#]
            )
        }
        return pool
    }

    static func importLegacy(_ pool: DatabasePool) throws {
        let client = SyncClient(database: pool, schema: syncSchema, endpoint: URL(string: "http://localhost")!, token: { nil })
        try LegacyImport.run(pool, tables: syncSchema.tables, migrate: client.migrate)
    }

    @Test func copiesEveryRowAsAnInsertAndKeepsTheOldRowsAndABackup() throws {
        let pool = try Self.legacyPool()
        try Self.importLegacy(pool)

        let templates = try pool.read { try WorkoutTemplate.fetchAll($0) }.sorted { $0.name < $1.name }
        #expect(templates.map(\.name) == ["Lower", "Upper"])
        #expect(templates.map(\.isArchived) == [false, true])
        #expect(templates.map(\.notes) == ["", ""])
        #expect(templates.map { Instant.text($0.createdAt) } == ["2026-10-25T08:00:00.000Z", "2026-10-24T16:06:20.081Z"])
        #expect(try pool.read { try GymProfile.fetchAll($0) }.map(\.name) == ["Your Gym"])

        let outbox = try pool.read { try Row.fetchAll($0, sql: #"SELECT "table", id, op, col FROM _outbox ORDER BY seq"#) }
        #expect(outbox.map { "\($0["table"] as String) \($0["id"] as String) \($0["op"] as String) \($0["col"] as String? ?? "-")" } == [
            "workout_templates \(Self.upper) insert -",
            "workout_templates \(Self.lower) insert -",
            "gym_profiles 6a7b1e5d-4c2f-4e1b-9b0d-5f3a2c8e7d10 insert -",
        ])
        #expect(try pool.read { try String.fetchAll($0, sql: "SELECT name FROM sqlite_master WHERE type = 'view'") } == [])
        #expect(try pool.read { try String.fetchAll($0, sql: "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name") } == [
            "_meta", "_outbox", "body_weights", "custom_exercises", "exercise_settings", "gym_profiles", "programs",
            "ps_data__gym_profiles", "ps_data__workout_templates", "settings", "sqlite_sequence", "workout_sessions", "workout_templates",
        ])
        #expect(try pool.read { try Int.fetchOne($0, sql: #"SELECT count(*) FROM "ps_data__workout_templates""#) } == 2)
        #expect(try pool.read { try String.fetchOne($0, sql: "SELECT value FROM _meta WHERE key = 'legacy_import'") }?.hasSuffix("Z") == true)

        let backup = try DatabaseQueue(path: Self.backup(beside: pool).path)
        #expect(try backup.read { try Int.fetchOne($0, sql: #"SELECT count(*) FROM "ps_data__workout_templates""#) } == 2)
        #expect(try backup.read { try String.fetchAll($0, sql: "SELECT name FROM sqlite_master WHERE type = 'view'") } == ["workout_templates"])
        #expect(try backup.read { try $0.tableExists("_meta") } == false)
    }

    @Test func aSecondLaunchChangesNothingAndKeepsTheBackup() throws {
        let pool = try Self.legacyPool()
        try Self.importLegacy(pool)
        let importedAt = try pool.read { try String.fetchOne($0, sql: "SELECT value FROM _meta WHERE key = 'legacy_import'") }
        try pool.write { try $0.execute(sql: #"DELETE FROM "ps_data__workout_templates" WHERE id = ?"#, arguments: [Self.lower]) }
        try Self.importLegacy(pool)
        #expect(try pool.read { try WorkoutTemplate.fetchCount($0) } == 2)
        #expect(try pool.read { try Int.fetchOne($0, sql: "SELECT count(*) FROM _outbox") } == 3)
        #expect(try pool.read { try String.fetchOne($0, sql: "SELECT value FROM _meta WHERE key = 'legacy_import'") } == importedAt)

        let backup = try DatabaseQueue(path: Self.backup(beside: pool).path)
        #expect(try backup.read { try Int.fetchOne($0, sql: #"SELECT count(*) FROM "ps_data__workout_templates""#) } == 2)
        #expect(try backup.read { try $0.tableExists("_meta") } == false)
    }

    @Test func aFreshDatabaseOnlyMigrates() throws {
        let pool = try Self.freshPool()
        try Self.importLegacy(pool)
        #expect(try pool.read { try WorkoutTemplate.fetchCount($0) } == 0)
        #expect(try pool.read { try Int.fetchOne($0, sql: "SELECT count(*) FROM _outbox") } == 0)
        #expect(FileManager.default.fileExists(atPath: Self.backup(beside: pool).path) == false)
        #expect(try pool.read { try Int.fetchOne($0, sql: "SELECT count(*) FROM sqlite_master WHERE type = 'trigger'") } == 8 * 2 + syncSchema.tables.reduce(0) { $0 + $1.columns.count })
    }
}
