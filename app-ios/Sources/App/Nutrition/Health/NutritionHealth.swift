import Foundation
import GRDB
import HealthKit
import os

/// Writes logged food to Apple Health while Settings > Apple Health's Nutrition toggle is on. It watches each day's
/// entries and override, and re-writes a day whenever they change, from this phone or from a sync.
@MainActor @Observable
final class NutritionHealth {
    static let shared = NutritionHealth(target: HealthDietaryStore(store: HKHealthStore()))

    /// Device state, like `AppMode`: Health access belongs to this phone's Health store, and a synced switch would
    /// make a second phone write the same food again.
    static let enabledKey = "writesNutritionToHealth"
    nonisolated static let log = Logger(subsystem: "com.stefan.a-better-me", category: "nutrition-health")

    var isEnabled: Bool {
        didSet {
            defaults.set(isEnabled, forKey: Self.enabledKey)
            if isEnabled, !oldValue { reconcile() }
        }
    }

    /// The last day written and how many samples Health holds for it, for the settings page.
    private(set) var lastWrite: (day: CalendarDay, samples: Int)?

    @ObservationIgnored let target: any DietaryStore
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private let calendar: Calendar
    @ObservationIgnored private var store: LocalStore?
    @ObservationIgnored private var observation: AnyDatabaseCancellable?
    @ObservationIgnored private var digests: [String: String]?
    @ObservationIgnored private var pending: Set<CalendarDay> = []
    @ObservationIgnored private var worker: Task<Void, Never>?
    @ObservationIgnored private var listing: Task<Void, Never>?

    init(target: any DietaryStore, defaults: UserDefaults = .standard, calendar: Calendar = .current) {
        self.target = target
        self.defaults = defaults
        self.calendar = calendar
        isEnabled = defaults.bool(forKey: Self.enabledKey)
    }

    func start(store: LocalStore) {
        guard self.store == nil else { return }
        self.store = store
        observation = ValueObservation.tracking(Self.dayDigests).removeDuplicates().start(
            in: store.database.pool,
            scheduling: .immediate,
            onError: { Self.log.error("Observing the log failed: \(String(describing: $0))") },
            onChange: { [weak self] in self?.receive($0) }
        )
    }

    /// Writes today and the days of the recent window.
    func syncRecent() {
        let today = CalendarDay(.now, in: calendar)
        enqueue((0..<DietaryHealth.recentDays).map { today.adding(days: -$0) })
    }

    /// The recent window and every older day the app wrote before, since a day edited or deleted while the switch was
    /// off still holds its old samples.
    func reconcile() {
        syncRecent()
        listing = Task {
            defer { listing = nil }
            do {
                enqueue(Array(try await target.writtenDays()))
            } catch {
                Self.log.error("Listing the days written to Health failed: \(String(describing: error))")
            }
        }
    }

    /// Returns once every queued day is written.
    func idle() async {
        while let task = listing ?? worker { await task.value }
    }

    /// One text per day that changes whenever an entry of the day is added, edited, moved, or deleted, or its override
    /// changes, so a change re-writes only its days. Every entry is in it, so an edit that syncs in with an older
    /// timestamp than another entry's still shows. The snapshot is left out: it never changes without `updated_at`.
    static let dayDigests: @Sendable (Database) throws -> [String: String] = { db in
        var digests: [String: String] = [:]
        let entries = """
            SELECT day, group_concat(id || ' ' || minute || ' ' || updated_at || ' ' || serving, char(10)) AS digest
            FROM (SELECT * FROM food_entries ORDER BY day, id) GROUP BY day
            """
        for row in try Row.fetchAll(db, sql: entries) {
            digests[row["day"] as String] = row["digest"] as String
        }
        for row in try Row.fetchAll(db, sql: "SELECT id, override FROM nutrition_days WHERE override IS NOT NULL") {
            digests[row["id"] as String, default: ""] += " \(row["override"] as String)"
        }
        return digests
    }

    private func receive(_ next: [String: String]) {
        defer { digests = next }
        guard let digests else { return syncRecent() }
        let changed = Set(next.keys).union(digests.keys).filter { next[$0] != digests[$0] }
        enqueue(changed.compactMap(CalendarDay.init))
    }

    private func enqueue(_ days: [CalendarDay]) {
        guard isEnabled, store != nil, !days.isEmpty else { return }
        pending.formUnion(days)
        guard worker == nil else { return }
        worker = Task { await drain() }
    }

    private func drain() async {
        while let day = pending.max() {
            pending.remove(day)
            await write(day)
        }
        worker = nil
    }

    private func write(_ day: CalendarDay) async {
        guard isEnabled, let store else { return }
        do {
            let (entries, override) = try store.read { db in
                (try FoodEntry.on(day).fetch(db), try NutritionDay.fetchOne(db, key: NutritionDay.key(day))?.override)
            }
            try await DietaryHealth.sync(day, entries: entries, override: override, today: CalendarDay(.now, in: calendar), calendar: calendar, in: target)
            let samples = try await target.samples(on: day).count
            if samples > 0 || lastWrite?.day == day { lastWrite = (day, samples) }
        } catch {
            Self.log.error("Writing \(day) to Health failed: \(String(describing: error))")
        }
    }
}

/// The real Health store. Each sample carries its day and key in metadata, so a day's samples are found again and
/// another app's never match.
struct HealthDietaryStore: DietaryStore {
    let store: HKHealthStore

    static let dayKey = "ABMDay"
    static let sampleKey = "ABMSample"

    func samples(on day: CalendarDay) async throws -> [StoredDietarySample] {
        guard HKHealthStore.isHealthDataAvailable() else { return [] }
        // The day key marks the app's own samples, so no source predicate: `HKSource.default()` throws in an unsigned
        // test host.
        let predicate = HKQuery.predicateForObjects(withMetadataKey: Self.dayKey, allowedValues: [day.description])
        let query = HKSampleQueryDescriptor(
            predicates: DietaryHealth.types.values.map { .quantitySample(type: HKQuantityType($0), predicate: predicate) },
            sortDescriptors: []
        )
        return try await query.result(for: store).compactMap { sample in
            guard let nutrient = DietaryHealth.types.first(where: { $0.value.rawValue == sample.quantityType.identifier })?.key,
                  let unit = NutrientRegistry.nutrient(nutrient)?.unit,
                  let key = sample.metadata?[Self.sampleKey] as? String else { return nil }
            return StoredDietarySample(id: sample.uuid, sample: DietarySample(
                key: key, day: day, nutrient: nutrient, amount: sample.quantity.doubleValue(for: DietaryHealth.unit(unit)),
                date: sample.startDate, food: sample.metadata?[HKMetadataKeyFoodType] as? String
            ))
        }
    }

    func writtenDays() async throws -> Set<CalendarDay> {
        guard HKHealthStore.isHealthDataAvailable() else { return [] }
        let predicate = HKQuery.predicateForObjects(withMetadataKey: Self.dayKey)
        let query = HKSampleQueryDescriptor(
            predicates: DietaryHealth.types.values.map { .quantitySample(type: HKQuantityType($0), predicate: predicate) },
            sortDescriptors: []
        )
        return Set(try await query.result(for: store).compactMap { ($0.metadata?[Self.dayKey] as? String).flatMap(CalendarDay.init) })
    }

    /// Only types the owner allowed; Health refuses a whole save that holds one it was not allowed.
    func save(_ samples: [DietarySample]) async throws {
        let objects = samples.compactMap { sample -> HKQuantitySample? in
            guard let identifier = DietaryHealth.types[sample.nutrient], let unit = NutrientRegistry.nutrient(sample.nutrient)?.unit else { return nil }
            let type = HKQuantityType(identifier)
            guard store.authorizationStatus(for: type) == .sharingAuthorized else { return nil }
            var metadata: [String: Any] = [Self.dayKey: sample.day.description, Self.sampleKey: sample.key]
            if let food = sample.food { metadata[HKMetadataKeyFoodType] = food }
            return HKQuantitySample(
                type: type, quantity: HKQuantity(unit: DietaryHealth.unit(unit), doubleValue: sample.amount),
                start: sample.date, end: sample.date, metadata: metadata
            )
        }
        if !objects.isEmpty { try await store.save(objects) }
    }

    func delete(_ samples: [StoredDietarySample]) async throws {
        for (nutrient, group) in Dictionary(grouping: samples, by: \.sample.nutrient) {
            guard let identifier = DietaryHealth.types[nutrient] else { continue }
            let type = HKQuantityType(identifier)
            guard store.authorizationStatus(for: type) == .sharingAuthorized else { continue }
            _ = try await store.deleteObjects(of: type, predicate: HKQuery.predicateForObjects(with: Set(group.map(\.id))))
        }
    }
}
