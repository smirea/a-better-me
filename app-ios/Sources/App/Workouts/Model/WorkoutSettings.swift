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

struct RestSettings: Codable, Hashable {
    var enabled = true
    var playSound = true
    var vibrate = true
    var afterLastWarmUp = true
    var betweenExercises = false
    var betweenSides = false
    var scaling = RestScaling()
}

/// Percent of the resolved rest.
struct RestScaling: Codable, Hashable {
    var afterLastWarmUp = 75
    var betweenExercises = 100
    var betweenSides = 50
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
