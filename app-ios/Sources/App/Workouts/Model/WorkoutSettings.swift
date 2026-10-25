import Foundation

/// The research spec's §9 Workout settings with MF's defaults, encoded whole into `settings.workout`. A key added later
/// needs no migration: rows written before it read its default. The five per-category rest durations stay columns on
/// `AppSettings`.
struct WorkoutSettings: Codable, Hashable {
    var rest = RestSettings()
    var progression = ProgressionSettings()
    var warmUp = WarmUpSettings()
    var previousReference = PreviousReference.anyWorkout
    var propagateChanges = true
    var rirTracking = true
    var supersetAutoScroll = true
    var exerciseAutoNext = true
    var display = DisplaySettings()
    var sections = WorkoutSectionsLayout()
    /// Per gym, keyed by the gym's id. A gym without an entry has every option off.
    var plateCalculator: [String: PlateCalculatorOptions] = [:]

    func plateCalculator(for gymID: UUID) -> PlateCalculatorOptions {
        plateCalculator[gymID.uuidString] ?? PlateCalculatorOptions()
    }
}

/// MF's gym-level plate calculator switches (`useBumperPlatesInPlateCalculator`, `allowMixedUnitsInPlateCalculator`,
/// `offsetWeightInPlateCalculator`). `gym_profiles` has no column for them, so they live in the synced settings.
struct PlateCalculatorOptions: Codable, Hashable {
    var includeBumperPlates = false
    var allowMixedUnits = false
    var offsetWeight = false
}

extension PlateCalculatorOptions {
    /// `row.json(_:over:)` fills missing keys only where the default tree has them, and it has no entry per gym, so an
    /// entry written before a new option existed decodes that option's default here instead of failing the column.
    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        includeBumperPlates = try container.decodeIfPresent(Bool.self, forKey: .includeBumperPlates) ?? false
        allowMixedUnits = try container.decodeIfPresent(Bool.self, forKey: .allowMixedUnits) ?? false
        offsetWeight = try container.decodeIfPresent(Bool.self, forKey: .offsetWeight) ?? false
    }
}

struct ProgressionSettings: Codable, Hashable {
    var initialFill = InitialFill.smartProgression
    var applyInSession = true
    var expandRepRange = true
    var weightMatch = false
}

enum InitialFill: String, Codable {
    case smartProgression, previousValues
}

struct WarmUpSettings: Codable, Hashable {
    var automation = WarmUpAutomation.smart
    var schemes = Dictionary(uniqueKeysWithValues: RestCategory.allCases.map { ($0, WarmUpStep.standard) })
    var hideCompletedSets = true
    var simplifyPlates = true
}

enum WarmUpAutomation: String, Codable {
    case none, smart, scheme
}

struct WarmUpStep: Codable, Hashable {
    /// Of the first working set's target weight.
    var percent: Int
    var reps: Int

    static let standard = [WarmUpStep(percent: 40, reps: 5), WarmUpStep(percent: 60, reps: 5), WarmUpStep(percent: 80, reps: 3)]
}

enum PreviousReference: String, Codable {
    case anyWorkout, withinProgram
}

struct DisplaySettings: Codable, Hashable {
    var keepAlive = false
    var workoutTimer = true
    var bodyweightContribution = true
    var calendarScrolling = CalendarScrolling.daily
}

enum CalendarScrolling: String, Codable {
    case daily, weekly
}

extension WorkoutSettings {
    var flow: FlowRules { FlowRules(rest: rest, supersetAutoScroll: supersetAutoScroll, exerciseAutoNext: exerciseAutoNext) }
}
