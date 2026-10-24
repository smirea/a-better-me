import Foundation
import GRDB
import SyncEngine
import Testing
@testable import App

/// Every model's fresh value inserts into the generated DDL and reads back equal. The old layout had no constraints,
/// so a NULL in a NOT NULL column surfaced only as a failed write at runtime.
@MainActor
struct RecordRoundTripTests {
    static let at = Date(timeIntervalSince1970: 1_761_321_600)

    static func migratedPool() throws -> DatabasePool {
        let pool = try DatabasePool(path: FileManager.default.temporaryDirectory.appending(path: "fresh-\(UUID().uuidString).sqlite").path)
        let client = SyncClient(database: pool, schema: syncSchema, endpoint: URL(string: "http://localhost")!, token: { nil })
        try client.migrate()
        return pool
    }

    @Test func freshValuesInsertAndReadBack() throws {
        let pool = try Self.migratedPool()
        var template = WorkoutTemplate(name: "Upper")
        template.createdAt = Self.at
        template.updatedAt = Self.at
        let session = WorkoutSession(name: "Upper", startedAt: Self.at)
        let exerciseSettings = ExerciseSettings(id: "19f5c6f170d8808bb424e98de4472a7e")
        var program = Program(name: "PPL", color: .teal, cycles: 6)
        program.createdAt = Self.at
        program.updatedAt = Self.at
        var gym = GymProfile(name: "Garage")
        gym.createdAt = Self.at
        gym.updatedAt = Self.at
        let weight = BodyWeight(weightKg: 80, measuredAt: Self.at)
        try pool.write { db in
            try template.insert(db)
            try session.insert(db)
            try exerciseSettings.insert(db)
            try AppSettings().insert(db)
            try program.insert(db)
            try gym.insert(db)
            try weight.insert(db)
        }
        try pool.read { db in
            #expect(try WorkoutTemplate.fetchOne(db, key: template.key) == template)
            #expect(try WorkoutSession.fetchOne(db, key: session.key) == session)
            #expect(try ExerciseSettings.fetchOne(db, key: exerciseSettings.id) == exerciseSettings)
            #expect(try Program.fetchOne(db, key: program.key) == program)
            #expect(try GymProfile.fetchOne(db, key: gym.key) == gym)
            #expect(try BodyWeight.fetchOne(db, key: weight.key) == weight)
            let settings = try #require(try AppSettings.fetchOne(db, key: AppSettings.rowID))
            #expect(settings.weightUnit == .lb)
            #expect(RestCategory.allCases.map(settings.restSeconds) == [120, 180, 90, 90, 60])
            #expect(try Int.fetchOne(db, sql: "SELECT count(*) FROM _outbox WHERE op = 'insert'") == 7)
        }
    }

    @Test func aSettingsChangeIsOneUpdateRow() throws {
        let pool = try Self.migratedPool()
        try pool.write { db in
            try AppSettings().insert(db)
            let existing = try AppSettings.fetchOne(db, key: AppSettings.rowID)!
            var changed = existing
            changed.workout.rest.enabled = false
            try changed.updateChanges(db, from: existing)
        }
        let outbox = try pool.read { try Row.fetchAll($0, sql: #"SELECT op, col FROM _outbox ORDER BY seq"#) }
        #expect(outbox.map { "\($0["op"] as String) \($0["col"] as String? ?? "-")" } == ["insert -", "update workout"])
    }
}
