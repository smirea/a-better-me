import Foundation

/// The New Goal, Edit Goal, New Program, and Edit Program forms as one value: the answers so far, the sections they
/// show, and the plan they save. A new goal always continues into the program sections, as MacroFactor's does.
struct StrategyWizardModel {
    enum Mode: Hashable {
        case newGoal, editGoal, newProgram, editProgram
    }

    enum Step: Hashable {
        case maintenance
        case goalType, goalWeightRate, goalSummary
        case style, diet, floor, training, distribution, highDays, protein, coachedResult
        case collaborative
        case manualMode, manualTargets
    }

    struct DesignNote: Hashable {
        var title: String
        var value: String?
        var text: String
    }

    let mode: Mode
    let current: NutritionPlan?
    let today: CalendarDay
    let weightKg: Double
    /// The estimate the maintenance section explains; nil with a static expenditure or without data and a profile.
    let maintenance: NutritionEngine.Maintenance.Estimate?
    let estimatedKcal: Double?
    /// The owner's maintenance in place of the estimate; the targets derive from it.
    private(set) var maintenanceOverride: Double?
    private var standardFloorKcal: Int

    var goal: GoalDraft
    var coaching: CoachingProgram
    var shiftCalories: Bool
    var manualSameAllWeek: Bool
    var manual: WeekTargets
    var collaborative: CollaborativeWeek

    init(
        mode: Mode, current: NutritionPlan?, today: CalendarDay, weightKg: Double, expenditureKcal: Double?, standardFloorKcal: Int,
        maintenance: NutritionEngine.Maintenance.Estimate? = nil
    ) {
        self.mode = current == nil ? .newGoal : mode
        self.current = current
        self.today = today
        self.weightKg = weightKg
        self.maintenance = maintenance
        estimatedKcal = expenditureKcal
        self.standardFloorKcal = standardFloorKcal
        goal = current.map { GoalDraft($0.goal, currentWeightKg: weightKg) } ?? GoalDraft(kind: .lose, currentWeightKg: weightKg)
        coaching = current?.coaching ?? CoachingProgram()
        if expenditureKcal == nil, current == nil { coaching.style = .manual }
        shiftCalories = !(current?.coaching.highDays.isEmpty ?? true)
        let targets = current?.targets ?? WeekTargets(every: DayTarget(energy: 2000, protein: 150, fat: 65, carbs: 210))
        manual = targets
        manualSameAllWeek = Set(targets.days).count == 1
        collaborative = CollaborativeWeek(targets)
        seedCollaborative()
    }

    var title: String {
        switch mode {
        case .newGoal: "New Goal"
        case .editGoal: "Edit Goal"
        case .newProgram: "New Program"
        case .editProgram: "Edit Program"
        }
    }

    /// Nil without a maintenance estimate or override, which leaves only the manual program.
    var basis: StrategyBasis? {
        (maintenanceOverride ?? estimatedKcal).map { StrategyBasis(weightKg: weightKg, expenditureKcal: $0, standardFloorKcal: standardFloorKcal) }
    }

    var steps: [Step] {
        switch mode {
        case .newGoal: [.goalType, .maintenance, .goalWeightRate, .goalSummary, .style] + styleSteps
        case .editGoal: [.maintenance, .goalWeightRate, .goalSummary]
        case .newProgram: [.maintenance, .style] + styleSteps
        case .editProgram: (coaching.style == .manual ? [] : [.maintenance]) + styleSteps
        }
    }

    private var styleSteps: [Step] {
        switch coaching.style {
        case .coached: [.diet, .floor, .training, .distribution] + (shiftCalories ? [.highDays] : []) + [.protein, .coachedResult]
        case .collaborative: [.collaborative]
        case .manual: [.manualMode, .manualTargets]
        }
    }

    func next(after step: Step) -> Step? {
        guard let index = steps.firstIndex(of: step), index + 1 < steps.count else { return nil }
        return steps[index + 1]
    }

    /// The group header over a section's group: "1 Set new goal · 2 Set new program".
    func phase(of step: Step) -> String {
        switch step {
        case .goalType, .goalWeightRate, .goalSummary: mode == .editGoal ? "Edit goal" : "1 Set new goal"
        case .maintenance where mode == .newGoal || mode == .editGoal: mode == .editGoal ? "Edit goal" : "1 Set new goal"
        default: mode == .newGoal ? "2 Set new program" : "Program preferences"
        }
    }

    func canChoose(_ style: CoachingProgram.Style) -> Bool { style == .manual || basis != nil }

    func isAnswered(_ step: Step) -> Bool {
        switch step {
        case .goalWeightRate: goal.problem(currentWeightKg: weightKg) == nil
        case .highDays: !coaching.highDays.isEmpty && coaching.highDays.count < 7
        case .style: canChoose(coaching.style)
        default: true
        }
    }

    var canSave: Bool { steps.allSatisfy(isAnswered) }

    mutating func choose(_ style: CoachingProgram.Style) {
        coaching.style = style
        seedCollaborative()
    }

    /// The editor sits below the goal, so a goal change re-seeds the collaborative week at the new budget.
    mutating func goalChanged() {
        guard mode == .newGoal else { return }
        seedCollaborative()
    }

    /// The collaborative editor of a new goal or program starts from an even coached week, as MacroFactor's editor does,
    /// or from the current collaborative week moved to the new goal's budget. Edit Program never seeds, so its week
    /// stays as it was.
    private mutating func seedCollaborative() {
        guard mode == .newGoal || mode == .newProgram, coaching.style == .collaborative, let basis else { return }
        var even = CoachingProgram()
        even.style = .collaborative
        let week = StrategyRules.coachedWeek(even, goal: savedGoal, basis: basis)
        if let current, current.coaching.style == .collaborative {
            collaborative = CollaborativeWeek(current.targets)
            collaborative.rescale(toAverage: week.averageKcal)
        } else {
            collaborative = CollaborativeWeek(StrategyRules.weekTargets(week))
        }
    }

    /// The floor step edits the Standard Floor in place; the view saves it to the settings too.
    mutating func setStandardFloor(_ kcal: Int) {
        standardFloorKcal = kcal
    }

    /// A collaborative week is seeded at the budget, so it follows the maintenance it is computed from.
    mutating func setMaintenanceOverride(_ kcal: Double?) {
        maintenanceOverride = kcal
        seedCollaborative()
    }

    mutating func toggleHighDay(_ weekday: Int) {
        if let index = coaching.highDays.firstIndex(of: weekday) {
            coaching.highDays.remove(at: index)
        } else {
            coaching.highDays = (coaching.highDays + [weekday]).sorted()
        }
    }

    /// The goal the saved plan carries. Editing keeps the goal's start, so its history stays one goal.
    var savedGoal: NutritionGoal {
        switch mode {
        case .newGoal: goal.goal(startingOn: today)
        case .editGoal: goal.goal(startingOn: current?.goal.startedOn ?? today)
        case .newProgram, .editProgram: current!.goal
        }
    }

    var savedCoaching: CoachingProgram {
        var saved = coaching
        if saved.style != .coached || !shiftCalories { saved.highDays = [] }
        return saved
    }

    var coachedWeek: NutritionEngine.WeeklyPlan? {
        basis.map { StrategyRules.coachedWeek(savedCoaching, goal: savedGoal, basis: $0) }
    }

    var savedTargets: WeekTargets {
        if mode == .editGoal, let current {
            return basis.map { StrategyRules.retarget(current, goal: savedGoal, basis: $0) } ?? current.targets
        }
        switch coaching.style {
        case .coached: return coachedWeek.map(StrategyRules.weekTargets) ?? manual
        case .collaborative: return collaborative.targets
        case .manual: return manualSameAllWeek ? WeekTargets(every: manual[1]) : manual
        }
    }

    /// What Save saves, from today.
    func plan(isFirst: Bool) -> NutritionPlan {
        StrategyRules.savedPlan(on: today, isFirst: isFirst, goal: savedGoal, coaching: savedCoaching, targets: savedTargets, basis: basis)
    }

    /// "How was your program designed?" on the coached result.
    func designNotes(unit: WeightUnit) -> [DesignNote] {
        guard let basis, let week = coachedWeek else { return [] }
        let saved = savedGoal
        let rate = abs(saved.ratePercentPerWeek).formatted(.number.precision(.fractionLength(0...2)))
        let average = week.averageKcal.wholeText
        let goalText = switch saved.kind {
        case .lose: "Your goal is to lose weight at a rate of \(rate)% of body weight per week"
        case .maintain: "Your goal is to maintain your weight"
        case .gain: "Your goal is to gain weight at a rate of \(rate)% of body weight per week"
        }
        let balance = StrategyRules.balanceText(maintenanceKcal: basis.expenditureKcal, averageKcal: week.averageKcal, unit: unit)
        var notes = [
            DesignNote(
                title: "Maintenance Calories", value: StrategyFormat.kcal(basis.expenditureKcal),
                text: "Your estimated expenditure, from your logged intake and weight trend, or from your BMR and activity until there is enough data."
            ),
            DesignNote(title: balance.title, value: balance.value, text: "\(goalText). \(balance.text)"),
            DesignNote(title: "Average Target", value: "\(average) kcal", text: "So your daily average Calorie goal should be around \(average) kcal."),
        ]
        if !savedCoaching.highDays.isEmpty {
            notes.append(DesignNote(
                title: "Calorie Shift", value: nil,
                text: "You opted to shift your Calorie targets, so we increased your targets for the days you specified while maintaining your daily average Calorie goal."
            ))
        }
        let perLb = StrategyRules.engineProgram(savedCoaching, standardFloorKcal: basis.standardFloorKcal).protein.gramsPerLb
        notes.append(DesignNote(
            title: "Target Protein", value: "\(perLb.formatted()) g/lb",
            text: week.proteinReduced
                ? "In order to meet your calorie target, we had to reduce your protein target below your requested setting."
                : "Consuming \(perLb.formatted()) g/lb of body weight of protein is a good daily average for your preference and training."
        ))
        notes.append(DesignNote(
            title: "Diet Type", value: Self.dietName(week.diet),
            text: week.diet != savedCoaching.engineDiet
                ? "To meet your calorie target while also meeting protein and fat minimums, we had to switch you over to a ketogenic program. If you'd like a higher-carb program, please reduce your goal rate."
                : "Finally, we distributed your remaining Calorie budget between carbs and fat in accordance with the \(Self.dietName(week.diet)) Diet."
        ))
        return notes
    }

    static func dietName(_ diet: NutritionEngine.DietStyle) -> String {
        switch diet {
        case .balanced: "Balanced"
        case .lowFat: "Low-fat"
        case .lowCarb: "Low-carb"
        case .keto: "Keto"
        }
    }
}

private extension CoachingProgram {
    var engineDiet: NutritionEngine.DietStyle { StrategyRules.engineProgram(self, standardFloorKcal: 0).diet }
}
