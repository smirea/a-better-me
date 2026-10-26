import Foundation

/// The weekly check-in. It is due once the check-in weekday arrives after the current plan began; completing it writes a
/// `check_in` plan from today with the expenditure and trend weight it used. A manual program never changes its targets,
/// so it shows the week's data without a check-in, as MacroFactor opts manual programs out of weekly updates.
enum CheckInRules {
    struct WeekSummary: Hashable {
        /// The seven days before today.
        var first: CalendarDay
        var last: CalendarDay
        var averageIntakeKcal: Double?
        var loggedDays: Int
        var weighIns: Int
        var trendChangeKg: Double?
        var expenditureChangeKcal: Double?
    }

    /// The latest day on or before `today` that falls on the ISO `weekday`.
    static func lastCheckInDay(today: CalendarDay, weekday: Int) -> CalendarDay {
        today.adding(days: -((today.weekday - weekday + 7) % 7))
    }

    static func nextCheckInDay(today: CalendarDay, weekday: Int) -> CalendarDay {
        lastCheckInDay(today: today, weekday: weekday).adding(days: 7)
    }

    static func isDue(_ current: NutritionPlan?, today: CalendarDay, weekday: Int) -> Bool {
        guard let current, current.coaching.style != .manual else { return false }
        return current.id < lastCheckInDay(today: today, weekday: weekday)
    }

    static func summary(_ inputs: StrategyInputs) -> WeekSummary {
        let days = (1...7).map { inputs.today.adding(days: -$0) }
        let intake = days.compactMap { inputs.intake[$0] }
        let last = days[0], first = days[6], before = first.adding(days: -1)
        return WeekSummary(
            first: first, last: last,
            averageIntakeKcal: intake.isEmpty ? nil : intake.reduce(0, +) / Double(intake.count),
            loggedDays: intake.count,
            weighIns: days.count { inputs.weighInDays.contains($0) },
            trendChangeKg: inputs.trend[last].flatMap { end in inputs.trend[before].map { end - $0 } },
            expenditureChangeKcal: inputs.expenditure[inputs.today].flatMap { now in inputs.expenditure[first].map { now.kcal - $0.kcal } }
        )
    }

    /// The new week from today, or nil for a manual program. A coached week is rebuilt by the engine; a collaborative
    /// week keeps the owner's split and moves to the engine's new budget.
    static func checkedIn(_ current: NutritionPlan, basis: StrategyBasis, today: CalendarDay) -> NutritionPlan? {
        guard current.coaching.style != .manual else { return nil }
        let week = NutritionEngine.CheckIn.plan(
            program: StrategyRules.engineProgram(current.coaching, standardFloorKcal: basis.standardFloorKcal),
            goal: StrategyRules.engineGoal(current.goal), expenditure: basis.expenditureKcal, trendWeightKg: basis.weightKg,
            previousAverageKcal: StrategyRules.averageEnergy(current.targets)
        )
        let targets: WeekTargets
        if current.coaching.style == .coached {
            targets = StrategyRules.weekTargets(week)
        } else {
            var collaborative = CollaborativeWeek(current.targets)
            collaborative.rescale(toAverage: week.averageKcal)
            targets = collaborative.targets
        }
        var plan = NutritionPlan(from: today, kind: .checkIn, goal: current.goal, coaching: current.coaching, targets: targets)
        plan.expenditureKcal = basis.expenditureKcal
        plan.trendWeightKg = basis.weightKg
        return plan
    }
}

/// One goal in Goal History: the run of plans that carry it. Editing a goal keeps its start day, so an edit stays in the
/// same goal; a new or reopened goal starts a new one.
struct GoalPeriod: Hashable, Identifiable {
    var goal: NutritionGoal
    var start: CalendarDay
    /// The day the next goal began; nil while in progress.
    var end: CalendarDay?
    var startWeightKg: Double?
    var endWeightKg: Double?

    var id: CalendarDay { start }

    /// Newest first.
    static func history(_ plans: [NutritionPlan], inputs: StrategyInputs) -> [GoalPeriod] {
        var periods: [GoalPeriod] = []
        for plan in plans.filter({ $0.id <= inputs.today }).sorted(by: { $0.id < $1.id }) {
            if let last = periods.last, last.goal.kind == plan.goal.kind, last.goal.startedOn == plan.goal.startedOn {
                periods[periods.count - 1].goal = plan.goal
                continue
            }
            if !periods.isEmpty { periods[periods.count - 1].end = plan.id }
            periods.append(GoalPeriod(goal: plan.goal, start: plan.id))
        }
        for index in periods.indices {
            periods[index].startWeightKg = inputs.trendWeight(on: periods[index].start)
            periods[index].endWeightKg = periods[index].end.map { inputs.trendWeight(on: $0) } ?? inputs.trendWeightKg
        }
        return periods.reversed()
    }

    /// The share of the way from the start weight to the target, 0 to 1; nil for maintenance or without weights.
    var progress: Double? {
        guard goal.kind != .maintain, let target = goal.targetWeightKg, let startWeightKg, let endWeightKg, target != startWeightKg else { return nil }
        return min(1, max(0, (endWeightKg - startWeightKg) / (target - startWeightKg)))
    }
}
