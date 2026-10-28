import Foundation

/// A meal bucket the ramble model reads and writes: what a speaker says ("for breakfast") and where a copied meal came
/// from. The log itself has no meals, only minutes (`RambleContext.meal(at:)`).
enum RambleMealKind: String, Codable, CaseIterable, Hashable, Sendable {
    case breakfast, lunch, dinner, snack

    /// Where a food said for this meal lands when no clock time was said.
    var defaultMinute: Int {
        switch self {
        case .breakfast: 8 * 60
        case .lunch: 12 * 60 + 30
        case .snack: 15 * 60 + 30
        case .dinner: 19 * 60
        }
    }

    var title: String { rawValue.capitalized }
}

/// A logged entry the speaker can point back at: its id, food name, and a short serving ("0.5 cup").
struct RambleLogged: Codable, Hashable, Sendable {
    var id: String
    var name: String
    var serving: String
}

struct RambleMeal: Codable, Hashable, Sendable {
    var id: String
    var day: CalendarDay
    var meal: RambleMealKind
    var entries: [RambleLogged]
}

/// `RambleRequest` in `server/src/food/ramble.ts`.
struct RambleRequest: Encodable, Hashable, Sendable {
    struct Shown: Encodable, Hashable, Sendable {
        var item: Int
        var options: [String]
    }

    var transcript: String
    var today: CalendarDay
    /// "HH:MM", 24-hour.
    var time: String
    var meals: [RambleMeal]
    var usual: [RambleLogged]
    var shown: [Shown]
    /// Only on the final read: the recording, which the server's model hears more accurately than the transcript.
    var audio: Audio?

    struct Audio: Encodable, Hashable, Sendable {
        /// Base64.
        var data: String
        var mediaType = "audio/wav"
    }
}

/// One line of the model's list, parsed at the boundary: the server's empty strings become nil and its clock a minute.
struct RambleItem: Decodable, Hashable, Sendable {
    enum Kind: String, Decodable, Sendable {
        case food, copy
    }

    var kind: Kind
    var name: String
    /// 0 when no amount was said.
    var amount: Double
    /// "g", "cup", "slice", or "" for a count of the food itself.
    var unit: String
    var ref: String?
    var copy: String?
    var except: [String]
    /// Days from today, 0 or less.
    var day: Int
    var meal: RambleMealKind?
    var minute: Int?
    var options: Bool

    init(
        kind: Kind = .food, name: String = "", amount: Double = 0, unit: String = "", ref: String? = nil, copy: String? = nil,
        except: [String] = [], day: Int = 0, meal: RambleMealKind? = nil, minute: Int? = nil, options: Bool = false
    ) {
        self.kind = kind
        self.name = name
        self.amount = amount
        self.unit = unit
        self.ref = ref
        self.copy = copy
        self.except = except
        self.day = day
        self.meal = meal
        self.minute = minute
        self.options = options
    }

    private enum CodingKeys: String, CodingKey {
        case kind, name, amount, unit, ref, copy, except, day, meal, time, options
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        kind = try container.decode(Kind.self, forKey: .kind)
        name = try container.decode(String.self, forKey: .name)
        amount = try container.decode(Double.self, forKey: .amount)
        unit = try container.decode(String.self, forKey: .unit)
        ref = try container.decodeIfPresent(String.self, forKey: .ref)
        copy = try container.decodeIfPresent(String.self, forKey: .copy)
        except = try container.decode([String].self, forKey: .except)
        day = try container.decode(Int.self, forKey: .day)
        meal = RambleMealKind(rawValue: try container.decode(String.self, forKey: .meal))
        minute = Self.minute(try container.decode(String.self, forKey: .time))
        options = try container.decode(Bool.self, forKey: .options)
    }

    static func minute(_ clock: String) -> Int? {
        let parts = clock.split(separator: ":")
        guard parts.count == 2, let hour = Int(parts[0]), let minute = Int(parts[1]), (0..<24).contains(hour), (0..<60).contains(minute) else { return nil }
        return hour * 60 + minute
    }
}

struct RambleOutline: Decodable, Hashable, Sendable {
    var items: [RambleItem]
}

protocol RambleOutlining: Sendable {
    func outline(_ request: RambleRequest) async throws -> RambleOutline
}

struct RambleError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

/// `POST /api/food-database/ramble` with the bundled owner token, as `MealPhotoClient` posts photos.
struct RambleClient: RambleOutlining {
    static let live = RambleClient(endpoint: AppEnvironment.apiURL.appending(path: "api/food-database/ramble"), token: AppEnvironment.ownerToken)

    let endpoint: URL
    let token: String
    var session = URLSession.shared

    private struct Failure: Decodable { let error: String }

    func outline(_ body: RambleRequest) async throws -> RambleOutline {
        // The server gives Gemini 15 seconds, and the final read uploads the recording.
        var request = URLRequest(url: endpoint, timeoutInterval: 25)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await session.data(for: request)
        guard let response = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        guard response.statusCode == 200 else {
            throw RambleError(message: (try? JSONDecoder().decode(Failure.self, from: data))?.error ?? "The server answered \(response.statusCode).")
        }
        return try JSONDecoder().decode(RambleOutline.self, from: data)
    }
}
