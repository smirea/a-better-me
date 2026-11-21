import Foundation
import GRDB
import os

/// Writes logged food to Apple Health while Settings > Apple Health's Nutrition toggle is on. It watches each day's
/// entries and override, and re-writes a day whenever they change, from this phone or from a sync.
@MainActor @Observable
final class NutritionHealth {
    /// Device state, not owner data: Health access belongs to this phone's Health store, and a synced switch would
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
            scheduling: .async(onQueue: .main),
            onError: { Self.log.error("Observing the log failed: \(String(describing: $0))") },
            onChange: { digests in MainActor.assumeIsolated { [weak self] in self?.receive(digests) } }
        )
    }

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
    /// timestamp than another entry's still shows. The snapshot is left out: it never changes without `updated_at`,
    /// except for an inferred icon, which Health never sees.
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
            let (entries, override) = try await store.read { db in
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
