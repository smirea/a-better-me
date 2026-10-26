import Foundation

/// The New Goal, Edit Goal, New Program, and Edit Program wizards as one value: the answers so far, the steps they
/// lead through, and the plan they save. A new goal always continues into the program steps, as MacroFactor's does.
struct StrategyWizardModel {
    enum Mode: Hashable {
        case newGoal, editGoal, newProgram, editProgram
    }

    enum Step: Hashable {
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
    /// Nil without an expenditure estimate, which leaves only the manual program.
    let basis: StrategyBasis?

    var goal: GoalDraft
    var coaching: CoachingProgram
    var shiftCalories: Bool
    var manualSameAllWeek: Bool
    var manual: WeekTargets
    var collaborative: CollaborativeWeek

    init(mode: Mode, current: NutritionPlan?, today: CalendarDay, weightKg: Double, expenditureKcal: Double?, standardFloorKcal: Int) {
        self.mode = current == nil ? .newGoal : mode
        self.current = current
        self.today = today
        self.weightKg = weightKg
        basis = expenditureKcal.map { StrategyBasis(weightKg: weightKg, expenditureKcal: $0, standardFloorKcal: standardFloorKcal) }
        goal = current.map { GoalDraft($0.goal, currentWeightKg: weightKg) } ?? GoalDraft(kind: .lose, currentWeightKg: weightKg)
        coaching = current?.coaching ?? CoachingProgram()
        if basis == nil, current == nil { coaching.style = .manual }
        shiftCalories = !(current?.coaching.highDays.isEmpty ?? true)
        let targets = current?.targets ?? WeekTargets(every: DayTarget(energy: 2000, protein: 150, fat: 65, carbs: 210))
        manual = targets
        manualSameAllWeek = Set(targets.days).count == 1
        collaborative = CollaborativeWeek(targets)
    }

    var title: String {
        switch mode {
        case .newGoal: "New Goal"
        case .editGoal: "Edit Goal"
        case .newProgram: "New Program"
        case .editProgram: "Edit Program"
        }
    }

    var steps: [Step] {
        switch mode {
        case .newGoal: [.goalType, .goalWeightRate, .goalSummary, .style] + styleSteps
        case .editGoal: [.goalWeightRate, .goalSummary]
        case .newProgram: [.style] + styleSteps
        case .editProgram: styleSteps
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

    /// The progress bar's fill on `step`.
    func progress(at step: Step) -> Double {
        Double((steps.firstIndex(of: step) ?? 0) + 1) / Double(steps.count)
    }

    /// Which step-group header the progress bar shows: "1 Set new goal · 2 Set new program".
    func phase(of step: Step) -> String {
        switch step {
        case .goalType, .goalWeightRate, .goalSummary: mode == .editGoal ? "Edit goal" : "1 Set new goal"
        default: mode == .newGoal ? "2 Set new program" : "Set program preferences"
        }
    }

    func canChoose(_ style: CoachingProgram.Style) -> Bool { style == .manual || basis != nil }

    func canAdvance(from step: Step) -> Bool {
        switch step {
        case .goalWeightRate: goal.problem(currentWeightKg: weightKg) == nil
        case .highDays: !coaching.highDays.isEmpty && coaching.highDays.count < 7
        case .style: canChoose(coaching.style)
        default: true
        }
    }

    mutating func choose(_ style: CoachingProgram.Style) {
        coaching.style = style
    }

    /// Leaving the style step seeds the collaborative editor for the goal being saved: an even coached week, as
    /// MacroFactor's editor starts, or the current collaborative week moved to the new goal's budget. Editing the
    /// current program never passes here, so its week stays as it was.
    mutating func leave(_ step: Step) {
        guard step == .style, coaching.style == .collaborative, let basis else { return }
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

    /// What Done saves, from today.
    func plan(isFirst: Bool) -> NutritionPlan {
        StrategyRules.savedPlan(on: today, isFirst: isFirst, goal: savedGoal, coaching: savedCoaching, targets: savedTargets)
    }

    /// "How was your program designed?" on the coached result.
    var designNotes: [DesignNote] {
        guard let basis, let week = coachedWeek else { return [] }
        let saved = savedGoal
        let rate = abs(saved.ratePercentPerWeek).formatted(.number.precision(.fractionLength(0...2)))
        let average = Int(week.averageKcal.rounded())
        let goalText = switch saved.kind {
        case .lose: "Your goal is to lose weight at a rate of \(rate)% of body weight per week"
        case .maintain: "Your goal is to maintain your weight"
        case .gain: "Your goal is to gain weight at a rate of \(rate)% of body weight per week"
        }
        var notes = [
            DesignNote(
                title: "Estimated Expenditure", value: "\(Int(basis.expenditureKcal.rounded())) kcal",
                text: "Your energy expenditure, from your logged intake and weight trend, or from your BMR and activity until there is enough data."
            ),
            DesignNote(title: "Average Target", value: "\(average) kcal", text: "\(goalText), so your daily average Calorie goal should be around \(average) kcal."),
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
