import CryptoKit
import Foundation

/// One asset version's packs, as `bun scripts/assets.ts upload` writes `manifests/<version>.json`. Each pack is the
/// bucket's `blobs/<sha256>`: its files back to back, at the offsets listed here.
struct AssetManifest: Decodable, Equatable, Sendable {
    struct Pack: Decodable, Equatable, Sendable {
        let sha256: String
        let size: Int
        let files: [File]
        /// Names the pack's unpacked directory. The bytes' hash alone is not enough: renaming a file keeps the bytes, so
        /// a directory named by it would still hold the old file name.
        let directory: String

        private enum CodingKeys: String, CodingKey { case sha256, size, files }

        init(sha256: String, size: Int, files: [File]) {
            self.sha256 = sha256
            self.size = size
            self.files = files
            let layout = files.map { "\($0.path)\u{0}\($0.offset)\u{0}\($0.size)\n" }.joined()
            directory = SHA256.hash(data: Data("\(sha256)\n\(layout)".utf8)).hex
        }

        init(from decoder: any Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            try self.init(
                sha256: container.decode(String.self, forKey: .sha256),
                size: container.decode(Int.self, forKey: .size),
                files: container.decode([File].self, forKey: .files)
            )
        }
    }

    struct File: Decodable, Equatable, Sendable {
        let path: String
        let offset: Int
        let size: Int
    }

    let version: String
    let packs: [Pack]

    /// The pack's sha256 names its bucket key and its files land at their paths inside its directory, so a hash that is
    /// not 64 lowercase hex characters or a path with `..` could reach outside the bucket's `blobs/` or the app's.
    static func parse(_ data: Data, version: String) throws(AssetError) -> AssetManifest {
        guard let manifest = try? JSONDecoder().decode(AssetManifest.self, from: data),
              manifest.version == version,
              manifest.packs.allSatisfy({ pack in
                  isBlobName(pack.sha256) && pack.files.allSatisfy { file in
                      isSafePath(file.path) && file.offset >= 0 && file.size >= 0 && file.offset + file.size <= pack.size
                  }
              }) else { throw .badManifest }
        return manifest
    }

    static func isBlobName(_ name: String) -> Bool {
        name.utf8.count == 64 && name.utf8.allSatisfy { (48...57).contains($0) || (97...102).contains($0) }
    }

    static func isSafePath(_ path: String) -> Bool {
        path.split(separator: "/", omittingEmptySubsequences: false).allSatisfy { !$0.isEmpty && $0 != "." && $0 != ".." }
    }

    /// Each pack whose directory is not unpacked yet, once.
    func missing(present: Set<String>) -> [Pack] {
        var seen = present
        return packs.filter { seen.insert($0.directory).inserted }
    }

    func progress(present: Set<String>) -> AssetProgress {
        var seen = Set<String>()
        let unique = packs.filter { seen.insert($0.directory).inserted }
        return AssetProgress(
            bytesDone: unique.reduce(0) { $0 + (present.contains($1.directory) ? $1.size : 0) },
            bytesTotal: unique.reduce(0) { $0 + $1.size }
        )
    }
}

struct AssetProgress: Equatable, Sendable {
    let bytesDone: Int
    let bytesTotal: Int

    var fraction: Double { bytesTotal == 0 ? 1 : Double(bytesDone) / Double(bytesTotal) }
    var bytesLeft: Int { bytesTotal - bytesDone }
}

enum AssetPhase: Equatable, Sendable {
    /// The build has no bucket settings, as in CI and fresh worktrees.
    case off
    case checking
    case waitingForWiFi
    /// Debug builds download only when the Settings row is tapped.
    case waitingForTap
    case downloading
    case complete
    case failed(String)

    /// The Settings row's one line, such as `Assets: downloading · 4.2 of 16.4 MB`.
    func statusLine(_ progress: AssetProgress?, locale: Locale = .current) -> String {
        let megabytes = { (bytes: Int) in
            (Double(bytes) / 1_000_000).formatted(.number.precision(.fractionLength(1)).locale(locale))
        }
        guard let progress else {
            return switch self {
            case .off: "Assets: off"
            case .checking: "Assets: checking…"
            case .waitingForWiFi: "Assets: waiting for Wi-Fi"
            case .waitingForTap: "Assets: tap to download"
            case .downloading: "Assets: downloading"
            case .complete: "Assets: downloaded"
            case .failed(let message): "Assets: \(message)"
            }
        }
        return switch self {
        case .off: "Assets: off"
        case .checking: "Assets: checking…"
        case .complete: "Assets: downloaded · \(megabytes(progress.bytesTotal)) MB"
        case .downloading: "Assets: downloading · \(megabytes(progress.bytesDone)) of \(megabytes(progress.bytesTotal)) MB"
        case .waitingForWiFi: "Assets: \(megabytes(progress.bytesLeft)) MB waiting for Wi-Fi"
        case .waitingForTap: "Assets: \(megabytes(progress.bytesLeft)) MB, tap to download"
        case .failed(let message): "Assets: \(message) · \(megabytes(progress.bytesLeft)) MB left"
        }
    }
}

enum AssetError: Error, Equatable {
    case http(Int)
    case corrupt
    case badManifest

    /// Short enough to share the status line with the sizes.
    static func message(_ error: any Error) -> String {
        switch error {
        case AssetError.http(let status): "HTTP \(status)"
        case AssetError.corrupt: "Corrupt download"
        case AssetError.badManifest: "Bad manifest"
        case let error as URLError where [.notConnectedToInternet, .networkConnectionLost].contains(error.code): "Offline"
        case let error as URLError where error.code == .timedOut: "Timed out"
        case is URLError: "Network error"
        default: "Storage error"
        }
    }
}
