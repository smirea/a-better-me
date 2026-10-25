import CryptoKit
import Foundation
import GRDB

/// A row of the synced `api_tokens` table: a bot token for the agent API at `<API_URL>/api`. Only the token's SHA-256
/// syncs, so the token itself exists only in the sheet that shows it once. Revoking deletes the row.
struct ApiToken: SyncedRecord {
    static let table = "api_tokens"

    var id: UUID
    var name: String
    var tokenHash: String
    /// The token's first characters, so the owner can tell tokens apart.
    var hint: String
    var createdAt: Date

    /// A fresh `abm_` token and the row that authorizes it.
    static func make(name: String) -> (token: String, row: ApiToken) {
        var bytes = [UInt8](repeating: 0, count: 32)
        precondition(SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess, "No secure random bytes")
        let token = "abm_" + Data(bytes).base64EncodedString()
            .replacing("+", with: "-").replacing("/", with: "_").replacing("=", with: "")
        let hash = SHA256.hash(data: Data(token.utf8)).map { String(format: "%02x", $0) }.joined()
        return (token, ApiToken(id: UUID(), name: name, tokenHash: hash, hint: String(token.prefix(10)), createdAt: .now))
    }

    init(id: UUID, name: String, tokenHash: String, hint: String, createdAt: Date) {
        self.id = id
        self.name = name
        self.tokenHash = tokenHash
        self.hint = hint
        self.createdAt = createdAt
    }

    init(row: Row) throws {
        id = try row.uuid("id")
        name = row["name"]
        tokenHash = row["token_hash"]
        hint = row["hint"] ?? ""
        createdAt = try row.instant("created_at")
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = key
        container["name"] = name
        container["token_hash"] = tokenHash
        container["hint"] = hint
        container["created_at"] = Instant.text(createdAt)
    }
}

extension ApiToken {
    static let all = DatabaseQuery([ApiToken]()) { db in
        try ApiToken.fetchAll(db).sorted { $0.createdAt > $1.createdAt }
    }
}
