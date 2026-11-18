import Foundation

/// One dietary quantity the app writes to Health: a nutrient of a logged food at the minute it was eaten, or a nutrient
/// a day's override sets, at noon.
struct DietarySample: Hashable, Sendable {
    /// `<entry id>/<nutrient>`, or `<day>/<nutrient>` for an override.
    var key: String
    var day: CalendarDay
    var nutrient: NutrientID
    var amount: Double
    var date: Date
    var food: String?
}

/// A sample the app wrote earlier, as Health holds it.
struct StoredDietarySample: Hashable, Sendable {
    var id: UUID
    var sample: DietarySample
}

/// Health's side of the sync, so tests run it over a fake.
@MainActor
protocol DietaryStore {
    /// The samples this app wrote for `day`, and only those.
    func samples(on day: CalendarDay) async throws -> [StoredDietarySample]
    /// Every day this app holds samples for.
    func writtenDays() async throws -> Set<CalendarDay>
    func save(_ samples: [DietarySample]) async throws
    func delete(_ samples: [StoredDietarySample]) async throws
}

enum DietaryHealth {
    /// Registry ids Health has a dietary type for. Alcohol, net carbs, starch, added sugars, trans fat, the omega
    /// totals, choline, and the amino acids have none, so they stay in the app.
    static let typeIdentifiers: [NutrientID: String] = [
        .energy: "HKQuantityTypeIdentifierDietaryEnergyConsumed",
        .protein: "HKQuantityTypeIdentifierDietaryProtein",
        .fat: "HKQuantityTypeIdentifierDietaryFatTotal",
        .carbs: "HKQuantityTypeIdentifierDietaryCarbohydrates",
        .fiber: "HKQuantityTypeIdentifierDietaryFiber",
        "262": "HKQuantityTypeIdentifierDietaryCaffeine",
        "255": "HKQuantityTypeIdentifierDietaryWater",
        "269": "HKQuantityTypeIdentifierDietarySugar",
        "645": "HKQuantityTypeIdentifierDietaryFatMonounsaturated",
        "646": "HKQuantityTypeIdentifierDietaryFatPolyunsaturated",
        "606": "HKQuantityTypeIdentifierDietaryFatSaturated",
        "601": "HKQuantityTypeIdentifierDietaryCholesterol",
        "417": "HKQuantityTypeIdentifierDietaryFolate",
        "320": "HKQuantityTypeIdentifierDietaryVitaminA",
        "404": "HKQuantityTypeIdentifierDietaryThiamin",
        "405": "HKQuantityTypeIdentifierDietaryRiboflavin",
        "406": "HKQuantityTypeIdentifierDietaryNiacin",
        "410": "HKQuantityTypeIdentifierDietaryPantothenicAcid",
        "415": "HKQuantityTypeIdentifierDietaryVitaminB6",
        "418": "HKQuantityTypeIdentifierDietaryVitaminB12",
        "401": "HKQuantityTypeIdentifierDietaryVitaminC",
        "328": "HKQuantityTypeIdentifierDietaryVitaminD",
        "323": "HKQuantityTypeIdentifierDietaryVitaminE",
        "430": "HKQuantityTypeIdentifierDietaryVitaminK",
        "301": "HKQuantityTypeIdentifierDietaryCalcium",
        "312": "HKQuantityTypeIdentifierDietaryCopper",
        "303": "HKQuantityTypeIdentifierDietaryIron",
        "304": "HKQuantityTypeIdentifierDietaryMagnesium",
        "315": "HKQuantityTypeIdentifierDietaryManganese",
        "305": "HKQuantityTypeIdentifierDietaryPhosphorus",
        "306": "HKQuantityTypeIdentifierDietaryPotassium",
        "317": "HKQuantityTypeIdentifierDietarySelenium",
        "307": "HKQuantityTypeIdentifierDietarySodium",
        "309": "HKQuantityTypeIdentifierDietaryZinc",
    ]

    /// A day older than this is written only when Health already holds the app's samples for it, so turning the
    /// setting on, or importing years of MacroFactor history that MacroFactor already wrote to Health, never doubles it.
    static let recentDays = 7

    /// What Health should hold for `day`: each entry's mapped nutrients at its minute, except the nutrients the override
    /// sets, which it writes once at noon. That matches `NutritionDay.totals`. Zero amounts are left out.
    static func samples(on day: CalendarDay, entries: [FoodEntry], override: NutrientAmounts?, calendar: Calendar) -> [DietarySample] {
        func samples(_ amounts: NutrientAmounts, key: String, minute: Int, food: String?) -> [DietarySample] {
            typeIdentifiers.keys.sorted { $0.rawValue < $1.rawValue }.compactMap { nutrient in
                guard let amount = amounts[nutrient], amount > 0 else { return nil }
                return DietarySample(key: "\(key)/\(nutrient.rawValue)", day: day, nutrient: nutrient, amount: amount, date: day.date(atMinute: minute, in: calendar), food: food)
            }
        }
        let overridden = override ?? [:]
        let logged = entries.filter { $0.day == day }.flatMap { entry in
            samples(entry.amounts.filter { overridden[$0.key] == nil }, key: entry.id.uuidString.lowercased(), minute: entry.minute, food: entry.food.name)
        }
        return logged + samples(overridden, key: day.description, minute: 12 * 60, food: nil)
    }

    /// Brings Health's samples for `day` to `desired`: unchanged samples stay, the rest are deleted and saved again.
    static func changes(desired: [DietarySample], stored: [StoredDietarySample]) -> (save: [DietarySample], delete: [StoredDietarySample]) {
        let kept = Set(stored.map(\.sample)).intersection(desired)
        var keeping = kept
        var delete: [StoredDietarySample] = []
        for sample in stored {
            if keeping.remove(sample.sample) == nil { delete.append(sample) }
        }
        return (desired.filter { !kept.contains($0) }, delete)
    }

    /// Re-writes `day` in `store` idempotently. A day before the recent window is left alone unless the app wrote it.
    @MainActor
    static func sync(
        _ day: CalendarDay, entries: [FoodEntry], override: NutrientAmounts?, today: CalendarDay, calendar: Calendar, in store: some DietaryStore
    ) async throws {
        let stored = try await store.samples(on: day)
        guard day > today.adding(days: -recentDays) || !stored.isEmpty else { return }
        let (save, delete) = changes(desired: samples(on: day, entries: entries, override: override, calendar: calendar), stored: stored)
        if !delete.isEmpty { try await store.delete(delete) }
        if !save.isEmpty { try await store.save(save) }
    }
}
