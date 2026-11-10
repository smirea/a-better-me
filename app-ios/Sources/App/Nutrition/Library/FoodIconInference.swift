import Foundation
import FoundationModels
import GRDB
import os

/// Picks one of `FoodIconChoice.all` for a food's display name.
protocol FoodIconModel: Sendable {
    /// False while the device can't run it: not eligible, Apple Intelligence off, or the model still downloading.
    var isAvailable: Bool { get }
    /// An icon name; the caller drops one that isn't a `FoodIconChoice`.
    func icon(for food: String) async throws -> String
}

/// Apple's on-device model, its output constrained to the icon names. The general model, not the content-tagging
/// one: on the simulator the tagging adapter reported available and then failed every request (ModelManagerError 1026).
/// Greedy sampling, so a food gets the same icon on every device.
struct OnDeviceFoodIconModel: FoodIconModel {
    private let model = SystemLanguageModel.default

    var isAvailable: Bool { model.isAvailable }

    func icon(for food: String) async throws -> String {
        let session = LanguageModelSession(model: model, instructions: Self.instructions)
        let pick = try await session.respond(to: "Food: \(food)", generating: FoodIconPick.self, options: GenerationOptions(sampling: .greedy))
        return pick.content.icon
    }

    private static let instructions = """
        You choose the icon a food shows in a nutrition log. Pick the icon that best shows what the food mostly is; a \
        brand follows "By". Pasta shapes are pasta; grains such as quinoa are rice; protein and granola bars are cereal; \
        sodas, energy and sports drinks are smoothie; pork and cured meats are meat.
        """
}

@Generable
private struct FoodIconPick {
    @Guide(description: "The icon that best pictures the food", .anyOf(FoodIconChoice.all.map(\.name)))
    var icon: String
}

/// Gives every food that would draw its source's symbol (no icon stored, none its name mentions) an icon the on-device
/// model picks, stored on the food and its snapshots (`LocalStore.setInferredIcon`). It watches the foods table, so a
/// food cached, created, or synced in from another device is covered the moment it lands, and the first launch backfills
/// every older one. Without the model nothing happens and the source's symbol stays.
@MainActor
final class FoodIconInference {
    static let shared = FoodIconInference(model: OnDeviceFoodIconModel())
    nonisolated static let log = Logger(subsystem: "com.stefan.a-better-me", category: "food-icons")

    private let model: any FoodIconModel
    private var store: LocalStore?
    private var observation: AnyDatabaseCancellable?
    private var queue: [Candidate] = []
    /// Foods asked about this launch, so a food the model fails on is not asked again until the next one.
    private var asked: Set<String> = []
    private var worker: Task<Void, Never>?

    struct Candidate: Equatable, Sendable {
        let id: String
        let name: String
    }

    init(model: any FoodIconModel) {
        self.model = model
    }

    func start(store: LocalStore) {
        guard self.store == nil else { return }
        self.store = store
        observation = ValueObservation.tracking(Self.candidates).removeDuplicates().start(
            in: store.database.pool,
            scheduling: .async(onQueue: .main),
            onError: { Self.log.error("Observing foods without icons failed: \(String(describing: $0))") },
            onChange: { [weak self] in self?.receive($0) }
        )
    }

    /// Returns once every food without an icon at the call has been asked about and its icon written, for tests. It
    /// reads the foods itself rather than wait for the observation, whose delivery has no signal.
    func idle() async {
        guard let store else { return }
        try? await store.write { _ in }.value
        if let current = try? await store.read(Self.candidates) { receive(current) }
        while let worker { await worker.value }
        try? await store.write { _ in }.value
    }

    nonisolated static let candidates: @Sendable (Database) throws -> [Candidate] = { db in
        try Row.fetchAll(db, sql: "SELECT id, name, brand FROM foods WHERE icon IS NULL ORDER BY created_at DESC").compactMap { row in
            let name: String = row["name"]
            guard FoodIconChoice.mentioned(in: name) == nil else { return nil }
            let brand: String? = row["brand"]
            return Candidate(id: row["id"], name: brand.map { $0.isEmpty ? name : "\(name) By \($0)" } ?? name)
        }
    }

    private func receive(_ candidates: [Candidate]) {
        guard model.isAvailable else { return }
        let queued = Set(queue.map(\.id))
        queue += candidates.filter { !asked.contains($0.id) && !queued.contains($0.id) }
        guard worker == nil, !queue.isEmpty else { return }
        worker = Task {
            while !queue.isEmpty {
                let candidate = queue.removeFirst()
                asked.insert(candidate.id)
                await infer(candidate)
            }
            worker = nil
        }
    }

    private func infer(_ candidate: Candidate) async {
        do {
            let name = try await model.icon(for: candidate.name)
            guard FoodIconChoice.named(name) != nil else {
                return Self.log.error("The model answered \(name, privacy: .public), which is no icon")
            }
            store?.setInferredIcon(name, forFood: candidate.id)
        } catch {
            Self.log.error("Inferring an icon failed: \(String(describing: error))")
        }
    }
}
