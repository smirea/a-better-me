import HealthKit

#if DEBUG
/// Launch with `-seedHealthSamples` (`scripts/run --health on` passes it) to write 60 days of body mass, steps, flights
/// climbed, and walking distance into the simulator's Health store so the Dashboard's HealthKit cards have data. Each
/// type is written once, when the store has none of it, so an install seeded before a type was added gets that type on
/// its next launch.
/// Debug builds ask for write access only for this.
enum HealthSeed {
    static let launchArgument = "-seedHealthSamples"

    static let isRequested = ProcessInfo.processInfo.arguments.contains(launchArgument)
    @MainActor private static var started = false

    /// Activation and the Health sheet's answer both load at launch, so only the first call writes.
    @MainActor
    static func writeIfRequested(_ store: HKHealthStore) async throws {
        guard isRequested, !started else { return }
        started = true
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: .now)
        let days = (0..<60).map { (offset: $0, day: calendar.date(byAdding: .day, value: -$0, to: today)!) }
        func at(_ day: Date, hour: Double) -> Date { min(day.addingTimeInterval(hour * 3600), Date.now.addingTimeInterval(-60)) }
        func count(_ type: HKQuantityType, _ value: Double, _ date: Date) -> HKQuantitySample {
            HKQuantitySample(type: type, quantity: HKQuantity(unit: .count(), doubleValue: value), start: date, end: date)
        }

        var samples: [HKQuantitySample] = []
        let bodyMass = HKQuantityType(.bodyMass)
        if try await isEmpty(bodyMass, store) {
            for (offset, day) in days where offset % 4 != 3 {
                let kg = 84 - Double(60 - offset) * 0.04 + sin(Double(offset) * 1.7) * 0.6
                samples.append(HKQuantitySample(type: bodyMass, quantity: HKQuantity(unit: .gramUnit(with: .kilo), doubleValue: (kg * 10).rounded() / 10), start: at(day, hour: 7), end: at(day, hour: 7)))
            }
        }
        // Yesterday and the two days before it meet the default goal, so the Steps screen shows a streak.
        func steps(_ offset: Int) -> Double { (1...3).contains(offset) ? 10_400 + Double(offset * 1_337) : 4000 + Double((offset * 2731) % 9000) }
        let stepCount = HKQuantityType(.stepCount)
        if try await isEmpty(stepCount, store) {
            for (offset, day) in days { samples.append(count(stepCount, steps(offset), at(day, hour: 12))) }
        }
        let distance = HKQuantityType(.distanceWalkingRunning)
        if try await isEmpty(distance, store) {
            for (offset, day) in days {
                let meters = (steps(offset) * 0.74).rounded()
                samples.append(HKQuantitySample(type: distance, quantity: HKQuantity(unit: .meter(), doubleValue: meters), start: at(day, hour: 12), end: at(day, hour: 12)))
            }
        }
        let flightsClimbed = HKQuantityType(.flightsClimbed)
        if try await isEmpty(flightsClimbed, store) {
            for (offset, day) in days where (offset * 7) % 17 > 0 {
                samples.append(count(flightsClimbed, Double((offset * 7) % 17), at(day, hour: 12)))
            }
        }
        if !samples.isEmpty { try await store.save(samples) }
    }

    private static func isEmpty(_ type: HKQuantityType, _ store: HKHealthStore) async throws -> Bool {
        try await HKSampleQueryDescriptor(predicates: [.quantitySample(type: type)], sortDescriptors: [], limit: 1).result(for: store).isEmpty
    }
}
#endif
