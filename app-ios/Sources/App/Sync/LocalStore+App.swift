import Foundation
import SwiftUI
import SyncEngine

extension LocalStore {
    /// The app's store: the database file, synced with the server the build points at.
    convenience init() {
        let database: LocalDatabase
        let client: SyncClient
        do {
            database = try LocalDatabase()
            client = SyncClient(
                database: database.pool, schema: syncSchema, endpoint: AppEnvironment.apiURL.appending(path: "api"),
                token: { AppEnvironment.ownerToken },
                beforePush: { try await PictureFiles.shared.uploadQueued() }
            )
            try LegacyImport.run(database.pool, tables: syncSchema.tables, migrate: client.migrate)
            try LegacySupplementImages.move(database.pool, into: .shared)
            try SpaceResync.backUpIfNeeded(database.pool)
        } catch {
            fatalError("Could not open the local database at \(LocalDatabase.url.path): \(error)")
        }
        self.init(database: database, client: client)
        client.start()
        Telemetry.watch(client)
        watchSyncSpace()
    }

    func binding<Value: Sendable>(_ settings: AppSettings, _ path: WritableKeyPath<AppSettings, Value> & Sendable) -> Binding<Value> {
        Binding(
            get: { settings[keyPath: path] },
            set: { value in self.updateSettings { $0[keyPath: path] = value } }
        )
    }
}
