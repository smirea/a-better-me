import Foundation
import GRDB
import Observation
import os
import SwiftUI
import SyncEngine

/// The app's one database and its sync client. Every screen reads it through `@Observe` and writes through the
/// methods here, which run one after another in the order they were called, each in one transaction.
@MainActor @Observable
final class LocalStore {
    nonisolated static let log = Logger(subsystem: "com.stefan.a-better-me", category: "store")

    @ObservationIgnored let database: LocalDatabase
    @ObservationIgnored private let client: SyncClient
    /// Writes called but not yet committed. An editor adopts a change from another device only while this is zero.
    private(set) var pendingWrites = 0

    @ObservationIgnored private var lastWrite: Task<Void, Never>?

    init() {
        do {
            database = try LocalDatabase()
            client = SyncClient(
                database: database.pool, schema: syncSchema, endpoint: AppEnvironment.apiURL.appending(path: "api"),
                token: { AppEnvironment.ownerToken }
            )
            try LegacyImport.run(database.pool, tables: syncSchema.tables, migrate: client.migrate)
        } catch {
            fatalError("Could not open the local database at \(LocalDatabase.url.path): \(error)")
        }
        client.start()
        Telemetry.watch(client)
    }

    // MARK: Writes

    /// Runs `body` in one write transaction after every write called before it. The task resolves with its result.
    @discardableResult
    func write<T: Sendable>(_ body: @escaping @Sendable (Database) throws -> T) -> Task<T, any Error> {
        pendingWrites += 1
        let previous = lastWrite
        let pool = database.pool
        let task = Task<T, any Error> {
            defer { pendingWrites -= 1 }
            await previous?.value
            do {
                return try await pool.write(body)
            } catch {
                Self.log.error("A write failed: \(String(describing: error))")
                throw error
            }
        }
        lastWrite = Task { _ = await task.result }
        return task
    }

    func insert(_ record: some SyncedRecord) {
        write { try record.insert($0) }
    }

    func delete<R: SyncedRecord>(_: R.Type, id: R.ID) {
        write { _ = try R.deleteOne($0, key: R.key(id)) }
    }

    /// Changes the row with `id`, writing only the columns that differ. A missing row is made from `orInsert` first, or
    /// left alone when there is none to make.
    func modify<R: SyncedRecord>(
        _: R.Type, id: R.ID, orInsert make: (@Sendable () -> R)? = nil, _ change: @escaping @Sendable (inout R) -> Void
    ) {
        write { db in
            if let existing = try R.fetchOne(db, key: R.key(id)) {
                var changed = existing
                change(&changed)
                try changed.updateChanges(db, from: existing)
            } else if let make {
                var fresh = make()
                change(&fresh)
                try fresh.insert(db)
            }
        }
    }

    func editTemplate(_ id: UUID, _ change: @escaping @Sendable (inout WorkoutTemplate) -> Void) {
        modify(WorkoutTemplate.self, id: id) {
            change(&$0)
            $0.updatedAt = .now
        }
    }

    func editProgram(_ id: UUID, _ change: @escaping @Sendable (inout Program) -> Void) {
        modify(Program.self, id: id) {
            change(&$0)
            $0.updatedAt = .now
        }
    }

    func activateProgram(_ id: UUID) {
        write { db in
            for program in try Program.fetchAll(db) where program.isActive != (program.id == id) {
                var changed = program
                changed.isActive = program.id == id
                changed.updatedAt = .now
                try changed.updateChanges(db, from: program)
            }
        }
    }

    func setDefaultGym(_ id: UUID) {
        write { db in
            for gym in try GymProfile.fetchAll(db) where gym.isDefault != (gym.id == id) {
                var changed = gym
                changed.isDefault = gym.id == id
                changed.updatedAt = .now
                try changed.updateChanges(db, from: gym)
            }
        }
    }

    /// The settings row is patched, never put whole, except the first time a device creates it.
    func updateSettings(_ change: @escaping @Sendable (inout AppSettings) -> Void) {
        modify(AppSettings.self, id: AppSettings.rowID, orInsert: { AppSettings() }, change)
    }

    func binding<Value: Sendable>(_ settings: AppSettings, _ path: WritableKeyPath<AppSettings, Value> & Sendable) -> Binding<Value> {
        Binding(
            get: { settings[keyPath: path] },
            set: { value in self.updateSettings { $0[keyPath: path] = value } }
        )
    }

    /// Reads outside an observation.
    func read<T>(_ body: (Database) throws -> T) throws -> T {
        try database.pool.read(body)
    }

    // MARK: Sync

    var lastSyncedAt: Date? { client.lastSyncAt }
    var snapshotRows: Int? { client.snapshotRows }
}
