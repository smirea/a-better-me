import Foundation
import FoundationModels
import GRDB
import os

/// Every meal the log knows, by `MealComponents.hash`: the recipe it was saved as, the name the model suggested, and
/// how many times it was logged. Read off the main thread from the whole log once per change, so a meal line only
/// looks its meal up.
struct MealIndex: Equatable, Sendable {
    struct SavedRecipe: Equatable, Sendable {
        let id: UUID
        let name: String
    }

    /// What a section's meal line shows.
    enum Line: Equatable {
        case saved(SavedRecipe, count: Int)
        case suggested(String)
    }

    var recipes: [String: SavedRecipe] = [:]
    var names: [String: String] = [:]
    /// The meal sections holding exactly the meal's foods, on any day, plus the entries of the recipe it was saved as.
    var counts: [String: Int] = [:]

    func line(for meal: MealComponents) -> Line? {
        if let recipe = recipes[meal.hash] { return .saved(recipe, count: counts[meal.hash, default: 0]) }
        return names[meal.hash].map(Line.suggested)
    }

    nonisolated static let read: @Sendable (Database) throws -> MealIndex = { db in
        let sections = try MealSection.current(db)
        let key = FoodSearchResult.keySQL("food")
        var meals: [String: [String]] = [:]
        var recipeEntries: [String: Int] = [:]
        for row in try Row.fetchAll(db, sql: "SELECT day, minute, section, json_extract(food, '$.source') AS source, \(key) AS key FROM food_entries") {
            let source: String? = row["source"]
            let key: String = row["key"]
            if source == FoodSource.quickAdd.rawValue { continue }
            if source == FoodSource.recipe.rawValue { recipeEntries[key, default: 0] += 1 }
            let day: String = row["day"]
            meals["\(day)/\(sections.section(of: row["section"], minute: row["minute"]).id)", default: []].append(key)
        }

        var index = MealIndex()
        for keys in meals.values {
            if let meal = MealComponents(keys: keys) { index.counts[meal.hash, default: 0] += 1 }
        }

        let ingredient = FoodSearchResult.keySQL("json_extract(j.value, '$.food')")
        var ingredients: [String: (name: String, keys: [String])] = [:]
        var order: [String] = []
        let recipeRows = try Row.fetchAll(db, sql: """
            SELECT r.id, r.name, json_extract(j.value, '$.food.source') AS source, \(ingredient) AS key
            FROM recipes r, json_each(r.ingredients) j WHERE r.archived = 0 ORDER BY r.updated_at
            """)
        for row in recipeRows {
            let id: String = row["id"]
            if ingredients[id] == nil { order.append(id) }
            let source: String? = row["source"]
            ingredients[id, default: (row["name"], [])].keys += source == FoodSource.quickAdd.rawValue ? [] : [row["key"]]
        }
        // Ordered by `updated_at`, so of two recipes made of the same foods the one edited last names the meal.
        for id in order {
            guard let recipe = ingredients[id], let meal = MealComponents(keys: recipe.keys), let uuid = UUID(uuidString: id) else { continue }
            index.recipes[meal.hash] = SavedRecipe(id: uuid, name: recipe.name)
        }
        for (hash, recipe) in index.recipes {
            index.counts[hash, default: 0] += recipeEntries[recipe.id.uuidString.lowercased(), default: 0]
        }

        for row in try Row.fetchAll(db, sql: "SELECT id, name FROM meal_names") {
            index.names[row["id"]] = row["name"]
        }
        return index
    }
}

/// Names a meal from its foods and their servings, one "name, amount" line each.
protocol MealNameModel: Sendable {
    /// False while the device can't run it: not eligible, Apple Intelligence off, or the model still downloading.
    var isAvailable: Bool { get }
    func name(for foods: [String]) async throws -> String
}

/// Apple's on-device general model, as `OnDeviceFoodIconModel` uses it, with greedy sampling, so a meal gets the same
/// suggestion on every device.
struct OnDeviceMealNameModel: MealNameModel {
    private let model = SystemLanguageModel.default

    var isAvailable: Bool { model.isAvailable }

    func name(for foods: [String]) async throws -> String {
        let session = LanguageModelSession(model: model, instructions: Self.instructions)
        let prompt = "Foods:\n" + foods.map { "- \($0)" }.joined(separator: "\n")
        return try await session.respond(to: prompt, generating: MealTitle.self, options: GenerationOptions(sampling: .greedy)).content.name
    }

    private static let instructions = """
        You name meals in a food log. Given the foods eaten together and their amounts, answer the short name a \
        person would call the meal, naming the dish or its main foods rather than listing every one, such as \
        "Matcha Granola Bowl" or "Chicken and Rice". Use two to four words. No brands or amounts.
        """
}

@Generable
private struct MealTitle {
    @Guide(description: "The meal's name, two to four words in title case")
    var name: String
}

/// The app's one `MealIndex`, observed from the database, and the namer behind the suggestions. A meal line asks for
/// a name with `suggest`; once the index has loaded, a meal with neither a recipe nor a stored name goes to the model,
/// one at a time, and its answer is stored in `meal_names`, which the index then reads back. Without the model nothing
/// is asked, so an unmatched meal shows no line.
@MainActor @Observable
final class MealCatalog {
    nonisolated static let log = Logger(subsystem: "com.stefan.a-better-me", category: "meals")

    private(set) var index = MealIndex()

    @ObservationIgnored private let model: any MealNameModel
    @ObservationIgnored private var store: LocalStore?
    @ObservationIgnored private var observation: AnyDatabaseCancellable?
    @ObservationIgnored private var loaded = false
    /// Meals shown without a name, with the lines the model reads, until the index has loaded to tell which need one.
    @ObservationIgnored private var wanted: [String: [String]] = [:]
    @ObservationIgnored private var queue: [(hash: String, foods: [String])] = []
    /// Meals asked about this launch, so one the model fails on is not asked again until the next.
    @ObservationIgnored private var asked: Set<String> = []
    @ObservationIgnored private var worker: Task<Void, Never>?

    init(model: any MealNameModel = OnDeviceMealNameModel()) {
        self.model = model
    }

    func start(store: LocalStore) {
        guard self.store == nil else { return }
        self.store = store
        observation = ValueObservation.tracking(MealIndex.read).removeDuplicates().start(
            in: store.database.pool,
            scheduling: .async(onQueue: .main),
            onError: { Self.log.error("Observing meals failed: \(String(describing: $0))") },
            onChange: { [weak self] in self?.receive($0) }
        )
    }

    /// Asks for a name for a meal shown without one: `entries` are its foods as logged, whose servings the model reads.
    func suggest(_ meal: MealComponents, from entries: [FoodEntry]) {
        guard model.isAvailable, !asked.contains(meal.hash), !loaded || index.line(for: meal) == nil else { return }
        wanted[meal.hash] = entries.filter { $0.food.source != .quickAdd }.map {
            "\($0.food.displayName), \(NutritionFormat.serving($0.serving, of: $0.food))"
        }
        if loaded { askWanted() }
    }

    /// Returns once the index reflects the database and every wanted name has been asked for and written, for tests.
    func idle() async {
        guard let store else { return }
        try? await store.write { _ in }.value
        if let current = try? await store.read(MealIndex.read) { receive(current) }
        while let worker { await worker.value }
        if let current = try? await store.read(MealIndex.read) { receive(current) }
    }

    private func receive(_ index: MealIndex) {
        if self.index != index { self.index = index }
        loaded = true
        askWanted()
    }

    private func askWanted() {
        for (hash, foods) in wanted where index.recipes[hash] == nil && index.names[hash] == nil && !asked.contains(hash) {
            asked.insert(hash)
            queue.append((hash, foods))
        }
        wanted = [:]
        guard worker == nil, !queue.isEmpty else { return }
        worker = Task {
            while !queue.isEmpty {
                let meal = queue.removeFirst()
                await name(meal.hash, from: meal.foods)
            }
            worker = nil
        }
    }

    private func name(_ hash: String, from foods: [String]) async {
        do {
            let name = Self.cleaned(try await model.name(for: foods))
            guard !name.isEmpty else { return Self.log.error("The model named a meal with nothing") }
            try await store?.write { db in
                guard try !MealName.exists(db, key: hash) else { return }
                try MealName(id: hash, name: name).insert(db)
            }.value
        } catch {
            Self.log.error("Naming a meal failed: \(String(describing: error))")
        }
    }

    /// The answer without surrounding quotes, a closing period, or extra spaces.
    nonisolated static func cleaned(_ name: String) -> String {
        name.trimmingCharacters(in: .whitespacesAndNewlines.union(CharacterSet(charactersIn: "\"'“”.")))
            .split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }
}
