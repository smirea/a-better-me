import Foundation
import HealthKit

/// Reads the workouts and sleep samples of every app that writes to Apple Health, for `HealthMirror`.
enum HealthSessions {
    static let sleepType = HKCategoryType(.sleepAnalysis)
    static let readTypes = Set<HKObjectType>([sleepType, .workoutType(), heartRate, activeEnergy]).union(distanceTypes)

    private static let heartRate = HKQuantityType(.heartRate)
    private static let activeEnergy = HKQuantityType(.activeEnergyBurned)
    private static let distanceTypes: Set<HKQuantityType> = [
        HKQuantityType(.distanceWalkingRunning), HKQuantityType(.distanceCycling), HKQuantityType(.distanceSwimming),
        HKQuantityType(.distanceWheelchair), HKQuantityType(.distanceDownhillSnowSports), HKQuantityType(.distanceRowing),
        HKQuantityType(.distanceCrossCountrySkiing), HKQuantityType(.distancePaddleSports), HKQuantityType(.distanceSkatingSports),
    ]
    private static let beatsPerMinute = HKUnit.count().unitDivided(by: .minute())

    static func workouts(from: Date, in store: HKHealthStore) async throws -> [HealthWorkout] {
        let query = HKSampleQueryDescriptor(
            predicates: [.workout(HKQuery.predicateForSamples(withStart: from, end: nil))], sortDescriptors: [SortDescriptor(\.startDate)]
        )
        return try await query.result(for: store).map { workout in
            let heartRate = workout.statistics(for: heartRate)
            return HealthWorkout(
                id: workout.uuid,
                activityType: workout.workoutActivityType.snakeName,
                start: workout.startDate,
                end: workout.endDate,
                activeKcal: workout.statistics(for: activeEnergy)?.sumQuantity()?.doubleValue(for: .kilocalorie()),
                distanceMeters: workout.allStatistics.first { distanceTypes.contains($0.key) }?.value.sumQuantity()?.doubleValue(for: .meter()),
                averageHeartRate: heartRate?.averageQuantity()?.doubleValue(for: beatsPerMinute),
                maxHeartRate: heartRate?.maximumQuantity()?.doubleValue(for: beatsPerMinute),
                source: HealthSource(workout.sourceRevision.source)
            )
        }
    }

    static func sleep(from: Date, in store: HKHealthStore) async throws -> [HealthSleepSample] {
        let query = HKSampleQueryDescriptor(
            predicates: [.categorySample(type: sleepType, predicate: HKQuery.predicateForSamples(withStart: from, end: nil))],
            sortDescriptors: [SortDescriptor(\.startDate)]
        )
        return try await query.result(for: store).compactMap { sample in
            let stage: HealthSleepSample.Stage? = switch HKCategoryValueSleepAnalysis(rawValue: sample.value) {
            case .inBed: .inBed
            case .awake: .awake
            case .asleepUnspecified: .asleep
            case .asleepCore: .core
            case .asleepDeep: .deep
            case .asleepREM: .rem
            default: nil
            }
            return stage.map {
                HealthSleepSample(id: sample.uuid, start: sample.startDate, end: sample.endDate, stage: $0, source: HealthSource(sample.sourceRevision.source))
            }
        }
    }
}

extension HealthSource {
    init(_ source: HKSource) {
        self.init(bundle: source.bundleIdentifier, name: source.name)
    }
}

extension HKWorkoutActivityType {
    /// The case name in snake case; a type this list lacks keeps its raw value, so it is still told apart.
    var snakeName: String {
        switch self {
        case .americanFootball: "american_football"
        case .archery: "archery"
        case .australianFootball: "australian_football"
        case .badminton: "badminton"
        case .baseball: "baseball"
        case .basketball: "basketball"
        case .bowling: "bowling"
        case .boxing: "boxing"
        case .climbing: "climbing"
        case .cricket: "cricket"
        case .crossTraining: "cross_training"
        case .curling: "curling"
        case .cycling: "cycling"
        case .elliptical: "elliptical"
        case .equestrianSports: "equestrian_sports"
        case .fencing: "fencing"
        case .fishing: "fishing"
        case .functionalStrengthTraining: "functional_strength_training"
        case .golf: "golf"
        case .gymnastics: "gymnastics"
        case .handball: "handball"
        case .hiking: "hiking"
        case .hockey: "hockey"
        case .hunting: "hunting"
        case .lacrosse: "lacrosse"
        case .martialArts: "martial_arts"
        case .mindAndBody: "mind_and_body"
        case .paddleSports: "paddle_sports"
        case .play: "play"
        case .preparationAndRecovery: "preparation_and_recovery"
        case .racquetball: "racquetball"
        case .rowing: "rowing"
        case .rugby: "rugby"
        case .running: "running"
        case .sailing: "sailing"
        case .skatingSports: "skating_sports"
        case .snowSports: "snow_sports"
        case .soccer: "soccer"
        case .softball: "softball"
        case .squash: "squash"
        case .stairClimbing: "stair_climbing"
        case .surfingSports: "surfing_sports"
        case .swimming: "swimming"
        case .tableTennis: "table_tennis"
        case .tennis: "tennis"
        case .trackAndField: "track_and_field"
        case .traditionalStrengthTraining: "traditional_strength_training"
        case .volleyball: "volleyball"
        case .walking: "walking"
        case .waterFitness: "water_fitness"
        case .waterPolo: "water_polo"
        case .waterSports: "water_sports"
        case .wrestling: "wrestling"
        case .yoga: "yoga"
        case .barre: "barre"
        case .coreTraining: "core_training"
        case .crossCountrySkiing: "cross_country_skiing"
        case .downhillSkiing: "downhill_skiing"
        case .flexibility: "flexibility"
        case .highIntensityIntervalTraining: "high_intensity_interval_training"
        case .jumpRope: "jump_rope"
        case .kickboxing: "kickboxing"
        case .pilates: "pilates"
        case .snowboarding: "snowboarding"
        case .stairs: "stairs"
        case .stepTraining: "step_training"
        case .wheelchairWalkPace: "wheelchair_walk_pace"
        case .wheelchairRunPace: "wheelchair_run_pace"
        case .taiChi: "tai_chi"
        case .mixedCardio: "mixed_cardio"
        case .handCycling: "hand_cycling"
        case .discSports: "disc_sports"
        case .fitnessGaming: "fitness_gaming"
        case .cardioDance: "cardio_dance"
        case .socialDance: "social_dance"
        case .pickleball: "pickleball"
        case .cooldown: "cooldown"
        case .swimBikeRun: "swim_bike_run"
        case .transition: "transition"
        case .underwaterDiving: "underwater_diving"
        case .other: "other"
        @unknown default: "type_\(rawValue)"
        }
    }
}
