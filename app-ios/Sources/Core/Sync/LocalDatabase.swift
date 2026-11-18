import Foundation
import GRDB

final class LocalDatabase: Sendable {
    static let directory = URL.applicationSupportDirectory.appending(path: "a-better-me")
    static let url = directory.appending(path: "a-better-me.sqlite")

    let pool: DatabasePool

    init(at url: URL = LocalDatabase.url) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        pool = try DatabasePool(path: url.path)
    }
}
