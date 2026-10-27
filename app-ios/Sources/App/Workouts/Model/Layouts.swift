import Foundation

/// Customize Dashboard, encoded whole into `settings.dashboard`. Order is array order, and a card missing from its
/// array is hidden, so there is no `hidden` flag that could disagree with the order.
struct DashboardLayout: Codable, Hashable {
    /// Bumped when a release adds cards; see `init(from:)`.
    static let revision = 2

    var primaryFocus: [FocusCard] = [.workouts, .recentRecords, .weeklyNutrition, .energyBalance, .dailyNutrition]
    var sections = DashboardSection.allCases
    var insights: [InsightCard] = [.workouts, .weightTrend, .expenditure, .energyBalance, .goalProgress]
    var habits: [HabitCard] = [.weighIn, .foodLogging, .workouts]
    var nutrition: [NutritionCard] = NutritionCard.defaults
    var bodyMetrics: [BodyMetricCard] = [.scaleWeight, .visualBodyFat]
    var muscles: [MuscleCard] = []
    var exercises: [ExerciseCard] = []
    var general: [GeneralCard] = [.steps]
    /// The last revision whose cards this layout adopted. It stays nil in the defaults, because the settings reader
    /// fills a key the stored text lacks from the defaults, and a filled-in revision would skip the adoption.
    var revision: Int?

    /// What Customize Dashboard saves: stamped with the current revision, so a layout made from the defaults, whose
    /// revision is nil, does not adopt the cards the owner just removed on its next read.
    var saved: DashboardLayout {
        var layout = self
        layout.revision = Self.revision
        return layout
    }
}

extension DashboardLayout {
    /// A saved layout lists only the cards that existed when it was saved, and a missing card is hidden, so a card a
    /// later release adds would never show. Decoding adopts each newer revision's cards at their default position, and
    /// the next save stores the revision, so a card the owner removes afterwards stays removed.
    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let defaults = DashboardLayout()
        primaryFocus = try container.decodeIfPresent([FocusCard].self, forKey: .primaryFocus) ?? defaults.primaryFocus
        sections = try container.decodeIfPresent([DashboardSection].self, forKey: .sections) ?? defaults.sections
        insights = try container.decodeIfPresent([InsightCard].self, forKey: .insights) ?? defaults.insights
        habits = try container.decodeIfPresent([HabitCard].self, forKey: .habits) ?? defaults.habits
        nutrition = try container.decodeIfPresent([NutritionCard].self, forKey: .nutrition) ?? defaults.nutrition
        bodyMetrics = try container.decodeIfPresent([BodyMetricCard].self, forKey: .bodyMetrics) ?? defaults.bodyMetrics
        muscles = try container.decodeIfPresent([MuscleCard].self, forKey: .muscles) ?? defaults.muscles
        exercises = try container.decodeIfPresent([ExerciseCard].self, forKey: .exercises) ?? defaults.exercises
        general = try container.decodeIfPresent([GeneralCard].self, forKey: .general) ?? defaults.general
        let saved = try container.decodeIfPresent(Int.self, forKey: .revision) ?? 0
        if saved < 1 {
            primaryFocus.adopt([.weeklyNutrition, .energyBalance, .dailyNutrition], from: defaults.primaryFocus)
            insights.adopt([.expenditure, .energyBalance, .goalProgress], from: defaults.insights)
            habits.adopt([.foodLogging], from: defaults.habits)
        }
        if saved < 2 {
            sections.adopt([.nutrition], from: defaults.sections)
            bodyMetrics.adopt([.visualBodyFat], from: defaults.bodyMetrics)
        }
        revision = Self.revision
    }
}

private extension Array where Element: Equatable {
    /// Inserts each missing card of `added` after the nearest card before it in `defaults` that the array holds.
    mutating func adopt(_ added: [Element], from defaults: [Element]) {
        for card in added where !contains(card) {
            let anchor = defaults.prefix { $0 != card }.last { contains($0) }
            insert(card, at: anchor.flatMap { firstIndex(of: $0) }.map { $0 + 1 } ?? 0)
        }
    }
}

enum FocusCard: String, Codable {
    case workouts, recentRecords, weeklyNutrition, energyBalance, dailyNutrition
}

enum DashboardSection: String, Codable, CaseIterable {
    case insights, habits, nutrition, bodyMetrics, muscles, exercises, general
}

enum InsightCard: String, Codable {
    case workouts, weightTrend, expenditure, energyBalance, goalProgress
}

enum HabitCard: String, Codable {
    case weighIn, workouts, foodLogging
}

/// A raw-value enum rather than a wrapper around `BodyMetricKind`, so layouts saved before the tape measurements existed
/// still decode. Steps live in General, not here.
enum BodyMetricCard: String, Codable, CaseIterable {
    case scaleWeight, visualBodyFat
    case neck, shoulders, bust, chest, waist, hips
    case leftBicep, rightBicep, leftForearm, rightForearm, leftWrist, rightWrist
    case leftThigh, rightThigh, leftCalf, rightCalf, leftAnkle, rightAnkle
    case waistToHeight, waistToHip
}

/// The Macros tile or one nutrient's tile, with how the tile states its value.
struct NutritionCard: Codable, Hashable {
    enum Display: String, Codable, CaseIterable {
        case percent, consumed, remaining
    }

    /// Nil is the Macros tile.
    var nutrient: NutrientID?
    var display = Display.consumed

    static let macros = NutritionCard(nutrient: nil)
    /// MacroFactor's defaults, which the owner kept: Macros, then Calories, Protein, Fiber, Carbs, and Sugars Added.
    static let defaults: [NutritionCard] = [.macros] + ([.energy, .protein, .fiber, .carbs, "539"] as [NutrientID]).map { NutritionCard(nutrient: $0) }
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
