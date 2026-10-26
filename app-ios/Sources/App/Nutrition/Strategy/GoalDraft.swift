import Foundation

/// The New Goal and Edit Goal wizard's answers: the direction, the target weight, and the rate in percent of body
/// weight per week, always positive here.
struct GoalDraft: Hashable {
    enum RateBand: Hashable {
        case slower, standard, faster

        var label: String {
            switch self {
            case .slower: "Slower"
            case .standard: "Standard (Recommended)"
            case .faster: "Faster (Use Caution)"
            }
        }
    }

    var kind: NutritionGoal.Kind
    var targetWeightKg: Double
    var ratePercent: Double

    /// The slider's ends and its recommended zone. Inferred from the samples in the research spec (0.11% was the
    /// slowest loss, 0.27% read "Slower", 0.5% "Standard", 1.39% "Faster"); gains were not walked through, so their
    /// zone is half the loss zone.
    static func rateRange(_ kind: NutritionGoal.Kind) -> ClosedRange<Double> {
        kind == .gain ? 0.05...1.0 : 0.1...1.5
    }

    static func standardRange(_ kind: NutritionGoal.Kind) -> ClosedRange<Double> {
        kind == .gain ? 0.15...0.5 : 0.35...1.0
    }

    static func defaultRate(_ kind: NutritionGoal.Kind) -> Double {
        switch kind {
        case .lose: 0.5
        case .maintain: 0
        case .gain: 0.25
        }
    }

    /// The ruler starts at the current weight.
    init(kind: NutritionGoal.Kind, currentWeightKg: Double) {
        self.kind = kind
        targetWeightKg = currentWeightKg
        ratePercent = Self.defaultRate(kind)
    }

    init(_ goal: NutritionGoal, currentWeightKg: Double) {
        kind = goal.kind
        targetWeightKg = goal.targetWeightKg ?? currentWeightKg
        ratePercent = goal.kind == .maintain ? 0 : abs(goal.ratePercentPerWeek)
    }

    mutating func change(kind: NutritionGoal.Kind, currentWeightKg: Double) {
        guard kind != self.kind else { return }
        self = GoalDraft(kind: kind, currentWeightKg: currentWeightKg)
    }

    func goal(startingOn day: CalendarDay) -> NutritionGoal {
        let rate = switch kind {
        case .lose: -ratePercent
        case .maintain: 0.0
        case .gain: ratePercent
        }
        return NutritionGoal(kind: kind, targetWeightKg: targetWeightKg, ratePercentPerWeek: rate, startedOn: day)
    }

    var band: RateBand {
        let standard = Self.standardRange(kind)
        if ratePercent < standard.lowerBound { return .slower }
        return ratePercent > standard.upperBound ? .faster : .standard
    }

    /// Weight change per week at `weightKg`, signed: negative while losing.
    func weeklyChangeKg(at weightKg: Double) -> Double {
        switch kind {
        case .lose: -ratePercent / 100 * weightKg
        case .maintain: 0
        case .gain: ratePercent / 100 * weightKg
        }
    }

    /// Why the wizard cannot continue, or nil.
    func problem(currentWeightKg: Double) -> String? {
        switch kind {
        case .lose where targetWeightKg >= currentWeightKg: "A weight loss goal needs a target below your current weight."
        case .gain where targetWeightKg <= currentWeightKg: "A weight gain goal needs a target above your current weight."
        default: nil
        }
    }

    /// The wizard's "initial daily budget" tile.
    func initialBudget(_ basis: StrategyBasis) -> Int {
        NutritionEngine.Targets.initialDailyBudget(
            expenditure: basis.expenditureKcal, goal: StrategyRules.engineGoal(goal(startingOn: CalendarDay.today)), weightKg: basis.weightKg
        )
    }

    /// The wizard's "projected end date": the day the trend reaches the target at this rate, nil while maintaining.
    func projectedEnd(from today: CalendarDay, currentWeightKg: Double) -> CalendarDay? {
        NutritionEngine.Targets.estimatedDays(goal: StrategyRules.engineGoal(goal(startingOn: today)), weightKg: currentWeightKg)
            .map { today.adding(days: $0) }
    }
}
