import Foundation

extension NutritionEngine {
    /// Calendar weekday numbers, so `calendar.component(.weekday, from:)` maps straight to a case.
    enum Weekday: Int, CaseIterable, Hashable, Codable {
        case sunday = 1, monday, tuesday, wednesday, thursday, friday, saturday

        /// The order MacroFactor's program chart uses.
        static let mondayFirst: [Weekday] = [.monday, .tuesday, .wednesday, .thursday, .friday, .saturday, .sunday]
    }

    enum GoalKind: Hashable, Codable {
        case lose, maintain, gain
    }

    struct Goal: Hashable, Codable {
        var kind: GoalKind
        /// Percent of body weight per week, always positive; `kind` gives the direction. MacroFactor stores the rate
        /// this way, so the weekly pounds shrink as weight falls. Maintain ignores it.
        var ratePercentPerWeek: Double
        var targetWeightKg: Double?
    }

    enum DietStyle: Hashable, Codable {
        case balanced, lowFat, lowCarb, keto
    }

    enum ProteinLevel: Hashable, Codable, CaseIterable {
        case low, moderate, high, extraHigh

        /// Grams per pound of body weight, read off MacroFactor's wizard for one lifting profile.
        var gramsPerLb: Double {
            switch self {
            case .low: 0.63
            case .moderate: 0.77
            case .high: 0.93
            case .extraHigh: 1.08
            }
        }
    }

    /// MacroFactor individualizes the standard floor (the owner's is 1361 kcal, the help's generic figure is 1200) by
    /// a rule it does not publish, so the feature passes the standard floor in. The low floor is two thirds of it.
    enum CalorieFloor: Hashable, Codable {
        case standard(kcal: Int)
        case low(standardKcal: Int)
        case ignored

        var kcal: Int {
            switch self {
            case let .standard(kcal): kcal
            case let .low(standard): Int((Double(standard) * 2 / 3).rounded())
            case .ignored: 0
            }
        }
    }

    struct CoachedProgram: Hashable, Codable {
        var diet: DietStyle
        var protein: ProteinLevel
        var floor: CalorieFloor
        /// Days that get a higher target. Empty distributes evenly.
        var highDays: Set<Weekday> = []
    }

    struct DayTarget: Hashable, Codable {
        var kcal: Int
        var proteinG: Int
        var fatG: Int
        var carbsG: Int
    }

    struct WeeklyPlan: Hashable, Codable {
        var days: [Weekday: DayTarget]
        /// The diet the plan ended up on: keto when protein plus the fat floor left no room for the chosen diet.
        var diet: DietStyle
        var proteinReduced: Bool

        var averageKcal: Double { Double(days.values.map(\.kcal).reduce(0, +)) / 7 }
    }

    enum Targets {
        /// The deficit or surplus one pound a week costs, the 3500 kcal rule MacroFactor's wizard reproduces.
        static let kcalPerLbPerWeek = 3500.0
        /// High days get this much more than the other days; the week's total is unchanged (measured: 1564 vs 1421).
        static let highDayShift = 1.1
        /// Fat never goes below this many grams per pound of body weight (measured: 44 g at the owner's weight). The
        /// per-pound form is inferred; only one weight was sampled.
        static let fatFloorGPerLb = 0.225
        static let kcalPerGProtein = 4.0, kcalPerGFat = 9.0, kcalPerGCarb = 4.0

        /// The unrounded daily calorie budget a goal asks for at the current expenditure and weight.
        static func dailyBudget(expenditure: Double, goal: Goal, weightKg: Double) -> Double {
            let weeklyLb = goal.ratePercentPerWeek / 100 * weightKg / kgPerLb
            let delta = weeklyLb * kcalPerLbPerWeek / 7
            return switch goal.kind {
            case .lose: expenditure - delta
            case .maintain: expenditure
            case .gain: expenditure + delta
            }
        }

        /// The wizard's "initial daily budget", rounded to 25 kcal (the wizard showed 1725 at 0.5% a week).
        static func initialDailyBudget(expenditure: Double, goal: Goal, weightKg: Double) -> Int {
            Int((dailyBudget(expenditure: expenditure, goal: goal, weightKg: weightKg) / 25).rounded() * 25)
        }

        /// Days until the trend reaches the target at the goal's rate, if it compounds on the falling weight.
        /// Inferred: MacroFactor's "Original ETA" did not match this or a linear rate on the owner's goals.
        static func estimatedDays(goal: Goal, weightKg: Double) -> Int? {
            guard let target = goal.targetWeightKg, goal.kind != .maintain, goal.ratePercentPerWeek > 0 else { return nil }
            let ratio = target / weightKg
            guard (goal.kind == .lose && ratio < 1) || (goal.kind == .gain && ratio > 1) else { return 0 }
            let weeklyFactor = 1 + (goal.kind == .lose ? -1 : 1) * goal.ratePercentPerWeek / 100
            return Int((log(ratio) / log(weeklyFactor) * 7).rounded(.up))
        }

        /// A coached week: calories from the goal, shifted onto high days, then macros per day.
        static func weekly(program: CoachedProgram, goal: Goal, expenditure: Double, weightKg: Double) -> WeeklyPlan {
            let floor = Double(program.floor.kcal)
            let average = max(dailyBudget(expenditure: expenditure, goal: goal, weightKg: weightKg), floor)
            let highCount = Double(program.highDays.count)
            let normal = average * 7 / (7 - highCount + highDayShift * highCount)
            let high = normal * highDayShift
            let weightLb = weightKg / kgPerLb
            let protein = (program.protein.gramsPerLb * weightLb).rounded(.down)
            let fatFloor = (fatFloorGPerLb * weightLb).rounded()
            let lowest = program.highDays.count == 7 ? high : normal
            let macroDiet = fits(diet: program.diet, kcal: lowest.rounded(), proteinG: protein, fatFloorG: fatFloor) ? program.diet : .keto
            var days: [Weekday: DayTarget] = [:]
            for day in Weekday.allCases {
                let kcal = (program.highDays.contains(day) ? high : normal).rounded()
                days[day] = macros(kcal: Int(kcal), proteinG: protein, diet: macroDiet, fatFloorG: fatFloor)
            }
            return WeeklyPlan(days: days, diet: macroDiet, proteinReduced: days.values.contains { Double($0.proteinG) < protein })
        }

        /// Shares of the calories left after protein. They sum below 1 because MacroFactor's own days do: its
        /// measured macros add up about 1% under the day's calories (1421 kcal: 151 P, 46 F, 99 C). Balanced and keto
        /// are measured; low fat and low carb are inferred from the help's "about 30%" cap.
        static func split(_ diet: DietStyle) -> (fat: Double, carbs: Double) {
            switch diet {
            case .balanced: (0.505, 0.483)
            case .lowFat: (0.30, 0.688)
            case .lowCarb: (0.688, 0.30)
            case .keto: (0.698, 0.29)
            }
        }

        static func fits(diet: DietStyle, kcal: Double, proteinG: Double, fatFloorG: Double) -> Bool {
            let remaining = kcal - proteinG * kcalPerGProtein
            return remaining * split(diet).fat / kcalPerGFat >= fatFloorG
        }

        /// Protein first, then fat and carbs by the diet's shares of what is left. When that fat falls under the floor,
        /// fat takes the floor and carbs what remains; when even protein and the fat floor exceed the day, protein gives
        /// way, as MacroFactor says it does ("we had to reduce your protein target below your requested setting").
        static func macros(kcal: Int, proteinG: Double, diet: DietStyle, fatFloorG: Double) -> DayTarget {
            let total = Double(kcal)
            var protein = proteinG
            if protein * kcalPerGProtein + fatFloorG * kcalPerGFat > total {
                protein = max(0, ((total - fatFloorG * kcalPerGFat) / kcalPerGProtein).rounded(.down))
            }
            let remaining = max(0, total - protein * kcalPerGProtein)
            let shares = split(diet)
            var fat = (remaining * shares.fat / kcalPerGFat).rounded()
            var carbs = (remaining * shares.carbs / kcalPerGCarb).rounded()
            if fat < fatFloorG {
                fat = min(fatFloorG, (remaining / kcalPerGFat).rounded(.down))
                carbs = max(0, ((remaining - fat * kcalPerGFat) / kcalPerGCarb).rounded(.down))
            }
            if diet == .lowCarb, carbs > 200 {
                carbs = 200
                fat = ((remaining - carbs * kcalPerGCarb) / kcalPerGFat).rounded()
            }
            return DayTarget(kcal: kcal, proteinG: Int(protein), fatG: Int(fat), carbsG: Int(carbs))
        }

        /// Collaborative editing: moving one day's calories spreads the opposite change over the unlocked days, so the
        /// week's total stays fixed (measured: +538 on one day took 108 off each of five unlocked days). A remainder
        /// that does not divide goes one calorie at a time to the earliest unlocked days.
        static func rebalance(_ kcal: [Weekday: Int], changing day: Weekday, to newKcal: Int, locked: Set<Weekday>) -> [Weekday: Int] {
            var result = kcal
            let delta = newKcal - kcal[day, default: 0]
            let others = Weekday.mondayFirst.filter { $0 != day && !locked.contains($0) }
            result[day] = newKcal
            guard !others.isEmpty else { return result }
            let (share, remainder) = abs(delta).quotientAndRemainder(dividingBy: others.count)
            for (index, other) in others.enumerated() {
                result[other, default: 0] -= delta.signum() * (share + (index < remainder ? 1 : 0))
            }
            return result
        }
    }
}
