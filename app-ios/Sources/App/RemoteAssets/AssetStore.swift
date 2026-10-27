import CryptoKit
import Foundation
import Network
import Observation

/// The catalog's images, downloaded after install instead of bundled, as a few packs rather than one request per file. Release downloads from the private
/// bucket, Debug from the worktree's dev server. Downloads start on their own on Wi-Fi and never notify; the Settings
/// screen's row shows progress and its tap downloads on any network.
@MainActor @Observable
final class AssetStore {
    static let shared = AssetStore()

    private(set) var phase = AssetPhase.off
    /// Bumped when the manifest or the packs on disk change. Only lookups that miss read it, so a placeholder re-renders
    /// when its file arrives and views that already found theirs do not.
    private var revision = 0

    @ObservationIgnored private var source: AssetSource?
    @ObservationIgnored private var manifest: AssetManifest?
    /// Each file's pack directory.
    @ObservationIgnored private var byPath: [String: String] = [:]
    @ObservationIgnored private var present: Set<String> = []
    @ObservationIgnored private var scanned = false
    @ObservationIgnored private var run: Task<Void, Never>?
    @ObservationIgnored private var runAllowsCellular = false
    @ObservationIgnored private var onWiFi = false
    @ObservationIgnored private let monitor = NWPathMonitor()
    @ObservationIgnored private let wifiSession = AssetStore.session(allowsCellular: false)
    @ObservationIgnored private let anySession = AssetStore.session(allowsCellular: true)

    nonisolated private static let concurrency = 6
    nonisolated private static let region = "auto"
    nonisolated private static let root = URL.applicationSupportDirectory.appending(path: "a-better-me/assets")
    nonisolated private static let blobs = root.appending(path: "blobs")
    nonisolated private static let manifests = root.appending(path: "manifests")

    var progress: AssetProgress? {
        _ = revision
        return manifest?.progress(present: present)
    }

    var statusLine: String { phase.statusLine(progress) }

    func start() {
        guard source == nil, let source = AppEnvironment.assets else { return }
        self.source = source
        do {
            try FileManager.default.createDirectory(at: Self.blobs, withIntermediateDirectories: true)
            try FileManager.default.createDirectory(at: Self.manifests, withIntermediateDirectories: true)
            var root = Self.root
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try root.setResourceValues(values)
        } catch {
            phase = .failed("Storage error")
            return
        }
        guard source.downloadsAutomatically else {
            run = Task {
                await loadLocal(source.version)
                run = nil
            }
            return
        }
        monitor.pathUpdateHandler = { [weak self] path in
            let onWiFi = path.status == .satisfied && !path.isExpensive && !path.isConstrained
            Task { @MainActor in self?.pathChanged(onWiFi: onWiFi) }
        }
        monitor.start(queue: .main)
        begin(allowsCellular: false, isRefresh: false)
    }

    /// Shows what is already on disk without touching the network, for builds that download only on the row's tap.
    private func loadLocal(_ version: String) async {
        if let cached = await Self.cachedManifest(version) { use(cached) }
        present = await Self.scan()
        scanned = true
        revision += 1
        phase = manifest.map { $0.missing(present: present).isEmpty } == true ? .complete : .waitingForTap
    }

    /// The settings row's tap: re-checks the manifest and downloads now, on cellular too. A tap during a run is ignored.
    func refresh() {
        begin(allowsCellular: true, isRefresh: true)
    }

    /// The downloaded file at `path`, such as `ExerciseImages/x.webp`, or nil until its pack arrives.
    func url(_ path: String) -> URL? {
        if let directory = byPath[path], present.contains(directory) { return Self.blobs.appending(path: "\(directory)/\(path)") }
        _ = revision
        return nil
    }

    private func begin(allowsCellular: Bool, isRefresh: Bool) {
        guard run == nil, let source else { return }
        runAllowsCellular = allowsCellular
        run = Task {
            await perform(source, allowsCellular: allowsCellular, isRefresh: isRefresh)
            run = nil
            if phase == .waitingForWiFi, onWiFi { begin(allowsCellular: false, isRefresh: false) }
        }
    }

    private func pathChanged(onWiFi: Bool) {
        self.onWiFi = onWiFi
        if onWiFi {
            switch phase {
            case .waitingForWiFi, .failed: begin(allowsCellular: false, isRefresh: false)
            case .off, .checking, .waitingForTap, .downloading, .complete: break
            }
        } else if !runAllowsCellular {
            run?.cancel()
        }
    }

    private func perform(_ source: AssetSource, allowsCellular: Bool, isRefresh: Bool) async {
        phase = .checking
        let session = allowsCellular ? anySession : wifiSession
        do {
            if manifest == nil, !isRefresh, let cached = await Self.cachedManifest(source.version) { use(cached) }
            if isRefresh || !scanned {
                present = await Self.scan()
                scanned = true
                revision += 1
            }
            if isRefresh || manifest == nil {
                guard allowsCellular || onWiFi else { phase = .waitingForWiFi; return }
                use(try await Self.fetchManifest(source, session: session))
            }
            guard let manifest else { return }
            let missing = manifest.missing(present: present)
            if !missing.isEmpty {
                guard allowsCellular || onWiFi else { phase = .waitingForWiFi; return }
                phase = .downloading
                try await download(missing, source: source, session: session)
            }
            present = await Self.prune(keeping: manifest)
            revision += 1
            phase = .complete
        } catch {
            let blockedByNetworkPolicy = Task.isCancelled || (error as? URLError)?.networkUnavailableReason != nil
            phase = !allowsCellular && blockedByNetworkPolicy ? .waitingForWiFi : .failed(AssetError.message(error))
        }
    }

    private func use(_ manifest: AssetManifest) {
        self.manifest = manifest
        byPath = Dictionary(
            manifest.packs.flatMap { pack in pack.files.map { ($0.path, pack.directory) } },
            uniquingKeysWith: { first, _ in first }
        )
        revision += 1
    }

    private func download(_ packs: [AssetManifest.Pack], source: AssetSource, session: URLSession) async throws {
        try await withThrowingTaskGroup(of: String.self) { group in
            var queue = packs.makeIterator()
            for _ in 0..<Self.concurrency {
                guard let pack = queue.next() else { break }
                group.addTask { try await Self.fetchPack(pack, source: source, session: session) }
            }
            while let directory = try await group.next() {
                present.insert(directory)
                revision += 1
                if let pack = queue.next() {
                    group.addTask { try await Self.fetchPack(pack, source: source, session: session) }
                }
            }
        }
    }

    private nonisolated static func session(allowsCellular: Bool) -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.allowsExpensiveNetworkAccess = allowsCellular
        configuration.allowsConstrainedNetworkAccess = allowsCellular
        configuration.httpMaximumConnectionsPerHost = concurrency
        return URLSession(configuration: configuration)
    }

    private nonisolated static func get(_ key: String, source: AssetSource, session: URLSession) async throws -> Data {
        var request = URLRequest(url: source.url.appending(path: key))
        if let credentials = source.credentials {
            request = S3Signer.sign(request, credentials: credentials, region: region, date: .now)
        }
        let (data, response) = try await session.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200 else { throw AssetError.http(status) }
        return data
    }

    private nonisolated static func fetchManifest(_ source: AssetSource, session: URLSession) async throws -> AssetManifest {
        let data = try await get("manifests/\(source.version).json", source: source, session: session)
        let manifest = try AssetManifest.parse(data, version: source.version)
        try data.write(to: manifests.appending(path: "\(source.version).json"), options: .atomic)
        return manifest
    }

    private nonisolated static func cachedManifest(_ version: String) async -> AssetManifest? {
        guard let data = try? Data(contentsOf: manifests.appending(path: "\(version).json")) else { return nil }
        return try? AssetManifest.parse(data, version: version)
    }

    /// Unpacks into a hidden directory only after the pack's size and hash match, then renames it to
    /// `blobs/<directory>/`, so a pack directory is always whole.
    private nonisolated static func fetchPack(_ pack: AssetManifest.Pack, source: AssetSource, session: URLSession) async throws -> String {
        let data = try await get("blobs/\(pack.sha256)", source: source, session: session)
        guard data.count == pack.size, SHA256.hash(data: data).hex == pack.sha256 else { throw AssetError.corrupt }
        let fileManager = FileManager.default
        let staging = blobs.appending(path: ".\(pack.directory)")
        try? fileManager.removeItem(at: staging)
        for file in pack.files {
            let url = staging.appending(path: file.path)
            try fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            try data[file.offset..<file.offset + file.size].write(to: url)
        }
        let destination = blobs.appending(path: pack.directory)
        try? fileManager.removeItem(at: destination)
        try fileManager.moveItem(at: staging, to: destination)
        return pack.directory
    }

    /// Directories only: builds before packs kept each file as a plain `blobs/<sha256>` file.
    private nonisolated static func scan() async -> Set<String> {
        let names = (try? FileManager.default.contentsOfDirectory(atPath: blobs.path)) ?? []
        return Set(names.filter { name in
            var isDirectory: ObjCBool = false
            return AssetManifest.isBlobName(name)
                && FileManager.default.fileExists(atPath: blobs.appending(path: name).path, isDirectory: &isDirectory)
                && isDirectory.boolValue
        })
    }

    /// Deletes packs and cached manifests other versions left behind, once this version's packs are all present.
    private nonisolated static func prune(keeping manifest: AssetManifest) async -> Set<String> {
        let keep = Set(manifest.packs.map(\.directory))
        let fileManager = FileManager.default
        for name in (try? fileManager.contentsOfDirectory(atPath: blobs.path)) ?? [] where !keep.contains(name) {
            try? fileManager.removeItem(at: blobs.appending(path: name))
        }
        for name in (try? fileManager.contentsOfDirectory(atPath: manifests.path)) ?? [] where name != "\(manifest.version).json" {
            try? fileManager.removeItem(at: manifests.appending(path: name))
        }
        return keep
    }
}
