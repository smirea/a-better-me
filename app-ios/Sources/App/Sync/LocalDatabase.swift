import Foundation
import GRDB
import PowerSync
import PowerSyncGRDB

/// The device's PowerSync database, `Application Support/a-better-me/a-better-me.sqlite`. GRDB reads and writes it
/// through PowerSync's views of the synced tables; PowerSync queues every local write for upload and applies what the
/// server streams.
final class LocalDatabase: Sendable {
    static let directory = URL.applicationSupportDirectory.appending(path: "a-better-me")
    static let url = directory.appending(path: "a-better-me.sqlite")

    let pool: DatabasePool
    let powerSync: PowerSyncDatabaseProtocol

    init() throws {
        try FileManager.default.createDirectory(at: Self.directory, withIntermediateDirectories: true)
        var configuration = Configuration()
        try configuration.configurePowerSync(schema: syncSchema)
        pool = try DatabasePool(path: Self.url.path, configuration: configuration)
        powerSync = openPowerSyncWithGRDB(
            pool: pool, schema: syncSchema, identifier: Self.url.lastPathComponent,
            logger: DefaultLogger(minSeverity: .warning)
        )
    }

    /// PowerSync creates its tables and views on its first call, so nothing reads or writes the file before this returns.
    func ready() async throws {
        _ = try await powerSync.getPowerSyncVersion()
    }
}
