import CryptoKit
import Foundation
import FoundationModels
import GRDB
import os

/// A row of the synced `food_short_names` table: the on-device model's one- or two-word name for a food ("Rolled
/// oats" for "Organic Old-Fashioned Rolled Oats By 365 Whole Foods Market"), which a logged recipe's tile shows on its
/// ingredient lines. Keyed by the food's name and brand rather than its id, so a snapshot without an id (the dev seed,
/// MacroFactor imports) is covered, and a renamed food is asked again instead of keeping a name that no longer fits.
struct FoodShortName: SyncedRecord {
    static let table = "food_short_names"

    var id: String
    var name: String
    var createdAt = Date.now

    init(id: String, name: String) {
        self.id = id
        self.name = name
    }

    init(row: Row) throws {
        id = row["id"]
        name = row["name"]
        createdAt = try row.instant("created_at")
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = id
        container["name"] = name
        container["created_at"] = Instant.text(createdAt)
    }

    /// A digest of the food's display name, ignoring case, the same on every device.
    static func rowID(name: String, brand: String?) -> String {
        let text = FoodSnapshot.displayName(name: name, brand: brand).lowercased()
        return SHA256.hash(data: Data(text.utf8)).prefix(16).map { String(format: "%02x", $0) }.joined()
    }

    static func rowID(for food: FoodSnapshot) -> String { rowID(name: food.name, brand: food.brand) }

    /// What a line shows until the model's name lands, and for good where the model can't run: the name up to its
    /// first comma, without the brand, so USDA's "Pepper, banana, raw" reads "Pepper".
    static func fallback(_ food: FoodSnapshot) -> String {
        let lead = food.name.split(separator: ",", maxSplits: 1).first.map { $0.trimmingCharacters(in: .whitespaces) } ?? ""
        return lead.isEmpty ? food.name : lead
    }

    /// A name of one or two words and no comma is short already, so the model is never asked about it.
    static func needsModel(_ name: String) -> Bool {
        name.contains(",") || name.split(whereSeparator: \.isWhitespace).count > 2
    }

    /// The answer as a line shows it, sentence case, or nil when it isn't one or two words.
    static func cleaned(_ answer: String) -> String? {
        let words = answer.trimmingCharacters(in: .whitespacesAndNewlines.union(CharacterSet(charactersIn: "\"'“”.")))
            .split(whereSeparator: \.isWhitespace)
        guard (1...2).contains(words.count) else { return nil }
        let name = words.joined(separator: " ")
        return name.prefix(1).uppercased() + name.dropFirst()
    }
}

/// Names a food in one or two words from its display name, brand included.
protocol FoodShortNameModel: Sendable {
    /// False while the device can't run it: not eligible, Apple Intelligence off, or the model still downloading.
    var isAvailable: Bool { get }
    func shortName(for food: String) async throws -> String
}

/// Apple's on-device general model with greedy sampling, as `OnDeviceFoodIconModel` uses it. A regex guide limiting
/// the answer to two words fails with UnsupportedGuide, so `FoodShortName.cleaned` drops a longer one instead. The
/// instructions are the best of eight measured on 55 names (`FoodShortNamesTests`): an example kind such as "sourdough
/// bread" made the model name other breads sourdough, and "in words from its name" stopped it inventing kinds.
struct OnDeviceFoodShortNameModel: FoodShortNameModel {
    private let model = SystemLanguageModel.default

    var isAvailable: Bool { model.isAvailable }

    func shortName(for food: String) async throws -> String {
        let session = LanguageModelSession(model: model, instructions: Self.instructions)
        return try await session.respond(to: "Food: \(food)", generating: ShortFoodName.self, options: GenerationOptions(samplingMode: .greedy)).content.name
    }

    private static let instructions = """
        You give each food in a nutrition log a short name of one or two words: the food itself, as a person would \
        call it, in words from its name. Keep the word that tells it apart from similar foods, such as olive oil, \
        almond milk, or protein bar. Name what the food is, never only its flavor. Leave out the brand, which follows \
        "By", and words such as organic, raw, cooked, or plain. USDA names lead with the food and list details after \
        commas: "Pepper, banana, raw" is "Banana pepper". Translate a foreign name to English.
        """
}

@Generable
private struct ShortFoodName {
    @Guide(description: "What a person calls the food, one or two words")
    var name: String
}

/// Gives every food a logged recipe's tile can list, the recipes' ingredients and the altered entries' foods, a short
/// name from the on-device model, stored in `food_short_names`. It watches recipes and entries, so a recipe saved or
/// synced in is named as it lands and the first launch backfills the rest. Without the model nothing is asked and the
/// lines show `FoodShortName.fallback`; a food the model fails on is asked again next launch.
@MainActor
final class FoodShortNaming {
    static let shared = FoodShortNaming(model: OnDeviceFoodShortNameModel())
    nonisolated static let log = Logger(subsystem: "com.stefan.a-better-me", category: "food-short-names")

    private let model: any FoodShortNameModel
    private var store: LocalStore?
    private var observation: AnyDatabaseCancellable?
    private var queue: [Candidate] = []
    /// Foods asked about this launch, by key, so a food the model fails on is not asked again until the next one.
    private var asked: Set<String> = []
    private var worker: Task<Void, Never>?

    struct Candidate: Equatable, Sendable {
        let key: String
        let food: String
    }

    init(model: any FoodShortNameModel) {
        self.model = model
    }

    func start(store: LocalStore) {
        guard self.store == nil else { return }
        self.store = store
        observation = ValueObservation.tracking(Self.candidates).removeDuplicates().start(
            in: store.database.pool,
            scheduling: .async(onQueue: .main),
            onError: { Self.log.error("Observing ingredients without short names failed: \(String(describing: $0))") },
            onChange: { candidates in MainActor.assumeIsolated { [weak self] in self?.receive(candidates) } }
        )
    }

    /// Returns once every food without a short name at the call has been asked about and its name written, for tests.
    func idle() async {
        guard let store else { return }
        try? await store.write { _ in }.value
        if let current = try? await store.read(Self.candidates) { receive(current) }
        while let worker { await worker.value }
        try? await store.write { _ in }.value
    }

    /// The newest recipes' ingredients first, so a recipe just saved is named before an old backlog.
    nonisolated static let candidates: @Sendable (Database) throws -> [Candidate] = { db in
        let named = try Set(String.fetchAll(db, sql: "SELECT id FROM food_short_names"))
        let rows = try Row.fetchAll(db, sql: """
            SELECT json_extract(i.value, '$.food.name') AS name, json_extract(i.value, '$.food.brand') AS brand
            FROM (SELECT ingredients AS foods, updated_at FROM recipes
                  UNION ALL SELECT alterations, updated_at FROM food_entries WHERE alterations IS NOT NULL) AS lists,
                 json_each(lists.foods) AS i
            ORDER BY lists.updated_at DESC
            """)
        var seen: Set<String> = []
        return rows.compactMap { row in
            guard let name: String = row["name"], FoodShortName.needsModel(name) else { return nil }
            let brand: String? = row["brand"]
            let key = FoodShortName.rowID(name: name, brand: brand)
            guard !named.contains(key), seen.insert(key).inserted else { return nil }
            return Candidate(key: key, food: FoodSnapshot.displayName(name: name, brand: brand))
        }
    }

    private func receive(_ candidates: [Candidate]) {
        guard model.isAvailable else { return }
        // Rebuilt in the candidates' order, so a recipe saved during the first launch's backfill goes next rather
        // than after the whole backlog.
        queue = candidates.filter { !asked.contains($0.key) }
        guard worker == nil, !queue.isEmpty else { return }
        worker = Task {
            while !queue.isEmpty {
                let candidate = queue.removeFirst()
                asked.insert(candidate.key)
                await name(candidate)
            }
            worker = nil
        }
    }

    private func name(_ candidate: Candidate) async {
        do {
            let answer = try await model.shortName(for: candidate.food)
            guard let name = FoodShortName.cleaned(answer) else {
                return Self.log.error("The model's short name \(answer, privacy: .public) is not one or two words")
            }
            try await store?.write { db in
                guard try !FoodShortName.exists(db, key: candidate.key) else { return }
                try FoodShortName(id: candidate.key, name: name).insert(db)
            }.value
        } catch {
            Self.log.error("Naming a food failed: \(String(describing: error))")
        }
    }
}
