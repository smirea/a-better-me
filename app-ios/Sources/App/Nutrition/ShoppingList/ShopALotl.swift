import Foundation
import Security

/// ShopALotl, the owner's shopping list app. A recipe's ingredients go onto one of its lists through its server
/// (`GET /api/lists`, `POST /api/add-items`), with the URL and owner token ShopALotl shares at every launch in the team
/// keychain group, as ProcrastiMate does for Notouroboros. Nothing to set up: ShopALotl having run once on this phone
/// is the link. See `docs/decisions/nutrition.md`.
enum ShopALotl {
    struct List: Decodable, Hashable, Identifiable {
        let id: String
        let name: String
        let needed: Int
    }

    /// An existing list, or a new one by name.
    enum Destination {
        case list(id: String)
        case new(name: String)
    }

    struct Item: Encodable, Hashable {
        let name: String
        let quantity: String
    }

    struct Added: Decodable {
        struct Target: Decodable {
            let id: String
            let name: String
        }

        let list: Target
        let added: Int
        let alreadyNeeded: Int
    }

    enum Failure: LocalizedError {
        case notLinked
        case refused(String)
        case unreachable

        var errorDescription: String? {
            switch self {
            case .notLinked: "Open ShopALotl once on this iPhone to link it."
            case let .refused(reason): reason
            case .unreachable: "Couldn't reach ShopALotl's server. Check the connection and try again."
            }
        }
    }

    /// The first list, which ShopALotl has without a row and adds to by default.
    static let mainListID = "main"

    static func lists() async throws -> [List] {
        struct Lists: Decodable { let lists: [List] }
        return try await request("GET", "api/lists", as: Lists.self).lists
    }

    /// `source` is the recipe, which ShopALotl shows beside each item it adds.
    static func add(_ items: [Item], to destination: Destination, recipeID: UUID, recipeName: String) async throws -> Added {
        struct Body: Encodable {
            let list: [String: String]
            let source: [String: String]
            let items: [Item]
        }
        let list: [String: String] = switch destination {
        case let .list(id): ["id": id]
        case let .new(name): ["name": name]
        }
        let body = Body(
            list: list, source: ["app": "a-better-me", "id": recipeID.uuidString.lowercased(), "title": recipeName], items: items
        )
        return try await request("POST", "api/add-items", body: body, as: Added.self)
    }

    /// `shopalotl://list?id=<listId>` opens that list in ShopALotl.
    static func listURL(_ id: String) -> URL {
        var components = URLComponents()
        components.scheme = "shopalotl"
        components.host = "list"
        components.queryItems = [URLQueryItem(name: "id", value: id)]
        return components.url!
    }

    private struct Refusal: Decodable {
        let error: String
    }

    private struct Link: Decodable {
        let apiURL: URL
        let token: String
    }

    private static func link() throws -> Link {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "shopalotl-link",
            kSecAttrAccount as String: "default",
            kSecAttrAccessGroup as String: "FNYFHG5SV7.com.stefan.shared",
            kSecReturnData as String: true,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess, let data = result as? Data,
              let link = try? JSONDecoder().decode(Link.self, from: data)
        else { throw Failure.notLinked }
        return link
    }

    private static func request<Response: Decodable>(
        _ method: String, _ path: String, body: (some Encodable)? = nil as String?, as type: Response.Type
    ) async throws -> Response {
        let link = try link()
        var request = URLRequest(url: link.apiURL.appending(path: path), timeoutInterval: 15)
        request.httpMethod = method
        request.setValue("Bearer \(link.token)", forHTTPHeaderField: "Authorization")
        if let body {
            request.httpBody = try JSONEncoder().encode(body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw Failure.unreachable
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            if status == 401 { throw Failure.refused("ShopALotl's link is out of date. Open ShopALotl to refresh it.") }
            let reason = (try? JSONDecoder().decode(Refusal.self, from: data))?.error ?? "ShopALotl answered \(status)."
            throw Failure.refused(reason)
        }
        return try JSONDecoder().decode(Response.self, from: data)
    }
}
