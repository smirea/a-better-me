import Foundation
import HealthKit

/// One dietary quantity the app writes to Health: a nutrient of a logged food at the minute it was eaten, or of a day's
/// override at noon.
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
    func save(_ samples: [DietarySample]) async throws
    func delete(_ samples: [StoredDietarySample]) async throws
}

enum DietaryHealth {
    /// Registry ids Health has a dietary type for. Alcohol, net carbs, starch, added sugars, trans fat, the omega
    /// totals, choline, and the amino acids have none, so they stay in the app.
    static let types: [NutrientID: HKQuantityTypeIdentifier] = [
        .energy: .dietaryEnergyConsumed,
        .protein: .dietaryProtein,
        .fat: .dietaryFatTotal,
        .carbs: .dietaryCarbohydrates,
        .fiber: .dietaryFiber,
        "262": .dietaryCaffeine,
        "255": .dietaryWater,
        "269": .dietarySugar,
        "645": .dietaryFatMonounsaturated,
        "646": .dietaryFatPolyunsaturated,
        "606": .dietaryFatSaturated,
        "601": .dietaryCholesterol,
        "417": .dietaryFolate,
        "320": .dietaryVitaminA,
        "404": .dietaryThiamin,
        "405": .dietaryRiboflavin,
        "406": .dietaryNiacin,
        "410": .dietaryPantothenicAcid,
        "415": .dietaryVitaminB6,
        "418": .dietaryVitaminB12,
        "401": .dietaryVitaminC,
        "328": .dietaryVitaminD,
        "323": .dietaryVitaminE,
        "430": .dietaryVitaminK,
        "301": .dietaryCalcium,
        "312": .dietaryCopper,
        "303": .dietaryIron,
        "304": .dietaryMagnesium,
        "315": .dietaryManganese,
        "305": .dietaryPhosphorus,
        "306": .dietaryPotassium,
        "317": .dietarySelenium,
        "307": .dietarySodium,
        "309": .dietaryZinc,
    ]

    static let shareTypes: Set<HKSampleType> = Set(types.values.map { HKQuantityType($0) })

    /// A day older than this is written only when Health already holds the app's samples for it, so turning the
    /// setting on, or importing years of MacroFactor history that MacroFactor already wrote to Health, never doubles it.
    static let recentDays = 7

    static func unit(_ unit: NutrientUnit) -> HKUnit {
        switch unit {
        case .kcal: .kilocalorie()
        case .g: .gram()
        case .mg: .gramUnit(with: .milli)
        case .mcg: .gramUnit(with: .micro)
        case .mL: .literUnit(with: .milli)
        }
    }

    /// What Health should hold for `day`: each entry's mapped nutrients at its minute, or the override's at noon,
    /// since an override replaces the log's totals. Zero amounts are left out.
    static func samples(on day: CalendarDay, entries: [FoodEntry], override: NutrientAmounts?, calendar: Calendar) -> [DietarySample] {
        func date(_ minute: Int) -> Date {
            calendar.date(from: DateComponents(year: day.year, month: day.month, day: day.day, hour: minute / 60, minute: minute % 60))!
        }
        func samples(_ amounts: NutrientAmounts, key: String, minute: Int, food: String?) -> [DietarySample] {
            types.keys.sorted { $0.rawValue < $1.rawValue }.compactMap { nutrient in
                guard let amount = amounts[nutrient], amount > 0 else { return nil }
                return DietarySample(key: "\(key)/\(nutrient.rawValue)", day: day, nutrient: nutrient, amount: amount, date: date(minute), food: food)
            }
        }
        if let override {
            return samples(override, key: day.description, minute: 12 * 60, food: nil)
        }
        return entries.filter { $0.day == day }.flatMap { samples($0.amounts, key: $0.id.uuidString.lowercased(), minute: $0.minute, food: $0.food.name) }
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
