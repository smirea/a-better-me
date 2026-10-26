import Foundation

/// One asset version's files, as `bun scripts/assets.ts upload` writes `manifests/<version>.json`. Each file's bytes
/// are the bucket's `blobs/<sha256>`, so files with the same contents share one blob.
struct AssetManifest: Codable, Equatable, Sendable {
    struct File: Codable, Equatable, Sendable {
        let path: String
        let sha256: String
        let size: Int
    }

    let version: String
    let files: [File]

    /// A blob's file name is its sha256, so anything but 64 lowercase hex characters could name a path outside `blobs/`.
    static func parse(_ data: Data, version: String) throws(AssetError) -> AssetManifest {
        guard let manifest = try? JSONDecoder().decode(AssetManifest.self, from: data),
              manifest.version == version,
              manifest.files.allSatisfy({ isBlobName($0.sha256) && $0.size >= 0 }) else { throw .badManifest }
        return manifest
    }

    static func isBlobName(_ name: String) -> Bool {
        name.utf8.count == 64 && name.utf8.allSatisfy { (48...57).contains($0) || (97...102).contains($0) }
    }

    /// One file per blob still to download.
    func missing(present: Set<String>) -> [File] {
        var seen = present
        return files.filter { seen.insert($0.sha256).inserted }
    }

    func progress(present: Set<String>) -> AssetProgress {
        AssetProgress(
            done: files.count { present.contains($0.sha256) },
            total: files.count,
            bytesLeft: missing(present: present).reduce(0) { $0 + $1.size }
        )
    }
}

struct AssetProgress: Equatable, Sendable {
    let done: Int
    let total: Int
    let bytesLeft: Int
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

    /// The Settings row's one line, such as `Assets 1,200/3,002 · 12.4 MB left`.
    func statusLine(_ progress: AssetProgress?, locale: Locale = .current) -> String {
        if self == .off { return "Assets · Off" }
        guard let progress else {
            return switch self {
            case .checking: "Assets · Checking…"
            case .waitingForWiFi: "Assets · Waiting for Wi-Fi"
            case .waitingForTap: "Assets · Tap to download"
            case .failed(let message): "Assets · \(message)"
            case .off, .downloading, .complete: "Assets"
            }
        }
        let count = "Assets \(progress.done.formatted(.number.locale(locale)))/\(progress.total.formatted(.number.locale(locale)))"
        let megabytes = (Double(progress.bytesLeft) / 1_000_000).formatted(.number.precision(.fractionLength(1)).locale(locale))
        return switch self {
        case .off, .complete: count
        case .checking: "\(count) · Checking…"
        case .downloading: "\(count) · \(megabytes) MB left"
        case .waitingForWiFi: "\(count) · \(megabytes) MB waiting for Wi-Fi"
        case .waitingForTap: "\(count) · \(megabytes) MB, tap to download"
        case .failed(let message): "\(count) · \(message)"
        }
    }
}

enum AssetError: Error, Equatable {
    case http(Int)
    case corrupt
    case badManifest

    /// Short enough to share the status line with the counts.
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
