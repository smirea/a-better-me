import Foundation
import os

/// A picture named by a synced row, such as one of `Supplement.images`, with its JPEG.
struct NewPicture: Sendable {
    let id: UUID
    let jpeg: Data
}

/// Picture bytes on this device. A row lists a picture's id and syncs like any other; the bytes never enter the
/// database. A new picture waits in `queue` until the server has it, and every picture shown is kept in `cache`.
/// See `docs/decisions/images.md`.
struct PictureFiles: Sendable {
    /// In Caches, which the system may purge: every file in it can be fetched again.
    let cache: URL
    /// In Application Support: the only copy of a picture until its upload lands.
    let queue: URL

    static let shared = PictureFiles(
        cache: URL.cachesDirectory.appending(path: "a-better-me/pictures"),
        queue: LocalDatabase.directory.appending(path: "picture-uploads")
    )

    private static let log = Logger(subsystem: "com.stefan.a-better-me", category: "pictures")
    /// The server answered for good: the bytes are not a picture it takes, so asking again cannot help.
    private static let permanent: Set<Int> = [400, 413, 415]

    private func file(_ id: UUID, in directory: URL) -> URL {
        directory.appending(path: "\(id.uuidString.lowercased()).jpg")
    }

    private func write(_ jpeg: Data, to url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try jpeg.write(to: url, options: .atomic)
    }

    /// Keeps a new picture until the server has it. Call it before the write that lists the picture, so a row never
    /// names bytes no device holds.
    func add(_ picture: NewPicture) throws {
        try write(picture.jpeg, to: file(picture.id, in: queue))
        keep(picture)
    }

    /// Keeps a picture the server already has, so it shows offline.
    func keep(_ picture: NewPicture) {
        do {
            try write(picture.jpeg, to: file(picture.id, in: cache))
        } catch {
            Self.log.error("Caching a picture failed: \(String(describing: error))")
        }
    }

    /// Drops a picture its row no longer lists. The server's copy goes with its own sweep.
    func remove(_ id: UUID) {
        try? FileManager.default.removeItem(at: file(id, in: queue))
        try? FileManager.default.removeItem(at: file(id, in: cache))
    }

    /// The picture's bytes if this device holds them.
    func local(_ id: UUID) -> Data? {
        (try? Data(contentsOf: file(id, in: cache))) ?? (try? Data(contentsOf: file(id, in: queue)))
    }

    var queued: [UUID] {
        ((try? FileManager.default.contentsOfDirectory(atPath: queue.path)) ?? [])
            .compactMap { UUID(uuidString: String($0.dropLast(".jpg".count))) }
    }

    /// The picture's bytes from this device, else from the server, which caches them. Nil when neither has them: the
    /// device is offline, or the device that took the picture has not uploaded it yet.
    @concurrent func data(_ id: UUID) async -> Data? {
        if let data = local(id) { return data }
        var request = Self.request(id)
        request.httpMethod = "GET"
        guard let (data, response) = try? await URLSession.shared.data(for: request),
              (response as? HTTPURLResponse)?.statusCode == 200 else { return nil }
        keep(NewPicture(id: id, jpeg: data))
        return data
    }

    /// Sends every queued picture, each once. The sync client runs this before a sync that carries writes, so a row
    /// reaches the server after the pictures it lists; a throw fails that sync, which retries.
    @concurrent func uploadQueued() async throws {
        for id in queued {
            let url = file(id, in: queue)
            var request = Self.request(id)
            request.httpMethod = "PUT"
            request.setValue("image/jpeg", forHTTPHeaderField: "Content-Type")
            let (_, response) = try await URLSession.shared.upload(for: request, fromFile: url)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            if status == 200 {
                try? FileManager.default.removeItem(at: url)
            } else if Self.permanent.contains(status) {
                Self.log.error("The server refused picture \(id) for good with \(status); dropping its upload")
                try? FileManager.default.removeItem(at: url)
            } else {
                throw PictureUploadError(status: status)
            }
        }
    }

    private static func request(_ id: UUID) -> URLRequest {
        var request = URLRequest(url: AppEnvironment.apiURL.appending(path: "api/images").appending(queryItems: [
            URLQueryItem(name: "id", value: id.uuidString.lowercased()),
        ]))
        request.setValue("Bearer \(AppEnvironment.ownerToken)", forHTTPHeaderField: "Authorization")
        return request
    }
}

struct PictureUploadError: Error, CustomStringConvertible {
    let status: Int

    var description: String { "A picture upload answered HTTP \(status)" }
}
