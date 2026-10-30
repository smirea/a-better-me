import Foundation

/// What the speaker has said so far: `committed` is final, `partial` the words still being heard, which may change.
struct RambleHeard: Equatable, Sendable {
    var committed = ""
    var partial = ""

    var text: String { [committed, partial].filter { !$0.isEmpty }.joined(separator: " ") }
    var isEmpty: Bool { committed.isEmpty && partial.isEmpty }
}

/// What the live session reports (`serveLiveRamble` in `server/src/food/ramble-live.ts`).
enum RambleLiveEvent: Sendable, Equatable {
    case heard(RambleHeard)
    case outline(RambleOutline)
    /// After the stop: the outline of every word heard.
    case done(transcript: String, outline: RambleOutline)
    case failed(String)
}

/// One streaming session: 16 kHz mono 16-bit PCM in, events out.
protocol RambleLiveStream: Sendable {
    func send(_ pcm: Data)
    /// The options the rows show now, so a pick spoken next ("the second one") names one of them.
    func show(_ shown: [RambleRequest.Shown])
    func stop()
    func cancel()
}

protocol RambleLiveConnecting: Sendable {
    /// Opens the session with the ramble's context, whose transcript is what earlier listens heard, and returns at once;
    /// audio sent before the server listens is held there. A refused or dropped session arrives as `.failed`.
    func connect(_ context: RambleRequest, onEvent: @escaping @Sendable (RambleLiveEvent) -> Void) -> any RambleLiveStream
}

/// `GET /api/food-database/ramble/live` with the bundled owner token.
struct RambleLiveClient: RambleLiveConnecting {
    static let live = RambleLiveClient(
        endpoint: AppEnvironment.apiURL.appending(path: "api/food-database/ramble/live"), token: AppEnvironment.ownerToken
    )

    let endpoint: URL
    let token: String
    var session = URLSession.shared

    private struct Message: Decodable {
        let type: String
        let committed: String?
        let partial: String?
        let transcript: String?
        let outline: RambleOutline?
        let message: String?
    }

    func connect(_ context: RambleRequest, onEvent: @escaping @Sendable (RambleLiveEvent) -> Void) -> any RambleLiveStream {
        var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false)!
        components.scheme = components.scheme == "http" ? "ws" : "wss"
        var request = URLRequest(url: components.url!)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let task = session.webSocketTask(with: request)
        task.resume()
        if let json = try? JSONEncoder().encode(context), let text = String(data: json, encoding: .utf8) {
            task.send(.string(text)) { _ in }
        }
        Task {
            do {
                while true {
                    guard case let .string(text) = try await task.receive(),
                          let message = try? JSONDecoder().decode(Message.self, from: Data(text.utf8))
                    else { continue }
                    switch message.type {
                    case "heard": onEvent(.heard(RambleHeard(committed: message.committed ?? "", partial: message.partial ?? "")))
                    case "outline": if let outline = message.outline { onEvent(.outline(outline)) }
                    case "done":
                        onEvent(.done(transcript: message.transcript ?? "", outline: message.outline ?? RambleOutline(items: [])))
                        return
                    case "error":
                        onEvent(.failed(message.message ?? "The live ramble failed."))
                        return
                    default: continue
                    }
                }
            } catch {
                onEvent(.failed(String(describing: error)))
            }
        }
        return Socket(task: task)
    }

    private struct Socket: RambleLiveStream {
        let task: URLSessionWebSocketTask

        private struct Show: Encodable {
            var type = "shown"
            let shown: [RambleRequest.Shown]
        }

        func send(_ pcm: Data) {
            task.send(.data(pcm)) { _ in }
        }

        func show(_ shown: [RambleRequest.Shown]) {
            guard let json = try? JSONEncoder().encode(Show(shown: shown)), let text = String(data: json, encoding: .utf8) else { return }
            task.send(.string(text)) { _ in }
        }

        func stop() {
            task.send(.string(#"{"type":"stop"}"#)) { _ in }
        }

        func cancel() {
            task.cancel(with: .goingAway, reason: nil)
        }
    }
}
