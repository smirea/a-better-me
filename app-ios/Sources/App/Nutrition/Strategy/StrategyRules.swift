import Foundation

/// What a coached or collaborative plan is computed from: the trend weight and expenditure today, and the owner's
/// Standard Floor.
struct StrategyBasis: Hashable {
    var weightKg: Double
    var expenditureKcal: Double
    var standardFloorKcal: Int

    var weightLb: Double { weightKg / NutritionEngine.kgPerLb }
}

/// Translation between the synced plan records and the engine's types, and the plans Strategy writes.
enum StrategyRules {
    typealias Engine = NutritionEngine

    // MARK: Records to engine

    /// The engine's rate is always positive; the record's is negative while losing.
    static func engineGoal(_ goal: NutritionGoal) -> Engine.Goal {
        let kind: Engine.GoalKind = switch goal.kind {
        case .lose: .lose
        case .maintain: .maintain
        case .gain: .gain
        }
        return Engine.Goal(kind: kind, ratePercentPerWeek: abs(goal.ratePercentPerWeek), targetWeightKg: goal.targetWeightKg)
    }

    static func engineProgram(_ coaching: CoachingProgram, standardFloorKcal: Int) -> Engine.CoachedProgram {
        let diet: Engine.DietStyle = switch coaching.diet {
        case .balanced: .balanced
        case .lowFat: .lowFat
        case .lowCarb: .lowCarb
        case .keto: .keto
        }
        let protein: Engine.ProteinLevel = switch coaching.protein {
        case .low: .low
        case .moderate: .moderate
        case .high: .high
        case .extraHigh: .extraHigh
        }
        let floor: Engine.CalorieFloor = switch coaching.floor {
        case .standard: .standard(kcal: standardFloorKcal)
        case .low: .low(standardKcal: standardFloorKcal)
        case .ignored: .ignored
        }
        return Engine.CoachedProgram(diet: diet, protein: protein, floor: floor, highDays: Set(coaching.highDays.map(weekday(iso:))))
    }

    static func weekday(iso: Int) -> Engine.Weekday { Engine.Weekday.mondayFirst[iso - 1] }

    static func weekTargets(_ plan: Engine.WeeklyPlan) -> WeekTargets {
        WeekTargets(Engine.Weekday.mondayFirst.map { day in
            let target = plan.days[day]!
            return DayTarget(energy: Double(target.kcal), protein: Double(target.proteinG), fat: Double(target.fatG), carbs: Double(target.carbsG))
        })
    }

    static func averageEnergy(_ targets: WeekTargets) -> Double {
        targets.days.map(\.energy).reduce(0, +) / 7
    }

    // MARK: Plans

    static func coachedWeek(_ coaching: CoachingProgram, goal: NutritionGoal, basis: StrategyBasis) -> Engine.WeeklyPlan {
        Engine.Targets.weekly(
            program: engineProgram(coaching, standardFloorKcal: basis.standardFloorKcal), goal: engineGoal(goal),
            expenditure: basis.expenditureKcal, weightKg: basis.weightKg
        )
    }

    /// The targets a goal change leaves: a coached program is rebuilt, a collaborative one keeps its split and moves to
    /// the new budget, and a manual one keeps the owner's numbers.
    static func retarget(_ plan: NutritionPlan, goal: NutritionGoal, basis: StrategyBasis) -> WeekTargets {
        switch plan.coaching.style {
        case .coached:
            return weekTargets(coachedWeek(plan.coaching, goal: goal, basis: basis))
        case .collaborative:
            var week = CollaborativeWeek(plan.targets)
            week.rescale(toAverage: coachedWeek(plan.coaching, goal: goal, basis: basis).averageKcal)
            return week.targets
        case .manual:
            return plan.targets
        }
    }

    /// A plan saved from the wizards: `setup` when it is the first, otherwise `edit`.
    static func savedPlan(
        on day: CalendarDay, isFirst: Bool, goal: NutritionGoal, coaching: CoachingProgram, targets: WeekTargets, basis: StrategyBasis?
    ) -> NutritionPlan {
        freeze(NutritionPlan(from: day, kind: isFirst ? .setup : .edit, goal: goal, coaching: coaching, targets: targets), basis)
    }

    /// A coached or collaborative plan keeps the expenditure and trend weight its targets came from, as a check-in does,
    /// so the program card states the maintenance the deficit was taken from even after the estimate moves. A manual
    /// plan's targets come from no estimate.
    private static func freeze(_ plan: NutritionPlan, _ basis: StrategyBasis?) -> NutritionPlan {
        guard plan.coaching.style != .manual, let basis else { return plan }
        var plan = plan
        plan.expenditureKcal = basis.expenditureKcal
        plan.trendWeightKg = basis.weightKg
        return plan
    }

    /// The maintenance a plan's targets are measured against: the expenditure a coached or collaborative plan froze,
    /// else today's estimate.
    static func maintenance(_ plan: NutritionPlan, expenditureKcal: Double?) -> Double? {
        plan.coaching.style == .manual ? expenditureKcal : plan.expenditureKcal ?? expenditureKcal
    }

    struct BalanceText: Hashable {
        var title: String
        var value: String
        var text: String
    }

    /// The daily deficit or surplus of an average target against maintenance, and the weekly change it implies at the
    /// engine's energy density. Within 10 kcal reads as maintenance.
    static func balanceText(maintenanceKcal: Double, averageKcal: Double, unit: WeightUnit) -> BalanceText {
        let difference = averageKcal - maintenanceKcal
        let weeklyKg = difference * 7 / NutritionEngine.kcalPerLb * NutritionEngine.kgPerLb
        let weekly = abs(unit.fromKg(weeklyKg)).formatted(.number.precision(.fractionLength(0...2)))
        let density = "\(Int((unit.toKg(1) / NutritionEngine.kgPerLb * NutritionEngine.kcalPerLb).rounded()).formatted()) kcal per \(unit.rawValue)"
        guard abs(difference) >= 10 else {
            return BalanceText(title: "At Maintenance", value: "0 kcal", text: "Eating at maintenance holds your weight.")
        }
        let amount = StrategyFormat.kcal(abs(difference))
        return difference < 0
            ? BalanceText(title: "Daily Deficit", value: "−\(amount)", text: "\(amount) a day under maintenance loses about \(weekly) \(unit.rawValue) a week at \(density).")
            : BalanceText(title: "Daily Surplus", value: "+\(amount)", text: "\(amount) a day over maintenance gains about \(weekly) \(unit.rawValue) a week at \(density).")
    }

    /// Reopen Previous Goal: the goal before the current one, from today, with the current program's targets for it.
    static func reopenedPlan(previous: NutritionGoal, current: NutritionPlan, basis: StrategyBasis?, today: CalendarDay) -> NutritionPlan {
        var goal = previous
        goal.startedOn = today
        let targets = basis.map { retarget(current, goal: goal, basis: $0) } ?? current.targets
        return freeze(NutritionPlan(from: today, kind: .edit, goal: goal, coaching: current.coaching, targets: targets), basis)
    }

    /// The first day of the current program: the earliest plan in the unbroken run of plans with the same coaching.
    static func programStart(_ plans: [NutritionPlan], current: NutritionPlan) -> CalendarDay {
        let earlier = plans.filter { $0.id <= current.id }.sorted { $0.id > $1.id }
        var start = current.id
        for plan in earlier {
            guard plan.coaching.style == current.coaching.style else { break }
            start = plan.id
        }
        return start
    }

    static func styleName(_ style: CoachingProgram.Style) -> String {
        switch style {
        case .coached: "Coached"
        case .collaborative: "Collaborative"
        case .manual: "Manual"
        }
    }

    static func goalName(_ kind: NutritionGoal.Kind) -> String {
        switch kind {
        case .lose: "Weight Loss"
        case .maintain: "Maintenance"
        case .gain: "Weight Gain"
        }
    }
}
