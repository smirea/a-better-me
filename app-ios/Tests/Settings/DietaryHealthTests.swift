import Foundation
import HealthKit
import Testing
@testable import App

/// Holds what a real Health store would: the samples the app wrote, found again by day.
@MainActor
final class FakeDietaryStore: DietaryStore {
    var held: [StoredDietarySample] = []
    var saves = 0
    var deletes = 0

    func samples(on day: CalendarDay) async throws -> [StoredDietarySample] {
        held.filter { $0.sample.day == day }
    }

    func writtenDays() async throws -> Set<CalendarDay> {
        Set(held.map(\.sample.day))
    }

    func save(_ samples: [DietarySample]) async throws {
        saves += samples.count
        held += samples.map { StoredDietarySample(id: UUID(), sample: $0) }
    }

    func delete(_ samples: [StoredDietarySample]) async throws {
        deletes += samples.count
        let ids = Set(samples.map(\.id))
        held.removeAll { ids.contains($0.id) }
    }

    /// `key amount` per sample, sorted, so a test compares one literal list.
    var summary: [String] { held.map { "\($0.sample.key) \($0.sample.amount)" }.sorted() }
}

private func instant(_ text: String) -> Date { try! Date(text, strategy: .iso8601) }

private let entryID = UUID(uuidString: "00000000-0000-0000-0000-0000000000A1")!

private func breakfast(on day: CalendarDay, quantity: Double = 1) -> FoodEntry {
    var entry = FoodEntry(FoodPortion(yogurt, serving: Serving(measure: yogurt.nutrition.measures[0], quantity: quantity)), day: day, minute: 8 * 60 + 15)
    entry.id = entryID
    return entry
}

@MainActor
struct DietaryHealthTests {
    let monday = calendarDay("2026-10-26")
    let key = "00000000-0000-0000-0000-0000000000a1"

    @Test func everyMappedNutrientIsInTheRegistryInAUnitHealthAccepts() {
        #expect(DietaryHealth.types.count == 34)
        for (id, identifier) in DietaryHealth.types {
            let nutrient = NutrientRegistry.nutrient(id)
            #expect(nutrient != nil, "\(id.rawValue) is not in the registry")
            if let nutrient {
                #expect(HKQuantityType(identifier).is(compatibleWith: DietaryHealth.unit(nutrient.unit)), "\(id.rawValue)")
            }
        }
    }

    @Test func aDayIsEachEntrysMappedNutrientsAtItsMinute() {
        var lunch = FoodEntry(FoodPortion(.quickAdd([.energy: 420, .protein: 30, .alcohol: 14, .fat: 0], name: "Lunch out")), day: monday, minute: 13 * 60)
        lunch.id = UUID(uuidString: "00000000-0000-0000-0000-0000000000B2")!
        let samples = DietaryHealth.samples(on: monday, entries: [breakfast(on: monday), lunch], override: nil, calendar: utc)

        let eight = instant("2026-10-26T08:15:00Z")
        let one = instant("2026-10-26T13:00:00Z")
        #expect(samples == [
            DietarySample(key: "\(key)/291", day: monday, nutrient: .fiber, amount: 3, date: eight, food: "Yogurt"),
            DietarySample(key: "\(key)/c", day: monday, nutrient: .carbs, amount: 18, date: eight, food: "Yogurt"),
            DietarySample(key: "\(key)/f", day: monday, nutrient: .fat, amount: 6, date: eight, food: "Yogurt"),
            DietarySample(key: "\(key)/k", day: monday, nutrient: .energy, amount: 180, date: eight, food: "Yogurt"),
            DietarySample(key: "\(key)/p", day: monday, nutrient: .protein, amount: 15, date: eight, food: "Yogurt"),
            DietarySample(key: "00000000-0000-0000-0000-0000000000b2/k", day: monday, nutrient: .energy, amount: 420, date: one, food: "Lunch out"),
            DietarySample(key: "00000000-0000-0000-0000-0000000000b2/p", day: monday, nutrient: .protein, amount: 30, date: one, food: "Lunch out"),
        ])
    }

    @Test func anOverrideReplacesTheEntriesAtNoon() {
        let samples = DietaryHealth.samples(on: monday, entries: [breakfast(on: monday)], override: [.energy: 2100, .protein: 160, .alcohol: 20], calendar: utc)
        let noon = instant("2026-10-26T12:00:00Z")
        #expect(samples == [
            DietarySample(key: "2026-10-26/k", day: monday, nutrient: .energy, amount: 2100, date: noon, food: nil),
            DietarySample(key: "2026-10-26/p", day: monday, nutrient: .protein, amount: 160, date: noon, food: nil),
        ])
    }

    @Test func syncingWritesADayOnceAndFollowsEditsAndDeletes() async throws {
        let health = FakeDietaryStore()
        func sync(_ entries: [FoodEntry]) async throws {
            try await DietaryHealth.sync(monday, entries: entries, override: nil, today: monday, calendar: utc, in: health)
        }

        try await sync([breakfast(on: monday)])
        #expect(health.summary == ["\(key)/291 3.0", "\(key)/c 18.0", "\(key)/f 6.0", "\(key)/k 180.0", "\(key)/p 15.0"])
        #expect((health.saves, health.deletes) == (5, 0))

        try await sync([breakfast(on: monday)])
        #expect((health.saves, health.deletes) == (5, 0))

        try await sync([breakfast(on: monday, quantity: 2)])
        #expect(health.summary == ["\(key)/291 6.0", "\(key)/c 36.0", "\(key)/f 12.0", "\(key)/k 360.0", "\(key)/p 30.0"])
        #expect((health.saves, health.deletes) == (10, 5))

        try await sync([])
        #expect(health.summary == [])
        #expect(health.deletes == 10)
    }

    @Test func anOlderDayIsWrittenOnlyWhenTheAppAlreadyWroteIt() async throws {
        let health = FakeDietaryStore()
        let today = monday.adding(days: DietaryHealth.recentDays)

        try await DietaryHealth.sync(monday, entries: [breakfast(on: monday)], override: nil, today: today, calendar: utc, in: health)
        #expect(health.summary == [])

        try await DietaryHealth.sync(monday, entries: [breakfast(on: monday)], override: nil, today: monday, calendar: utc, in: health)
        try await DietaryHealth.sync(monday, entries: [], override: [.energy: 1900], today: today, calendar: utc, in: health)
        #expect(health.summary == ["2026-10-26/k 1900.0"])
    }

    @Test func turningTheSettingOnWritesTodayAndALogChangeRewritesIt() async throws {
        let store = try LocalStore(unsyncedAt: FileManager.default.temporaryDirectory.appending(path: "dietary-\(UUID().uuidString)/a.sqlite"))
        let suite = "dietary-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let health = FakeDietaryStore()
        let today = CalendarDay(.now, in: utc)
        let sync = NutritionHealth(target: health, defaults: defaults, calendar: utc)
        sync.start(store: store)

        store.quickAdd([.energy: 500, .protein: 40], on: today, minute: 9 * 60)
        try await store.write { _ in }.value
        await sync.idle()
        #expect(health.summary == [])

        sync.isEnabled = true
        await sync.idle()
        #expect(health.held.map(\.sample.amount).sorted() == [40, 500])
        #expect(defaults.bool(forKey: NutritionHealth.enabledKey))

        let id = try store.read(FoodEntry.on(today).fetch)[0].id
        store.editEntry(id) { $0.serving.quantity = 2 }
        try await eventually { health.held.map(\.sample.amount).sorted() == [80, 1000] }

        store.deleteEntries([id])
        try await eventually { health.held.isEmpty }
    }

    @Test func anEditSyncedInWithAnOlderTimestampStillChangesTheDaysDigest() async throws {
        let store = try LocalStore(unsyncedAt: FileManager.default.temporaryDirectory.appending(path: "digest-\(UUID().uuidString)/a.sqlite"))
        store.quickAdd([.energy: 300], on: monday, minute: 8 * 60)
        store.quickAdd([.energy: 500], on: monday, minute: 12 * 60)
        try await store.write { _ in }.value
        let before = try store.read(NutritionHealth.dayDigests)

        try await store.write { db in
            try db.execute(sql: """
                UPDATE food_entries SET serving = json_set(serving, '$.quantity', 2), updated_at = '2000-01-01T00:00:00.000Z'
                WHERE minute = 480
                """)
        }.value
        let after = try store.read(NutritionHealth.dayDigests)

        #expect(before.keys.sorted() == ["2026-10-26"])
        #expect(after.keys.sorted() == ["2026-10-26"])
        #expect(before["2026-10-26"] != after["2026-10-26"])
    }

    @Test func turningTheSettingBackOnRewritesAnOldDayChangedWhileItWasOff() async throws {
        let store = try LocalStore(unsyncedAt: FileManager.default.temporaryDirectory.appending(path: "reenable-\(UUID().uuidString)/a.sqlite"))
        let suite = "dietary-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let health = FakeDietaryStore()
        let old = CalendarDay(.now, in: utc).adding(days: -30)
        health.held = [StoredDietarySample(id: UUID(), sample: DietarySample(
            key: "\(key)/k", day: old, nutrient: .energy, amount: 180, date: instant("2026-09-26T08:15:00Z"), food: "Yogurt"
        ))]
        let sync = NutritionHealth(target: health, defaults: defaults, calendar: utc)
        sync.start(store: store)

        sync.isEnabled = true
        await sync.idle()

        #expect(health.summary == [])
        #expect(health.deletes == 1)
    }

    /// Waits for the observation's next delivery, which GRDB schedules on the main queue after a commit.
    private func eventually(_ condition: () -> Bool) async throws {
        for _ in 0..<200 where !condition() {
            try await Task.sleep(for: .milliseconds(10))
        }
        #expect(condition())
    }
}
