import Foundation
import HealthKit
import os

/// Read live and never copied into the database; see docs/decisions/workouts.md. HealthKit hides read denial, so a
/// denied store reads as no data. The app's own weigh-ins merge in here, so the dashboard has one weigh-in source.
@MainActor @Observable
final class HealthData {
    private(set) var weighIns: [WeighIn] = []
    private(set) var steps: [DatedValue] = []
    private(set) var flights: [DatedValue] = []
    /// Walking and running distance per day, in meters.
    private(set) var distance: [DatedValue] = []
    /// Bumps whenever `weighIns`, `steps`, `flights`, or `distance` changes; dashboard values derived from them key on it.
    private(set) var revision = 0

    @ObservationIgnored private var weights: [HealthWeight] = []
    @ObservationIgnored private var logged: [BodyWeight] = []

    /// Flips when HealthKit says it should ask, which makes `healthDataAccessRequest` present its sheet.
    private(set) var requestTrigger = false

    @ObservationIgnored let store = HealthStore.shared
    static let readTypes: Set<HKObjectType> = [bodyMass, stepCount, flightsClimbed, distanceWalkingRunning]
    #if DEBUG
    static let shareTypes: Set<HKSampleType> = HealthSeed.isRequested ? [bodyMass, stepCount, flightsClimbed, distanceWalkingRunning] : []
    #else
    static let shareTypes: Set<HKSampleType> = []
    #endif
    private static let bodyMass = HKQuantityType(.bodyMass)
    private static let stepCount = HKQuantityType(.stepCount)
    private static let flightsClimbed = HKQuantityType(.flightsClimbed)
    private static let distanceWalkingRunning = HKQuantityType(.distanceWalkingRunning)
    private static let log = Logger(subsystem: "com.stefan.a-better-me", category: "health")

    /// Loads, or flips `requestTrigger` when any type the app uses is still undecided, and returns whether it asked.
    @discardableResult
    func refresh() async -> Bool {
        guard HealthStore.isAvailable else {
            WidgetPublisher.shared.update(healthSteps: [])
            return false
        }
        do {
            if try await store.statusForAuthorizationRequest(toShare: AppPermissions.healthShare, read: AppPermissions.healthRead) == .shouldRequest {
                requestTrigger.toggle()
                return true
            }
            await load()
        } catch {
            Self.log.error("HealthKit authorization status failed: \(String(describing: error))")
        }
        return false
    }

    func load() async {
        #if DEBUG
        do {
            try await HealthSeed.writeIfRequested(store)
        } catch {
            Self.log.error("Seeding HealthKit failed: \(String(describing: error))")
        }
        #endif
        do {
            async let weights = readWeights()
            async let steps = readDailySums(Self.stepCount, unit: .count())
            async let flights = readDailySums(Self.flightsClimbed, unit: .count())
            async let distance = readDailySums(Self.distanceWalkingRunning, unit: .meter())
            let read = try await steps
            update(weights: try await weights, steps: read, flights: try await flights, distance: try await distance, logged: logged)
            WidgetPublisher.shared.update(healthSteps: read)
        } catch {
            Self.log.error("Reading HealthKit failed: \(String(describing: error))")
        }
    }

    func update(logged: [BodyWeight]) {
        update(weights: weights, steps: steps, flights: flights, distance: distance, logged: logged)
    }

    private func update(weights: [HealthWeight], steps: [DatedValue], flights: [DatedValue], distance: [DatedValue], logged: [BodyWeight]) {
        let weighInsChanged = weights != self.weights || logged != self.logged
        guard weighInsChanged || steps != self.steps || flights != self.flights || distance != self.distance else { return }
        if weighInsChanged {
            self.weights = weights
            self.logged = logged
            weighIns = WeighIns.merge(logged: logged, health: weights)
        }
        if steps != self.steps { self.steps = steps }
        if flights != self.flights { self.flights = flights }
        if distance != self.distance { self.distance = distance }
        revision += 1
    }

    private func readWeights() async throws -> [HealthWeight] {
        let query = HKSampleQueryDescriptor(
            predicates: [.quantitySample(type: Self.bodyMass)],
            sortDescriptors: [SortDescriptor(\.startDate)]
        )
        return try await query.result(for: store).map {
            HealthWeight(id: $0.uuid, date: $0.startDate, kg: $0.quantity.doubleValue(for: .gramUnit(with: .kilo)))
        }
    }

    /// A cumulative type's daily totals two years back, which covers every range but All on a phone that has used Health
    /// for longer.
    private func readDailySums(_ type: HKQuantityType, unit: HKUnit) async throws -> [DatedValue] {
        let calendar = Calendar.current
        let end = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: .now))!
        let start = calendar.date(byAdding: .year, value: -2, to: end)!
        let query = HKStatisticsCollectionQueryDescriptor(
            predicate: .quantitySample(type: type, predicate: HKQuery.predicateForSamples(withStart: start, end: end)),
            options: .cumulativeSum,
            anchorDate: start,
            intervalComponents: DateComponents(day: 1)
        )
        var days: [DatedValue] = []
        try await query.result(for: store).enumerateStatistics(from: start, to: end) { statistics, _ in
            guard let sum = statistics.sumQuantity()?.doubleValue(for: unit), sum > 0 else { return }
            days.append(DatedValue(date: statistics.startDate, value: sum))
        }
        return days
    }
}

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
