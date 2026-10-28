import Foundation

/// What the Gemini Live session reports (`serveLiveRamble` in `server/src/food/ramble-live.ts`).
enum RambleLiveEvent: Sendable, Equatable {
    case transcript(String)
    case outline(RambleOutline)
    /// After the stop: Gemini answered every word it heard.
    case done(transcript: String, outline: RambleOutline)
    case failed(String)
}

/// One streaming session: 16 kHz mono 16-bit PCM in, events out.
protocol RambleLiveStream: Sendable {
    func send(_ pcm: Data)
    func stop()
    func cancel()
}

protocol RambleLiveConnecting: Sendable {
    /// Opens the session with the ramble's context and returns at once; audio sent before Gemini is ready is held on
    /// the server. A refused or dropped session arrives as `.failed`.
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
        let text: String?
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
        var body = context
        body.transcript = ""
        if let json = try? JSONEncoder().encode(body), let text = String(data: json, encoding: .utf8) {
            task.send(.string(text)) { _ in }
        }
        Task {
            do {
                while true {
                    guard case let .string(text) = try await task.receive(),
                          let message = try? JSONDecoder().decode(Message.self, from: Data(text.utf8))
                    else { continue }
                    switch message.type {
                    case "transcript": onEvent(.transcript(message.text ?? ""))
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

        func send(_ pcm: Data) {
            task.send(.data(pcm)) { _ in }
        }

        func stop() {
            task.send(.string(#"{"type":"stop"}"#)) { _ in }
        }

        func cancel() {
            task.cancel(with: .goingAway, reason: nil)
        }
    }
}

/// The transcript while Gemini Live listens: Gemini's words for the turns it has answered, then the device's words
/// past as many as Gemini's hold, so text keeps pace with the speaker although Gemini transcribes a turn only once it
/// closes. Both spell most numbers in as many words, and the next turn corrects the rest.
struct RambleLiveTranscript: Equatable {
    private(set) var gemini = ""
    private var device: [Substring] = []

    var text: String {
        let rest = device.dropFirst(gemini.split(whereSeparator: \.isWhitespace).count).joined(separator: " ")
        if gemini.isEmpty { return rest }
        return rest.isEmpty ? gemini : "\(gemini) \(rest)"
    }

    mutating func heardOnDevice(_ text: String) {
        device = text.split(whereSeparator: \.isWhitespace)
    }

    mutating func heardByGemini(_ text: String) {
        gemini = text
    }
}
