import Foundation

/// Customize Dashboard, encoded whole into `settings.dashboard`. Order is array order, and a card missing from its
/// array is hidden, so there is no `hidden` flag that could disagree with the order.
struct DashboardLayout: Codable, Hashable {
    var primaryFocus: [FocusCard] = [.workouts, .recentRecords]
    var sections = DashboardSection.allCases
    var insights: [InsightCard] = [.workouts, .weightTrend]
    var habits: [HabitCard] = [.weighIn, .workouts]
    var bodyMetrics: [BodyMetricCard] = [.scaleWeight]
    var muscles: [MuscleCard] = []
    var exercises: [ExerciseCard] = []
    var general: [GeneralCard] = [.steps]
}

enum FocusCard: String, Codable {
    case workouts, recentRecords
}

enum DashboardSection: String, Codable, CaseIterable {
    case insights, habits, bodyMetrics, muscles, exercises, general
}

enum InsightCard: String, Codable {
    case workouts, weightTrend
}

enum HabitCard: String, Codable {
    case weighIn, workouts
}

enum BodyMetricCard: String, Codable {
    case scaleWeight
}

enum GeneralCard: String, Codable {
    case steps, period
}

struct MuscleCard: Codable, Hashable {
    var muscle: Muscle
    var metric = MuscleMetric.sets
}

enum MuscleMetric: String, Codable {
    case sets, volume
}

struct ExerciseCard: Codable, Hashable {
    var exerciseID: ExerciseID
    var metric = ExerciseChartMetric.oneRM
}

enum ExerciseChartMetric: String, Codable, CaseIterable {
    case oneRM, threeRM, tenRM, heaviestWeight, totalVolume, bestSetVolume, totalReps, bestSetReps, totalSets
}

/// The "+" sheet's Shortcuts, encoded whole into `settings.shortcuts`.
struct ShortcutsLayout: Codable, Hashable {
    var upNextBanner = true
    var top = Shortcut.history
    var items: [Shortcut] = [.weight, .emptyWorkout, .newProgram, .newWorkout]
}

enum Shortcut: String, Codable {
    case weight, history, emptyWorkout, newWorkout, newProgram
}
