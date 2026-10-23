import Foundation
import PowerSync

/// What the server said about this device's sync, for the Sync screen.
enum SyncReport: Sendable {
    case credentialsAccepted
    /// `GET /api/sync/token` answered 503: this server runs without PowerSync. The app stays local.
    case syncOff
    /// 401: the stored owner token is wrong.
    case badToken
    case rejected([String])
}

struct APIFailure: Error {
    let status: Int
}

/// PowerSync's two calls into the server: a token for the sync stream, and the upload of local writes.
final class SyncConnector: PowerSyncBackendConnectorProtocol {
    private let report: @Sendable (SyncReport) -> Void

    init(report: @escaping @Sendable (SyncReport) -> Void) {
        self.report = report
    }

    private struct TokenResponse: Decodable {
        let token: String
        let endpoint: String
    }

    private struct UploadResponse: Decodable {
        struct Rejected: Decodable {
            let table: String
            let id: String
            let reason: String
        }

        let rejected: [Rejected]
    }

    func fetchCredentials() async throws -> PowerSyncCredentials? {
        guard let token = OwnerToken.read() else { return nil }
        let (data, status) = try await APIClient.send("api/sync/token", token: token)
        switch status {
        case 200:
            let response = try JSONDecoder().decode(TokenResponse.self, from: data)
            report(.credentialsAccepted)
            return PowerSyncCredentials(endpoint: response.endpoint, token: response.token)
        case 503:
            report(.syncOff)
            // PowerSync asks again as soon as this returns, so a server without sync is asked once a minute, not every retry delay.
            try await Task.sleep(for: .seconds(60))
            return nil
        case 401:
            report(.badToken)
            return nil
        default:
            throw APIFailure(status: status)
        }
    }

    /// Posts the queue in batches and completes each on a 200. Any other answer throws, so PowerSync retries the batch.
    func uploadData(database: PowerSyncDatabaseProtocol) async throws {
        guard let token = OwnerToken.read() else { return }
        guard let batch = try await database.getCrudBatch(limit: 1000) else { return }
        let databaseID = DeviceDefaults.databaseID
        let writes = Uploads.coalesce(batch.crud.map { Uploads.write($0, databaseID: databaseID) })
        let body = try JSONEncoder().encode(JsonValue.object(["writes": .array(writes.map(\.wire))]))
        let (data, status) = try await APIClient.send("api/upload", token: token, body: body)
        if status == 401 { report(.badToken) }
        guard status == 200 else { throw APIFailure(status: status) }
        let response = try JSONDecoder().decode(UploadResponse.self, from: data)
        if !response.rejected.isEmpty {
            report(.rejected(response.rejected.map { "\($0.table) \($0.id): \($0.reason)" }))
        }
        try await batch.complete()
    }
}

enum APIClient {
    private static let session: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.waitsForConnectivity = false
        configuration.timeoutIntervalForRequest = 30
        return URLSession(configuration: configuration)
    }()

    /// A GET, or a JSON POST with `body`. Throws on a network failure; any HTTP status is returned.
    static func send(_ path: String, token: String, body: Data? = nil) async throws -> (Data, Int) {
        var request = URLRequest(url: AppEnvironment.apiURL.appending(path: path))
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if let body {
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = body
        }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        return (data, http.statusCode)
    }
}
