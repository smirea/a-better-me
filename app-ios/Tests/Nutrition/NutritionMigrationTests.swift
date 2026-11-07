import Foundation
import GRDB
import Testing
@testable import App

/// A database a build before Nutrition wrote gains the new tables and the `settings.nutrition` column on launch, and
/// keeps its rows.
@MainActor
struct NutritionMigrationTests {
    @Test func migratingABeforeNutritionDatabaseAddsTheTablesAndKeepsTheRows() async throws {
        let url = FileManager.default.temporaryDirectory.appending(path: "nutrition-migration-\(UUID().uuidString)/a.sqlite")
        let old = try LocalDatabase(at: url)
        try await old.pool.write { db in
            try db.execute(sql: "CREATE TABLE settings (id TEXT PRIMARY KEY, weight_unit TEXT NOT NULL DEFAULT 'kg', rest_compound_upper INTEGER NOT NULL DEFAULT 120, rest_compound_lower INTEGER NOT NULL DEFAULT 180, rest_upper_isolation INTEGER NOT NULL DEFAULT 90, rest_lower_isolation INTEGER NOT NULL DEFAULT 90, rest_core INTEGER NOT NULL DEFAULT 60, workout TEXT NOT NULL DEFAULT '{}', profile TEXT NOT NULL DEFAULT '{}', dashboard TEXT NOT NULL DEFAULT '{}', shortcuts TEXT NOT NULL DEFAULT '{}')")
            try db.execute(sql: "CREATE TABLE workout_templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', blocks TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, program_id TEXT, gym_id TEXT, archived INTEGER NOT NULL DEFAULT 0)")
            try db.execute(sql: #"INSERT INTO settings (id, weight_unit, profile) VALUES ('settings', 'kg', '{"sex":"female"}')"#)
            try db.execute(sql: "INSERT INTO workout_templates (id, name, created_at, updated_at) VALUES ('10586719-1c40-44d5-a034-79debc185598', 'Upper', '2026-10-24T16:06:20.081Z', '2026-10-24T16:06:20.081Z')")
        }
        try old.pool.close()

        let store = try LocalStore(unsyncedAt: url)
        let tables = try store.readBlocking { try String.fetchAll($0, sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_%' ESCAPE '\\' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' ORDER BY name") }
        #expect(Set(tables) == Set(syncSchema.tables.map(\.name)))
        let settings = try #require(try store.readBlocking { try AppSettings.fetchOne($0, key: AppSettings.rowID) })
        #expect(settings.weightUnit == .kg)
        #expect(settings.profile.sex == .female)
        #expect(settings.nutrition == NutritionSettings())
        #expect(try store.readBlocking { try WorkoutTemplate.fetchAll($0) }.map(\.name) == ["Upper"])

        store.log([FoodPortion(.quickAdd([.energy: 300]))], on: calendarDay("2026-10-26"), minute: 9 * 60)
        try await store.write { _ in }.value
        #expect(try store.readBlocking(FoodEntry.on(calendarDay("2026-10-26")).fetch).count == 1)
    }
}
