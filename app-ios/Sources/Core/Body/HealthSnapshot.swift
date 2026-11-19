import Foundation
import os

/// The last Health read, kept on disk so a launch shows it in the first frame instead of empty cards while HealthKit
/// answers. Health stays the source: every launch and every return to the app reads it again and replaces this. It is
/// in Caches, which is never backed up, and losing it only brings back the empty first frame once.
struct HealthSnapshot: Codable, Equatable, Sendable {
    var weights: [HealthWeight]
    var steps: [DatedValue]
    var flights: [DatedValue]
    var distance: [DatedValue]

    static let url = URL.cachesDirectory.appending(path: "a-better-me/health.json")
    private static let log = Logger(subsystem: "com.stefan.a-better-me", category: "health")

    /// Read synchronously at launch: decoding two years of days measured 2.6 ms on a Mac.
    static func load(from url: URL = url) -> HealthSnapshot? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(HealthSnapshot.self, from: data)
    }

    func save(to url: URL = url) {
        do {
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            try JSONEncoder().encode(self).write(to: url, options: .atomic)
        } catch {
            Self.log.error("Saving the Health snapshot failed: \(String(describing: error))")
        }
    }
}
