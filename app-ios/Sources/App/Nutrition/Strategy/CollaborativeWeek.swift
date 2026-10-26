import Foundation

/// The Collaborative editor's week. The owner sets a day's calories, protein grams, and the carbs' share of the calories
/// left after protein (MacroFactor's "Carb to Fat Ratio"); fat and carbs are derived only for days an edit touches, so
/// the days it leaves alone keep their exact targets. Locks are screen state and never saved (docs/decisions/nutrition.md).
struct CollaborativeWeek: Hashable {
    /// The protein slider's range, in grams per pound of body weight (measured: "between 0.0 and 1.85 g per lb").
    static let maxProteinPerLb = 1.85
    /// The calorie field's ceiling as a share of expenditure (measured: 2865 at 2210 kcal).
    static let maxKcalPerExpenditure = 1.3

    /// Monday first.
    private(set) var days: [DayTarget]
    var locked: Set<Int> = []

    init(_ targets: WeekTargets) {
        days = targets.days
    }

    /// ISO weekday, Monday 1.
    subscript(weekday: Int) -> DayTarget { days[weekday - 1] }

    var targets: WeekTargets { WeekTargets(days) }

    var weeklyKcal: Int { Int(days.map(\.energy).reduce(0, +)) }

    /// The carbs' share of the calories that fat and carbs hold; even when the day has neither.
    func carbShare(_ weekday: Int) -> Double {
        let day = self[weekday]
        let carbs = day.carbs * NutritionEngine.Targets.kcalPerGCarb
        let fat = day.fat * NutritionEngine.Targets.kcalPerGFat
        return carbs + fat > 0 ? carbs / (carbs + fat) : 0.5
    }

    static func split(kcal: Double, proteinG: Double, carbShare: Double) -> DayTarget {
        let remaining = max(0, kcal - proteinG * NutritionEngine.Targets.kcalPerGProtein)
        return DayTarget(
            energy: kcal, protein: proteinG,
            fat: (remaining * (1 - carbShare) / NutritionEngine.Targets.kcalPerGFat).rounded(),
            carbs: (remaining * carbShare / NutritionEngine.Targets.kcalPerGCarb).rounded()
        )
    }

    private mutating func set(_ weekday: Int, kcal: Double? = nil, proteinG: Double? = nil, carbShare: Double? = nil) {
        let day = self[weekday]
        days[weekday - 1] = Self.split(
            kcal: kcal ?? day.energy, proteinG: proteinG ?? day.protein, carbShare: carbShare ?? self.carbShare(weekday)
        )
    }

    /// Moves one day's calories and spreads the opposite change over the other unlocked days, so the week's budget holds.
    mutating func setCalories(_ kcal: Int, on weekday: Int) {
        let byDay = Dictionary(uniqueKeysWithValues: (1...7).map { (StrategyRules.weekday(iso: $0), Int(self[$0].energy)) })
        let moved = NutritionEngine.Targets.rebalance(
            byDay, changing: StrategyRules.weekday(iso: weekday), to: kcal, locked: Set(locked.map(StrategyRules.weekday(iso:)))
        )
        for iso in 1...7 where moved[StrategyRules.weekday(iso: iso)]! != Int(self[iso].energy) {
            set(iso, kcal: Double(max(0, moved[StrategyRules.weekday(iso: iso)]!)))
        }
    }

    mutating func setProtein(_ grams: Int, on weekday: Int) {
        set(weekday, proteinG: Double(max(0, grams)))
    }

    mutating func setCarbShare(_ share: Double, on weekday: Int) {
        set(weekday, carbShare: min(1, max(0, share)))
    }

    /// Reset All Days: every day takes the week's average calories and the selected day's protein and split.
    mutating func resetAll(like weekday: Int) {
        let protein = self[weekday].protein, share = carbShare(weekday)
        let (average, remainder) = weeklyKcal.quotientAndRemainder(dividingBy: 7)
        days = (0..<7).map { Self.split(kcal: Double(average + ($0 < remainder ? 1 : 0)), proteinG: protein, carbShare: share) }
        locked = []
    }

    /// A new weekly budget (a check-in or a goal change): each day keeps its share of the week, its protein, and its split.
    mutating func rescale(toAverage average: Double) {
        let total = Double(weeklyKcal)
        guard total > 0 else { return }
        let factor = average * 7 / total
        for iso in 1...7 {
            set(iso, kcal: (self[iso].energy * factor).rounded())
        }
    }
}
