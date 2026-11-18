import Foundation
import GRDB
import HealthKit
import os

extension NutritionHealth {
    static let shared = NutritionHealth(target: HealthDietaryStore(store: HealthStore.shared))
}

/// The real Health store. Each sample carries its day and key in metadata, so a day's samples are found again and
/// another app's never match.
struct HealthDietaryStore: DietaryStore {
    let store: HKHealthStore

    static let dayKey = "ABMDay"
    static let sampleKey = "ABMSample"

    func samples(on day: CalendarDay) async throws -> [StoredDietarySample] {
        guard HealthStore.isAvailable else { return [] }
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
        guard HealthStore.isAvailable else { return [] }
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
