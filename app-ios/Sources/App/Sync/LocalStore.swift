import Foundation
import GRDB
import Observation
import os
import PowerSync
import SwiftUI

/// The app's one database and its sync connection. Every screen reads it through `@Observe` and writes through the
/// methods here, which run one after another in the order they were called, each in one transaction.
@MainActor @Observable
final class LocalStore {
    nonisolated static let log = Logger(subsystem: "com.stefan.a-better-me", category: "store")

    enum SyncState: Equatable {
        case noToken, connecting, connected, offline, syncOff, badToken

        var title: String {
            switch self {
            case .noToken: "Not set up"
            case .connecting: "Connecting"
            case .connected: "Connected"
            case .offline: "Offline"
            case .syncOff: "Sync off on this server"
            case .badToken: "Invalid token"
            }
        }
    }

    @ObservationIgnored let database: LocalDatabase
    /// True once PowerSync's views exist. The app shows its first screen after this.
    private(set) var isReady = false
    /// Writes called but not yet committed. An editor adopts a change from another device only while this is zero.
    private(set) var pendingWrites = 0
    private(set) var pendingUploads = 0
    private(set) var lastSyncedAt: Date?
    /// What the server refused, newest first, for the Sync screen.
    private(set) var rejected: [String] = []
    private(set) var hasToken = OwnerToken.read() != nil

    @ObservationIgnored private let ready: Task<Void, any Error>
    @ObservationIgnored private var lastWrite: Task<Void, Never>?
    @ObservationIgnored private var statusTask: Task<Void, Never>?
    @ObservationIgnored private var uploads: AnyDatabaseCancellable?
    @ObservationIgnored private var connecting: Task<Void, Never>?
    private var connected = false
    private var isConnecting = false
    private var credentialProblem: SyncState?

    init() {
        do {
            database = try LocalDatabase()
        } catch {
            fatalError("Could not open the local database at \(LocalDatabase.url.path): \(error)")
        }
        let database = self.database
        ready = Task { try await database.ready() }
        Task { await becomeReady() }
    }

    private func becomeReady() async {
        do {
            try await ready.value
        } catch {
            fatalError("Could not set up the local database: \(error)")
        }
        isReady = true
        // PowerSync queues a write inside its virtual table, which GRDB's statement analysis cannot see, so the count is
        // re-read after any change rather than on changes to `ps_crud` alone.
        uploads = ValueObservation.tracking(region: .fullDatabase) { try Int.fetchOne($0, sql: "SELECT count(*) FROM ps_crud") ?? 0 }
            .removeDuplicates()
            .start(in: database.pool, scheduling: .immediate, onError: { Self.log.error("Upload count failed: \(String(describing: $0))") }) { [weak self] in
                self?.pendingUploads = $0
            }
        statusTask = Task { [weak self, database] in
            for await status in database.powerSync.currentStatus.asFlow() {
                guard let self else { return }
                connected = status.connected
                // PowerSync keeps "connecting" while it retries an unreachable server; to the owner that is offline.
                isConnecting = status.connecting && status.downloadError == nil
                lastSyncedAt = status.lastSyncedAt
            }
        }
        start()
    }

    // MARK: Writes

    /// Runs `body` in one write transaction after every write called before it. The task resolves with its result.
    @discardableResult
    func write<T: Sendable>(_ body: @escaping @Sendable (Database) throws -> T) -> Task<T, any Error> {
        pendingWrites += 1
        let previous = lastWrite
        let ready = ready
        let pool = database.pool
        let task = Task<T, any Error> {
            defer { pendingWrites -= 1 }
            await previous?.value
            try await ready.value
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

    /// Activates `id` and deactivates every other program in one transaction, so at most one is active. Archiving a
    /// program goes through `editProgram` and clears `isActive` in the same patch.
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

    /// Makes `id` the default gym and clears the flag on every other one in one transaction.
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

    /// A control's binding to one setting, read from the observed `settings` and written through `updateSettings`.
    func binding<Value: Sendable>(_ settings: AppSettings, _ path: WritableKeyPath<AppSettings, Value> & Sendable) -> Binding<Value> {
        Binding(
            get: { settings[keyPath: path] },
            set: { value in self.updateSettings { $0[keyPath: path] = value } }
        )
    }

    /// Reads outside an observation, after the store is ready.
    func read<T>(_ body: (Database) throws -> T) throws -> T {
        try database.pool.read(body)
    }

    // MARK: Sync

    var syncState: SyncState {
        guard hasToken else { return .noToken }
        if let credentialProblem { return credentialProblem }
        if connected { return .connected }
        if isConnecting { return .connecting }
        return .offline
    }

    func setToken(_ token: String?) {
        OwnerToken.write(token)
        hasToken = OwnerToken.read() != nil
        credentialProblem = nil
        Task {
            try? await database.powerSync.disconnect()
            start()
        }
    }

    /// Connects while an owner token is stored. A second call while the first is still connecting joins it.
    func start() {
        guard hasToken, isReady, connecting == nil else { return }
        connecting = Task { await connect() }
    }

    private func connect() async {
        defer { connecting = nil }
        let connector = SyncConnector { [weak self] report in
            Task { @MainActor in self?.handle(report) }
        }
        do {
            // An edit reaches another device within about a second, and a failed upload retries soon.
            try await database.powerSync.connect(connector: connector, options: ConnectOptions(crudThrottle: 0.1, retryDelay: 2))
        } catch {
            Self.log.error("Could not start sync: \(String(describing: error))")
        }
    }

    /// Coming back to the foreground reconnects a dropped stream.
    func resume() {
        guard !connected, !isConnecting else { return }
        start()
    }

    private func handle(_ report: SyncReport) {
        switch report {
        case .credentialsAccepted:
            credentialProblem = nil
        case .syncOff:
            credentialProblem = .syncOff
        case .badToken:
            credentialProblem = .badToken
            Task { try? await database.powerSync.disconnect() }
        case let .rejected(notices):
            Self.log.error("The server refused writes: \(notices.joined(separator: "; "))")
            rejected = Array((notices + rejected).prefix(20))
        }
    }
}
