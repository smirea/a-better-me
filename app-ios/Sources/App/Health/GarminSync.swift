import Foundation
import os

/// Triggers the server's throttled Garmin sync (`POST /api/garmin/sync`) on launch and foreground, throttled to once
/// every 15 minutes on the client (and enforced again on the server) so opening the app never spams Garmin.
@MainActor
@Observable
final class GarminSync {
    static let shared = GarminSync()
    static let throttleInterval: TimeInterval = 15 * 60

    private static let log = Logger(subsystem: "com.stefan.a-better-me", category: "garmin-sync")

    private(set) var isSyncing = false
    private(set) var lastRequestedAt: Date?

    func refreshIfStale(force: Bool = false) async {
        guard !isSyncing else { return }
        if !force, let last = lastRequestedAt, Date.now.timeIntervalSince(last) < Self.throttleInterval {
            return
        }
        isSyncing = true
        lastRequestedAt = .now
        defer { isSyncing = false }

        let tzMinutes = TimeZone.current.secondsFromGMT() / 60
        var components = URLComponents(url: AppEnvironment.apiURL.appending(path: "api/garmin/sync"), resolvingAgainstBaseURL: false)
        var items = [URLQueryItem(name: "tzOffsetMinutes", value: String(tzMinutes))]
        if force { items.append(URLQueryItem(name: "force", value: "1")) }
        components?.queryItems = items
        guard let url = components?.url else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("Bearer \(AppEnvironment.ownerToken)", forHTTPHeaderField: "Authorization")

        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            if let http = response as? HTTPURLResponse, http.statusCode >= 400 {
                Self.log.warning("Garmin sync answered \(http.statusCode)")
            }
        } catch {
            Self.log.debug("Garmin sync request failed: \(error.localizedDescription, privacy: .public)")
        }
    }
}
