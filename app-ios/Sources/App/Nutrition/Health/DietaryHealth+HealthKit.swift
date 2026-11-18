import HealthKit

extension DietaryHealth {
    static let types: [NutrientID: HKQuantityTypeIdentifier] = typeIdentifiers.mapValues { HKQuantityTypeIdentifier(rawValue: $0) }

    static let shareTypes: Set<HKSampleType> = Set(types.values.map { HKQuantityType($0) })

    static func unit(_ unit: NutrientUnit) -> HKUnit {
        switch unit {
        case .kcal: .kilocalorie()
        case .g: .gram()
        case .mg: .gramUnit(with: .milli)
        case .mcg: .gramUnit(with: .micro)
        case .mL: .literUnit(with: .milli)
        }
    }
}
