import Foundation
import GRDB

/// What the owner is working toward. Encoded whole into `nutrition_plans.goal`.
struct NutritionGoal: Hashable, Codable, Sendable {
    enum Kind: String, Codable, Sendable { case lose, maintain, gain }

    var kind: Kind
    var targetWeightKg: Double?
    /// Percent of body weight per week, negative while losing.
    var ratePercentPerWeek: Double
    var startedOn: CalendarDay
}

/// How targets are made. Encoded whole into `nutrition_plans.coaching`.
struct CoachingProgram: Hashable, Codable, Sendable {
    enum Style: String, Codable, Sendable { case coached, collaborative, manual }
    enum Diet: String, Codable, Sendable { case balanced, lowFat = "low_fat", lowCarb = "low_carb", keto }
    enum Protein: String, Codable, Sendable { case low, moderate, high, extraHigh = "extra_high" }
    enum Floor: String, Codable, Sendable { case standard, low, ignored }
    /// Mainly moves the protein recommendation.
    enum Training: String, Codable, Sendable { case none, lifting, cardio, cardioLifting = "cardio_lifting" }

    var style = Style.coached
    var diet = Diet.balanced
    var protein = Protein.moderate
    var floor = Floor.standard
    var training = Training.lifting
    /// ISO weekdays (Monday 1) that get more calories; empty spreads them evenly.
    var highDays: [Int] = []
}

/// One day's calorie and macro targets: kcal and grams.
struct DayTarget: Hashable, Codable, Sendable {
    var energy: Double
    var protein: Double
    var fat: Double
    var carbs: Double

    var amounts: NutrientAmounts { [.energy: energy, .protein: protein, .fat: fat, .carbs: carbs] }

    func amount(_ id: NutrientID) -> Double? { amounts[id] }
}

/// Exactly seven targets, Monday first. Encodes as the bare array.
struct WeekTargets: Hashable, Codable, Sendable {
    private(set) var days: [DayTarget]

    init(_ days: [DayTarget]) {
        precondition(days.count == 7, "A week has seven targets, not \(days.count)")
        self.days = days
    }

    init(every target: DayTarget) {
        days = Array(repeating: target, count: 7)
    }

    subscript(weekday: Int) -> DayTarget {
        get { days[weekday - 1] }
        set { days[weekday - 1] = newValue }
    }

    init(from decoder: any Decoder) throws {
        let days = try decoder.singleValueContainer().decode([DayTarget].self)
        guard days.count == 7 else {
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "\(days.count) targets, not 7"))
        }
        self.days = days
    }

    func encode(to encoder: any Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(days)
    }
}

/// A row of the synced `nutrition_plans` table: the strategy from its day on, until the next plan's day. The id is that
/// first day, so saving a second plan on one day replaces the first, and past days keep the targets they had.
struct NutritionPlan: SyncedRecord {
    static let table = "nutrition_plans"

    enum Kind: String, Codable, Sendable {
        /// The first plan, from setup.
        case setup
        /// A weekly check-in's new targets.
        case checkIn = "check_in"
        /// The owner changed the goal, program, or targets by hand.
        case edit
    }

    var id: CalendarDay
    var kind: Kind
    var goal: NutritionGoal
    var coaching: CoachingProgram
    var targets: WeekTargets
    /// What a check-in computed and used. Every other expenditure and trend value is recomputed, never stored.
    var expenditureKcal: Double?
    var trendWeightKg: Double?
    var createdAt: Date

    init(from day: CalendarDay, kind: Kind, goal: NutritionGoal, coaching: CoachingProgram, targets: WeekTargets, at date: Date = .now) {
        id = day
        self.kind = kind
        self.goal = goal
        self.coaching = coaching
        self.targets = targets
        createdAt = date
    }

    func target(on day: CalendarDay) -> DayTarget { targets[day.weekday] }

    /// The plan in force on `day`: the latest that starts on or before it.
    static func effective(on day: CalendarDay, in plans: [NutritionPlan]) -> NutritionPlan? {
        plans.filter { $0.id <= day }.max { $0.id < $1.id }
    }

    init(row: Row) throws {
        id = try row.day("id")
        kind = (row["kind"] as String?).flatMap(Kind.init(rawValue:)) ?? .edit
        goal = try row.json("goal")
        coaching = try row.json("coaching")
        targets = try row.json("targets")
        expenditureKcal = row["expenditure_kcal"]
        trendWeightKg = row["trend_weight_kg"]
        createdAt = try row.instant("created_at")
    }

    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = key
        container["kind"] = kind.rawValue
        container["goal"] = try RowJSON.text(goal)
        container["coaching"] = try RowJSON.text(coaching)
        container["targets"] = try RowJSON.text(targets)
        container["expenditure_kcal"] = expenditureKcal
        container["trend_weight_kg"] = trendWeightKg
        container["created_at"] = Instant.text(createdAt)
    }
}
