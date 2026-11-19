import Foundation
import GRDB
import HealthKit
import os

/// The weigh-ins and daily activity totals every screen reads, from the database. Apple Health is copied into it on
/// each launch and each return to the app (`HealthMirror`), so a launch shows the last copy in its first frame and the
/// server holds what the phone shows; see docs/decisions/workouts.md.
@MainActor @Observable
final class HealthData {
    private(set) var weighIns: [WeighIn] = []
    private(set) var steps: [DatedValue] = []
    private(set) var flights: [DatedValue] = []
    /// Walking and running distance per day, in meters.
    private(set) var distance: [DatedValue] = []
    /// Bumps whenever `weighIns`, `steps`, `flights`, or `distance` changes; dashboard values derived from them key on it.
    private(set) var revision = 0

    @ObservationIgnored private var readings = BodyReadings()

    /// Whether Health answered once this launch, available or not, and its copy was written. The steps widget keeps its
    /// last file until then.
    private(set) var hasRead = false

    /// Flips when HealthKit says it should ask, which makes `healthDataAccessRequest` present its sheet.
    private(set) var requestTrigger = false

    @ObservationIgnored let store = HealthStore.shared
    @ObservationIgnored private let localStore: LocalStore
    @ObservationIgnored private var observation: AnyDatabaseCancellable?

    init(store localStore: LocalStore) {
        self.localStore = localStore
        observation = ValueObservation.trackingConstantRegion { try BodyReadings.fetch($0, calendar: .current) }
            .removeDuplicates()
            .start(
                in: localStore.database.pool,
                scheduling: .immediate,
                onError: { LocalStore.log.error("Body readings observation failed: \(String(describing: $0))") },
                onChange: { [weak self] in self?.update($0) }
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
    /// Set once Health's whole history of daily totals is copied; later reads go two years back.
    private static let historyCopiedKey = "healthHistoryCopied"

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
            let calendar = Calendar.current
            let today = calendar.startOfDay(for: .now)
            let historyCopied = UserDefaults.standard.bool(forKey: Self.historyCopiedKey)
            // Two years covers every chart range but All, and a day older than that no longer changes in Health.
            let from = historyCopied
                ? calendar.date(byAdding: .day, value: 1, to: calendar.date(byAdding: .year, value: -2, to: today)!)!
                : calendar.date(from: DateComponents(year: 2010))!
            async let weights = readWeights()
            async let steps = store.dailySums(of: Self.stepCount, unit: .count(), from: from, through: .now, calendar: calendar)
            async let flights = store.dailySums(of: Self.flightsClimbed, unit: .count(), from: from, through: .now, calendar: calendar)
            async let distance = store.dailySums(of: Self.distanceWalkingRunning, unit: .meter(), from: from, through: .now, calendar: calendar)
            let read = HealthRead(
                weights: try await weights,
                days: [
                    .steps: PhonePedometer.merge(await PhonePedometer.steps(from: today, to: .now), into: try await steps, today: today),
                    .flightsClimbed: try await flights,
                    .walkingDistance: try await distance,
                ],
                from: from
            )
            try await localStore.write { try HealthMirror.apply(read, to: $0, calendar: calendar) }.value
            if !historyCopied, read.days.values.contains(where: { !$0.isEmpty }) {
                UserDefaults.standard.set(true, forKey: Self.historyCopiedKey)
            }
            hasRead = true
        } catch {
            Self.log.error("Copying HealthKit failed: \(String(describing: error))")
        }
    }

    private func update(_ readings: BodyReadings) {
        guard readings != self.readings else { return }
        if readings.weighIns != self.readings.weighIns { weighIns = readings.weighIns }
        if readings.steps != self.readings.steps { steps = readings.steps }
        if readings.flights != self.readings.flights { flights = readings.flights }
        if readings.distance != self.readings.distance { distance = readings.distance }
        self.readings = readings
        revision += 1
    }

    private func readWeights() async throws -> [HealthWeight] {
        let query = HKSampleQueryDescriptor(predicates: [.quantitySample(type: Self.bodyMass)], sortDescriptors: [SortDescriptor(\.startDate)])
        return try await query.result(for: store).map {
            HealthWeight(id: $0.uuid, date: $0.startDate, kg: $0.quantity.doubleValue(for: .gramUnit(with: .kilo)))
        }
    }
}
