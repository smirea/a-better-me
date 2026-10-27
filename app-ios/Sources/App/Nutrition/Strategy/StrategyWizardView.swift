import SwiftUI

/// The New Goal, Edit Goal, New Program, and Edit Program wizards (MacroFactor's full-screen "Set New Goal" and "Set
/// New Program"): one question per step under a progress bar, then Done saves a plan from today.
struct StrategyWizardView: View {
    @State var model: StrategyWizardModel
    let isFirst: Bool

    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Observe(AppSettings.current) private var settings
    @State private var path: [StrategyWizardModel.Step] = []

    private var unit: WeightUnit { settings.weightUnit }

    var body: some View {
        NavigationStack(path: $path) {
            page(model.steps[0])
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Close", systemImage: "xmark") { dismiss() }
                    }
                }
                .navigationDestination(for: StrategyWizardModel.Step.self) { page($0) }
        }
        .tint(Theme.textPrimary)
    }

    private func page(_ step: StrategyWizardModel.Step) -> some View {
        let last = model.next(after: step) == nil
        return ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if let title = title(step) {
                    Text(title).font(AppFont.title(22)).padding(.bottom, 8)
                }
                content(step)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Theme.background)
        .safeAreaInset(edge: .top, spacing: 0) {
            VStack(alignment: .leading, spacing: 6) {
                Text(model.phase(of: step).uppercased()).font(AppFont.caption(11)).foregroundStyle(Theme.textSecondary)
                ProgressView(value: model.progress(at: step)).tint(Theme.textPrimary)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 8)
        }
        .safeAreaInset(edge: .bottom) {
            PinnedActionButton(last ? "Done" : "Next") { advance(from: step) }
                .disabled(!model.canAdvance(from: step))
                .padding(.top, 8)
        }
        .navigationTitle(model.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func advance(from step: StrategyWizardModel.Step) {
        model.leave(step)
        if let next = model.next(after: step) {
            path.append(next)
        } else {
            store.savePlan(model.plan(isFirst: isFirst))
            dismiss()
        }
    }

    private func title(_ step: StrategyWizardModel.Step) -> String? {
        switch step {
        case .goalType: "What is your goal?"
        case .goalWeightRate: nil
        case .goalSummary: "Goal summary"
        case .style: "Which program style would you like?"
        case .diet: "Which diet do you prefer?"
        case .floor: "Which Calorie floor should we use?"
        case .training: "What type of training do you do?"
        case .distribution: "How would you like to distribute your Calories?"
        case .highDays: "Which days would you like to have higher Calorie targets?"
        case .protein: "How much protein do you prefer?"
        case .coachedResult: "Your macro program is ready"
        case .collaborative: nil
        case .manualMode: "Do you want to follow the same targets all week?"
        case .manualTargets: "Set your targets for the week"
        }
    }

    @ViewBuilder
    private func content(_ step: StrategyWizardModel.Step) -> some View {
        switch step {
        case .goalType:
            option("Lose Weight", nil, model.goal.kind == .lose) { model.goal.change(kind: .lose, currentWeightKg: model.weightKg) }
            option("Maintain Weight", nil, model.goal.kind == .maintain) { model.goal.change(kind: .maintain, currentWeightKg: model.weightKg) }
            option("Gain Weight", nil, model.goal.kind == .gain) { model.goal.change(kind: .gain, currentWeightKg: model.weightKg) }
        case .goalWeightRate:
            GoalWeightRateStep(model: $model, unit: unit)
        case .goalSummary:
            goalSummary
        case .style:
            styleOption(.coached, "Coached", "We'll design your Calorie targets and macro program based on your goal and preferences.")
            styleOption(.collaborative, "Collaborative", "Set your own macro targets and we'll adjust your Calorie budget based on your goal and progress.")
            styleOption(.manual, "Manual", "Set your own macro and Calorie targets using manual entry.")
            if model.basis == nil {
                Text("Coached and collaborative programs need an expenditure estimate: add your height and birth date to your profile, or set an initial expenditure in Settings.")
                    .font(AppFont.caption())
                    .foregroundStyle(Theme.textSecondary)
            }
        case .diet:
            option("Balanced", "Standard distribution of carbs and fat", model.coaching.diet == .balanced) { model.coaching.diet = .balanced }
            option("Low-fat", "Fat will be reduced to prioritize carb and protein intake", model.coaching.diet == .lowFat) { model.coaching.diet = .lowFat }
            option("Low-carb", "Carbs will be reduced to prioritize fat and protein intake", model.coaching.diet == .lowCarb) { model.coaching.diet = .lowCarb }
            option("Keto", "Carbs will be very restricted to allow for higher fat intake", model.coaching.diet == .keto) { model.coaching.diet = .keto }
        case .floor:
            let standard = model.basis?.standardFloorKcal ?? settings.nutrition.standardFloorKcal
            option("Standard Floor", "Your Calorie targets will never go below \(standard) kcal", model.coaching.floor == .standard) { model.coaching.floor = .standard }
            option("Low Floor", "Proceed with caution: targets may go as low as \(NutritionEngine.CalorieFloor.low(standardKcal: standard).kcal) kcal", model.coaching.floor == .low) { model.coaching.floor = .low }
            Stepper(value: Binding(get: { standard }, set: { kcal in
                model.setStandardFloor(kcal)
                store.updateSettings { $0.nutrition.standardFloorKcal = kcal }
            }), in: 800...2500, step: 10) {
                LabeledContent("Your Standard Floor", value: "\(standard) kcal")
            }
            .padding(14)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
            Text("MacroFactor sets the Standard Floor for you; set yours here. The Low Floor is two thirds of it.")
                .font(AppFont.caption())
                .foregroundStyle(Theme.textSecondary)
        case .training:
            option("None or Relaxed Activity", nil, model.coaching.training == .none) { model.coaching.training = .none }
            option("Lifting", nil, model.coaching.training == .lifting) { model.coaching.training = .lifting }
            option("Cardio", nil, model.coaching.training == .cardio) { model.coaching.training = .cardio }
            option("Cardio & Lifting", nil, model.coaching.training == .cardioLifting) { model.coaching.training = .cardioLifting }
        case .distribution:
            option("Distribute Evenly", "The same Calorie target every day", !model.shiftCalories) { model.shiftCalories = false }
            option("Shift Calorie Targets", "Higher targets on the days you choose, the same weekly total", model.shiftCalories) { model.shiftCalories = true }
        case .highDays:
            ForEach(1...7, id: \.self) { weekday in
                let selected = model.coaching.highDays.contains(weekday)
                WizardOption(title: StrategyFormat.weekdayNames[weekday - 1], subtitle: nil, selected: selected) { model.toggleHighDay(weekday) }
            }
        case .protein:
            ForEach([CoachingProgram.Protein.low, .moderate, .high, .extraHigh], id: \.self) { level in
                let perLb = StrategyRules.engineProgram(CoachingProgram(protein: level), standardFloorKcal: 0).protein.gramsPerLb
                option(proteinName(level), "\(perLb.formatted()) g per lb of body weight", model.coaching.protein == level) { model.coaching.protein = level }
            }
        case .coachedResult:
            coachedResult
        case .collaborative:
            CollaborativeEditorView(week: $model.collaborative, weightLb: model.weightKg / NutritionEngine.kgPerLb, expenditureKcal: model.basis?.expenditureKcal)
        case .manualMode:
            option("Same targets all week", nil, model.manualSameAllWeek) { model.manualSameAllWeek = true }
            option("Different targets per day", nil, !model.manualSameAllWeek) { model.manualSameAllWeek = false }
        case .manualTargets:
            ManualTargetsStep(targets: $model.manual, sameAllWeek: model.manualSameAllWeek)
        }
    }

    private func option(_ title: String, _ subtitle: String?, _ selected: Bool, action: @escaping () -> Void) -> some View {
        WizardOption(title: title, subtitle: subtitle, selected: selected, action: action)
    }

    private func styleOption(_ style: CoachingProgram.Style, _ title: String, _ subtitle: String) -> some View {
        option(title, subtitle, model.coaching.style == style) { model.choose(style) }
            .disabled(!model.canChoose(style))
    }

    private func proteinName(_ level: CoachingProgram.Protein) -> String {
        switch level {
        case .low: "Low"
        case .moderate: "Moderate"
        case .high: "High"
        case .extraHigh: "Extra High"
        }
    }

    private var goalSummary: some View {
        let goal = model.savedGoal
        let rate = abs(goal.ratePercentPerWeek).formatted(.number.precision(.fractionLength(0...2)))
        return VStack(alignment: .leading, spacing: 12) {
            StrategyCard(title: StrategyRules.goalName(goal.kind)) {
                Text("\(StrategyFormat.weight(model.weightKg, unit)) » \(StrategyFormat.weight(goal.targetWeightKg, unit))").font(AppFont.number())
            }
            if goal.kind != .maintain {
                StrategyCard(title: "Goal Rate") {
                    Text("We will adjust your calorie targets as needed to keep you on track to \(goal.kind == .lose ? "lose" : "gain") \(rate)% of your body weight per week. The exact number of \(unit == .lb ? "pounds" : "kilograms") you \(goal.kind == .lose ? "lose" : "gain") each week will \(goal.kind == .lose ? "decrease as your overall body weight decreases" : "increase as your overall body weight increases").")
                        .font(AppFont.body(15))
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            if let basis = model.basis {
                StrategyCard(title: "Initial Daily Budget") {
                    Text("\(model.goal.initialBudget(basis).formatted()) kcal").font(AppFont.number())
                }
            }
            if let end = model.goal.projectedEnd(from: model.today, currentWeightKg: model.weightKg) {
                StrategyCard(title: "Estimated End Date") {
                    Text(StrategyFormat.day(end, year: true)).font(AppFont.number())
                    Text("This is an optimistic estimate. Plan for the goal to take a few more weeks.")
                        .font(AppFont.caption())
                        .foregroundStyle(Theme.textSecondary)
                }
            }
        }
    }

    private var coachedResult: some View {
        VStack(alignment: .leading, spacing: 20) {
            WeekTargetsChart(targets: model.savedTargets)
            Text("How was your program designed?").font(AppFont.headline())
            ForEach(Array(model.designNotes.enumerated()), id: \.offset) { index, note in
                HStack(alignment: .top, spacing: 12) {
                    Text("\(index + 1)")
                        .font(AppFont.headline(14))
                        .foregroundStyle(Theme.background)
                        .frame(width: 26, height: 26)
                        .background(Theme.textPrimary, in: Circle())
                    VStack(alignment: .leading, spacing: 3) {
                        Text(note.title).font(AppFont.headline(15))
                        if let value = note.value {
                            Text(value).font(AppFont.medium(15)).foregroundStyle(Theme.goal)
                        }
                        Text(note.text).font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
                    }
                }
            }
            Text("What's Next").font(AppFont.headline())
            Text("We'll monitor your Calorie intake and changes in body weight to refine your estimated energy expenditure, and use it at each weekly check-in to adjust your Calorie budget and macro targets to keep you on track with your goal.")
                .font(AppFont.caption())
                .foregroundStyle(Theme.textSecondary)
        }
    }
}

/// "What is your target weight?" and "What is your target goal rate?" under the initial budget and end date tiles.
private struct GoalWeightRateStep: View {
    @Binding var model: StrategyWizardModel
    let unit: WeightUnit

    private var targetBinding: Binding<Double> {
        Binding(
            get: { (unit.fromKg(model.goal.targetWeightKg) * 10).rounded() / 10 },
            set: { model.goal.targetWeightKg = unit.toKg(max(0, $0)) }
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(spacing: 10) {
                tile(model.basis.map { "\(model.goal.initialBudget($0).formatted()) kcal" } ?? "—", "initial daily budget", highlighted: true)
                tile(model.goal.projectedEnd(from: model.today, currentWeightKg: model.weightKg).map { StrategyFormat.day($0, year: true) } ?? "—", "projected end date", highlighted: false)
            }
            Text("What is your target weight?").font(AppFont.title(20))
            HStack {
                TextField("Target weight", value: targetBinding, format: .number.precision(.fractionLength(0...1)))
                    .keyboardType(.decimalPad)
                    .font(AppFont.number(28))
                    .fixedSize()
                    .accessibilityLabel("Target weight")
                Text(unit.rawValue).font(AppFont.medium()).foregroundStyle(Theme.textSecondary)
                Spacer()
                Stepper("Target weight", value: targetBinding, step: unit == .lb ? 1 : 0.5).labelsHidden()
            }
            .padding(14)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
            Text("Current trend weight: \(StrategyFormat.weight(model.weightKg, unit))").font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
            if let problem = model.goal.problem(currentWeightKg: model.weightKg) {
                Text(problem).font(AppFont.caption()).foregroundStyle(Theme.destructive)
            }
            if model.goal.kind != .maintain {
                rate
            }
        }
    }

    private var rate: some View {
        let weekly = abs(model.goal.weeklyChangeKg(at: model.weightKg))
        let sign = model.goal.kind == .lose ? "−" : "+"
        return VStack(alignment: .leading, spacing: 14) {
            Text("What is your target goal rate?").font(AppFont.title(20))
            Text(model.goal.band.label)
                .font(AppFont.headline(13))
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(model.goal.band == .faster ? Theme.amber.opacity(0.25) : Theme.goal.opacity(0.25), in: Capsule())
                .frame(maxWidth: .infinity)
            Slider(value: Binding(get: { model.goal.ratePercent }, set: { model.goal.ratePercent = ($0 * 100).rounded() / 100 }), in: GoalDraft.rateRange(model.goal.kind)) {
                Text("Goal rate")
            }
            .tint(model.goal.band == .faster ? Theme.amber : Theme.goal)
            .accessibilityValue("\(model.goal.ratePercent.formatted(.number.precision(.fractionLength(2)))) percent per week")
            Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 8) {
                GridRow {
                    Text("\(sign)\(unit.fromKg(weekly).formatted(.number.precision(.fractionLength(0...2)))) \(unit.rawValue)")
                    Text("\(model.goal.ratePercent.formatted(.number.precision(.fractionLength(0...2)))) % BW")
                    Text("Per Week").foregroundStyle(Theme.textSecondary)
                }
                GridRow {
                    Text("\(sign)\(unit.fromKg(weekly * 4).formatted(.number.precision(.fractionLength(0...1)))) \(unit.rawValue)")
                    Text("\((model.goal.ratePercent * 4).formatted(.number.precision(.fractionLength(0...2)))) % BW")
                    Text("Per Month").foregroundStyle(Theme.textSecondary)
                }
            }
            .font(AppFont.medium(15))
            .monospacedDigit()
        }
    }

    private func tile(_ value: String, _ caption: String, highlighted: Bool) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value).font(AppFont.headline())
            Text(caption).font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(highlighted ? Theme.goal.opacity(0.18) : Theme.surface, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
        .accessibilityElement(children: .combine)
    }
}

/// Manual targets: Energy, Protein, Fat, and Carbs for the week or for each day. Nothing checks that the macros add up
/// to the energy, as in MacroFactor.
private struct ManualTargetsStep: View {
    @Binding var targets: WeekTargets
    let sameAllWeek: Bool
    @State private var weekday = 1

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if !sameAllWeek {
                Picker("Day", selection: $weekday) {
                    ForEach(1...7, id: \.self) { Text(StrategyFormat.weekdayLetters[$0 - 1]).tag($0) }
                }
                .pickerStyle(.segmented)
                Text(StrategyFormat.weekdayNames[weekday - 1]).font(AppFont.headline())
            }
            let day = sameAllWeek ? 1 : weekday
            field("Energy", "kcal", \.energy, day)
            field("Protein", "g", \.protein, day)
            field("Fat", "g", \.fat, day)
            field("Carbs", "g", \.carbs, day)
        }
    }

    private func field(_ title: String, _ unit: String, _ path: WritableKeyPath<DayTarget, Double>, _ day: Int) -> some View {
        HStack {
            Text(title).font(AppFont.medium())
            Spacer()
            TextField(title, value: Binding(get: { targets[day][keyPath: path] }, set: { targets[day][keyPath: path] = max(0, $0.rounded()) }), format: .number)
                .keyboardType(.numberPad)
                .multilineTextAlignment(.trailing)
                .font(AppFont.number(18))
                .accessibilityLabel("\(title) target")
            Text(unit).font(AppFont.caption()).foregroundStyle(Theme.textSecondary).frame(width: 30, alignment: .leading)
        }
        .padding(14)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
    }
}
