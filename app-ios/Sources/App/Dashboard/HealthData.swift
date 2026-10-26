import Foundation
import HealthKit
import os

/// Read live and never copied into the database; see docs/decisions/workouts.md. HealthKit hides read denial, so a
/// denied store reads as no data. The app's own weigh-ins merge in here, so the dashboard has one weigh-in source.
@MainActor @Observable
final class HealthData {
    private(set) var weighIns: [WeighIn] = []
    private(set) var steps: [DatedValue] = []
    /// Bumps whenever `weighIns` or `steps` changes; dashboard values derived from them key on it.
    private(set) var revision = 0

    @ObservationIgnored private var weights: [HealthWeight] = []
    @ObservationIgnored private var logged: [BodyWeight] = []

    /// Flips when HealthKit says it should ask, which makes `healthDataAccessRequest` present its sheet.
    private(set) var requestTrigger = false

    @ObservationIgnored let store = HKHealthStore()
    static let readTypes: Set<HKObjectType> = [HKQuantityType(.bodyMass), HKQuantityType(.stepCount)]
    #if DEBUG
    static let shareTypes: Set<HKSampleType> = HealthSeed.isRequested ? [HKQuantityType(.bodyMass), HKQuantityType(.stepCount)] : []
    #else
    static let shareTypes: Set<HKSampleType> = []
    #endif
    private static let bodyMass = HKQuantityType(.bodyMass)
    private static let stepCount = HKQuantityType(.stepCount)
    private static let log = Logger(subsystem: "com.stefan.a-better-me", category: "health")

    func refresh() async {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        do {
            if try await store.statusForAuthorizationRequest(toShare: Self.shareTypes, read: Self.readTypes) == .shouldRequest {
                requestTrigger.toggle()
            } else {
                await load()
            }
        } catch {
            Self.log.error("HealthKit authorization status failed: \(String(describing: error))")
        }
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
            async let steps = readSteps()
            update(weights: try await weights, steps: try await steps, logged: logged)
        } catch {
            Self.log.error("Reading HealthKit failed: \(String(describing: error))")
        }
    }

    func update(logged: [BodyWeight]) {
        update(weights: weights, steps: steps, logged: logged)
    }

    private func update(weights: [HealthWeight], steps: [DatedValue], logged: [BodyWeight]) {
        let weighInsChanged = weights != self.weights || logged != self.logged
        guard weighInsChanged || steps != self.steps else { return }
        if weighInsChanged {
            self.weights = weights
            self.logged = logged
            weighIns = WeighIns.merge(logged: logged, health: weights)
        }
        if steps != self.steps { self.steps = steps }
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

    /// Two years back, which covers every range but All on a phone that has used Health for longer.
    private func readSteps() async throws -> [DatedValue] {
        let calendar = Calendar.current
        let end = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: .now))!
        let start = calendar.date(byAdding: .year, value: -2, to: end)!
        let query = HKStatisticsCollectionQueryDescriptor(
            predicate: .quantitySample(type: Self.stepCount, predicate: HKQuery.predicateForSamples(withStart: start, end: end)),
            options: .cumulativeSum,
            anchorDate: start,
            intervalComponents: DateComponents(day: 1)
        )
        var days: [DatedValue] = []
        try await query.result(for: store).enumerateStatistics(from: start, to: end) { statistics, _ in
            guard let sum = statistics.sumQuantity()?.doubleValue(for: .count()), sum > 0 else { return }
            days.append(DatedValue(date: statistics.startDate, value: sum))
        }
        return days
    }
}

#if DEBUG
/// Launch with `-seedHealthSamples` to write 60 days of body mass and steps into the simulator's Health store, once, so
/// the Dashboard's HealthKit cards have data. Debug builds ask for write access only for this.
enum HealthSeed {
    static let launchArgument = "-seedHealthSamples"

    static let isRequested = ProcessInfo.processInfo.arguments.contains(launchArgument)

    static func writeIfRequested(_ store: HKHealthStore) async throws {
        guard isRequested else { return }
        let bodyMass = HKQuantityType(.bodyMass)
        let stepCount = HKQuantityType(.stepCount)
        let existing = try await HKSampleQueryDescriptor(predicates: [.quantitySample(type: bodyMass)], sortDescriptors: [], limit: 1).result(for: store)
        guard existing.isEmpty else { return }
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: .now)
        var samples: [HKQuantitySample] = []
        for offset in 0..<60 {
            let day = calendar.date(byAdding: .day, value: -offset, to: today)!
            if offset % 4 != 3 {
                let kg = 84 - Double(60 - offset) * 0.04 + sin(Double(offset) * 1.7) * 0.6
                let morning = min(day.addingTimeInterval(7 * 3600), Date.now.addingTimeInterval(-120))
                samples.append(HKQuantitySample(type: bodyMass, quantity: HKQuantity(unit: .gramUnit(with: .kilo), doubleValue: (kg * 10).rounded() / 10), start: morning, end: morning))
            }
            let steps = 4000 + Double((offset * 2731) % 9000)
            let walk = min(day.addingTimeInterval(12 * 3600), Date.now.addingTimeInterval(-60))
            samples.append(HKQuantitySample(type: stepCount, quantity: HKQuantity(unit: .count(), doubleValue: steps), start: walk, end: walk))
        }
        try await store.save(samples)
    }
}
#endif
