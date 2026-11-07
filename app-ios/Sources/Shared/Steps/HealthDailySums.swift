import HealthKit

extension HKHealthStore {
    /// A cumulative type's total per day, from `start` through `end`'s day, leaving out days without any.
    func dailySums(of type: HKQuantityType, unit: HKUnit, from start: Date, through end: Date, calendar: Calendar) async throws -> [DatedValue] {
        let start = calendar.startOfDay(for: start)
        let end = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: end))!
        let query = HKStatisticsCollectionQueryDescriptor(
            predicate: .quantitySample(type: type, predicate: HKQuery.predicateForSamples(withStart: start, end: end)),
            options: .cumulativeSum,
            anchorDate: start,
            intervalComponents: DateComponents(day: 1)
        )
        var days: [DatedValue] = []
        try await query.result(for: self).enumerateStatistics(from: start, to: end) { statistics, _ in
            guard let sum = statistics.sumQuantity()?.doubleValue(for: unit), sum > 0 else { return }
            days.append(DatedValue(date: statistics.startDate, value: sum))
        }
        return days
    }
}
