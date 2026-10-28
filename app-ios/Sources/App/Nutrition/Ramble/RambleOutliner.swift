import Foundation
import os

/// Keeps the model's outline of a ramble current while it is spoken, so stopping rarely waits on a request. Each
/// request sends the whole transcript. One is in flight at a time, sent once the words pause for `settle` or after
/// `maxWait` of speech without a pause; a newer transcript replaces the one waiting. Two failures in a row turn it off
/// for the capture, so a passing outage costs one read. Ported from procrastimate's `RambleOutliner`.
@MainActor
final class RambleOutliner {
    typealias Request = @MainActor (String) async throws -> RambleOutline

    nonisolated static let log = Logger(subsystem: "com.stefan.a-better-me", category: "ramble")

    private(set) var latest: (transcript: String, outline: RambleOutline)?
    private(set) var off = false
    private var failures = 0
    private var pending: String?
    private var inflight: (transcript: String, task: Task<RambleOutline?, Never>)?
    private var timer: Task<Void, Never>?
    /// When the oldest unsent words arrived, so nonstop speech still gets read.
    private var waitingSince: ContinuousClock.Instant?
    private let request: Request
    private let onOutline: (String, RambleOutline) -> Void
    private let settleDelay: Duration
    private let maxWait: Duration

    init(
        settle: Duration = .milliseconds(500),
        maxWait: Duration = .seconds(2),
        request: @escaping Request,
        onOutline: @escaping (String, RambleOutline) -> Void
    ) {
        self.request = request
        self.onOutline = onOutline
        settleDelay = settle
        self.maxWait = maxWait
    }

    func update(_ transcript: String) {
        guard !off, !Self.blank(transcript), transcript != latest?.transcript else { return }
        pending = transcript
        let since = waitingSince ?? .now
        waitingSince = since
        timer?.cancel()
        guard inflight == nil else { return }
        let delay = max(.zero, min(settleDelay, maxWait - (ContinuousClock.now - since)))
        timer = Task { [weak self] in
            try? await Task.sleep(for: delay)
            guard !Task.isCancelled else { return }
            self?.send()
        }
    }

    /// The outline of exactly `transcript`: the latest answer when it read these words, else a fresh request that
    /// replaces a stale one in flight. Nil when there is none within `timeout` or the outliner is off.
    func settle(_ transcript: String, timeout: Duration) async -> RambleOutline? {
        timer?.cancel()
        if let latest, latest.transcript == transcript { return latest.outline }
        guard !off, !Self.blank(transcript) else { return nil }
        if inflight?.transcript != transcript {
            inflight?.task.cancel()
            inflight = nil
            pending = transcript
            send()
        }
        guard let task = inflight?.task else { return nil }
        let first = FirstAnswer<RambleOutline?>()
        return await withCheckedContinuation { continuation in
            first.continuation = continuation
            Task { first.answer(await task.value) }
            Task {
                try? await Task.sleep(for: timeout)
                if first.continuation != nil { Self.log.info("Ramble outline timed out after \(timeout)") }
                first.answer(nil)
            }
        }
    }

    func stop() {
        timer?.cancel()
        inflight?.task.cancel()
        inflight = nil
        off = true
    }

    private func send() {
        guard let transcript = pending else { return }
        pending = nil
        waitingSince = nil
        let task = Task { [weak self, request] () -> RambleOutline? in
            do {
                let outline = try await request(transcript)
                guard !Task.isCancelled, let self else { return nil }
                failures = 0
                latest = (transcript, outline)
                onOutline(transcript, outline)
                return outline
            } catch {
                if !Task.isCancelled, let self {
                    Self.log.error("Ramble outline failed: \(String(describing: error))")
                    failures += 1
                    if failures >= 2 { off = true }
                }
                return nil
            }
        }
        inflight = (transcript, task)
        Task { [weak self] in
            _ = await task.value
            guard let self, inflight?.task == task else { return }
            inflight = nil
            if pending != nil, !off { send() }
        }
    }

    nonisolated private static func blank(_ text: String) -> Bool { text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
}

/// Resumes once, with whichever answer comes first.
@MainActor
private final class FirstAnswer<Value: Sendable> {
    var continuation: CheckedContinuation<Value, Never>?

    func answer(_ value: Value) {
        continuation?.resume(returning: value)
        continuation = nil
    }
}
