import Foundation
import GRDB
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

    /// Whether Health answered once, available or not. The steps widget keeps its last file until then.
    private(set) var hasRead = false

    /// Flips when HealthKit says it should ask, which makes `healthDataAccessRequest` present its sheet.
    private(set) var requestTrigger = false

    @ObservationIgnored let store = HealthStore.shared
    @ObservationIgnored private var loggedObservation: AnyDatabaseCancellable?

    /// The app's own weigh-ins merge into Health's, so it observes them itself.
    init(store localStore: LocalStore) {
        loggedObservation = ValueObservation.trackingConstantRegion { try BodyWeight.all.fetch($0) }
            .removeDuplicates()
            .start(
                in: localStore.database.pool,
                scheduling: .immediate,
                onError: { LocalStore.log.error("Weigh-in observation failed: \(String(describing: $0))") },
                onChange: { [weak self] in self?.update(logged: $0) }
            )
    }
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
            hasRead = true
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
            let today = Calendar.current.startOfDay(for: .now)
            let read = PhonePedometer.merge(await PhonePedometer.steps(from: today, to: .now), into: try await steps, today: today)
            update(weights: try await weights, steps: read, flights: try await flights, distance: try await distance, logged: logged)
            hasRead = true
        } catch {
            Self.log.error("Reading HealthKit failed: \(String(describing: error))")
        }
    }

    private func update(logged: [BodyWeight]) {
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
            HealthWeight(date: $0.startDate, kg: $0.quantity.doubleValue(for: .gramUnit(with: .kilo)))
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
