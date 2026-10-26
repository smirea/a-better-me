import Charts
import HealthKitUI
import SwiftUI

/// Everything Strategy's screens read, built once per change of the plans, weigh-ins, log, or settings.
struct StrategyData {
    var plans: [NutritionPlan]
    var settings: AppSettings
    var inputs: StrategyInputs

    var today: CalendarDay { inputs.today }
    var unit: WeightUnit { settings.weightUnit }
    var current: NutritionPlan? { NutritionPlan.effective(on: today, in: plans) }
    var basis: StrategyBasis? { inputs.basis(standardFloorKcal: settings.nutrition.standardFloorKcal) }
    var checkInDue: Bool { CheckInRules.isDue(current, today: today, weekday: settings.nutrition.checkInWeekday) }

    func wizard(_ mode: StrategyWizardModel.Mode) -> StrategyWizardModel? {
        guard let weight = inputs.trendWeightKg ?? settings.profile.bodyWeightKg else { return nil }
        return StrategyWizardModel(
            mode: mode, current: current, today: today, weightKg: weight,
            expenditureKcal: inputs.expenditureKcal, standardFloorKcal: settings.nutrition.standardFloorKcal
        )
    }
}

struct StrategyDataReader<Content: View>: View {
    @ViewBuilder let content: (StrategyData) -> Content

    @Environment(HealthData.self) private var health
    @Observe(NutritionPlan.all) private var plans
    @Observe(BodyWeight.all) private var logged
    @Observe(IntakeLog.all) private var log
    @Observe(AppSettings.current) private var settings

    var body: some View {
        content(StrategyData(
            plans: plans,
            settings: settings,
            inputs: StrategyInputs.make(
                weighIns: WeighIns.merge(logged: logged, health: health.weights), log: log, settings: settings.nutrition,
                profile: settings.profile, today: .today, calendar: .current
            )
        ))
    }
}

enum StrategyRoute: Hashable {
    case planHistory, nutrientGoals, checkInSettings
    case nutrient(NutrientID)
}

/// Nutrition mode's Strategy tab (MacroFactor's Strategy rail item): the program and its week of targets, the goal and
/// its progress, the weekly check-in, and the goal and program history.
struct StrategyTab: View {
    @Environment(LocalStore.self) private var store
    @State private var health = HealthData()

    var body: some View {
        NavigationStack {
            StrategyDataReader { StrategyHome(data: $0) }
                .navigationDestination(for: StrategyRoute.self) { route in
                    switch route {
                    case .planHistory: PlanHistoryView()
                    case .nutrientGoals: NutrientGoalsListView()
                    case .checkInSettings: CheckInSettingsView()
                    case let .nutrient(id): NutrientGoalsView(nutrient: id)
                    }
                }
        }
        .environment(health)
        .healthDataAccessRequest(store: health.store, shareTypes: HealthData.shareTypes, readTypes: HealthData.readTypes, trigger: health.requestTrigger) { _ in
            Task { await health.load() }
        }
        .task {
            #if DEBUG
            StrategySeed.seedIfRequested(store)
            #endif
            await health.refresh()
        }
    }
}

private struct WizardRequest: Identifiable {
    var model: StrategyWizardModel
    var isFirst: Bool
    var id: StrategyWizardModel.Mode { model.mode }
}

private struct StrategyHome: View {
    let data: StrategyData

    @Environment(LocalStore.self) private var store
    @State private var wizard: WizardRequest?
    @State private var checkingIn = false

    private var periods: [GoalPeriod] { GoalPeriod.history(data.plans, inputs: data.inputs) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                if let current = data.current {
                    if data.checkInDue { checkInBanner }
                    section("In Progress") {
                        programCard(current)
                        goalCard(current, period: periods.first)
                        weekCard(current)
                    }
                    section("Goal History") {
                        ForEach(periods) { GoalHistoryRow(period: $0, unit: data.unit) }
                    }
                    section("Program History", seeAll: data.plans.count > 5) {
                        ForEach(data.plans.reversed().prefix(5)) { PlanRow(plan: $0) }
                    }
                } else {
                    emptyState
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 30)
        }
        .background(Theme.background)
        .screenTitle("Strategy")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) { menu }
        }
        .fullScreenCover(item: $wizard) { request in
            StrategyWizardView(model: request.model, isFirst: request.isFirst)
        }
        .sheet(isPresented: $checkingIn) {
            CheckInView()
        }
    }

    private var menu: some View {
        Menu {
            Button("New Goal", systemImage: "plus") { open(.newGoal) }
            if data.current != nil {
                Button("Edit Goal", systemImage: "pencil") { open(.editGoal) }
                Button("New Program", systemImage: "arrow.clockwise") { open(.newProgram) }
                Button("Edit Program", systemImage: "pencil") { open(.editProgram) }
            }
            Divider()
            NavigationLink(value: StrategyRoute.checkInSettings) { Label("Check-In Settings", systemImage: "calendar") }
            NavigationLink(value: StrategyRoute.nutrientGoals) { Label("Nutrient Goals", systemImage: "target") }
        } label: {
            Image(systemName: "ellipsis")
        }
        .accessibilityLabel("Strategy Options")
    }

    private func open(_ mode: StrategyWizardModel.Mode) {
        guard let model = data.wizard(mode) else { return }
        wizard = WizardRequest(model: model, isFirst: data.plans.isEmpty)
    }

    private var canStart: Bool { data.wizard(.newGoal) != nil }

    private var emptyState: some View {
        ContentUnavailableView {
            Label("No Goal Yet", systemImage: "target")
        } description: {
            Text(canStart ? "Set a goal and we'll design your Calorie and macro targets." : "Log a weigh-in from the Dashboard first, so your goal can start from your weight.")
        } actions: {
            Button("New Goal") { open(.newGoal) }
                .buttonStyle(.glassProminent)
                .disabled(!canStart)
        }
        .padding(.top, 80)
    }

    private var checkInBanner: some View {
        StrategyCard(title: "Check-In Ready", subtitle: "Review your week and update your targets.") {
            Button {
                checkingIn = true
            } label: {
                Text("Start Check-In").font(AppFont.headline()).frame(maxWidth: .infinity)
            }
            .buttonStyle(.glassProminent)
            .tint(StrategyPalette.goal)
            .controlSize(.large)
        }
    }

    private func section<Content: View>(_ title: String, seeAll: Bool = false, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(title).font(AppFont.title())
                Spacer()
                if seeAll {
                    NavigationLink(value: StrategyRoute.planHistory) {
                        Text("See All").font(AppFont.medium(15)).underline()
                    }
                    .foregroundStyle(Theme.textPrimary)
                    .accessibilityLabel("See All \(title)")
                }
            }
            content()
        }
    }

    private func programCard(_ plan: NutritionPlan) -> some View {
        let todayTarget = plan.target(on: data.today)
        return StrategyCard(
            title: "\(StrategyRules.styleName(plan.coaching.style)) Program",
            subtitle: StrategyFormat.range(StrategyRules.programStart(data.plans, current: plan), nil)
        ) {
            WeekTargetsChart(targets: plan.targets, today: data.today.weekday)
            HStack {
                StrategyStat(value: StrategyFormat.kcal(todayTarget.energy), caption: "Today · \(StrategyFormat.macros(todayTarget))")
                StrategyStat(value: StrategyFormat.kcal(StrategyRules.averageEnergy(plan.targets)), caption: "Daily average")
            }
        } actions: {
            Button("New Program", systemImage: "arrow.clockwise") { open(.newProgram) }
            Button("Edit Program", systemImage: "pencil") { open(.editProgram) }
        }
    }

    private func goalCard(_ plan: NutritionPlan, period: GoalPeriod?) -> some View {
        let goal = plan.goal
        let weeklyKg = (data.inputs.trendWeightKg ?? goal.targetWeightKg ?? 0) * goal.ratePercentPerWeek / 100
        return StrategyCard(title: "\(StrategyRules.goalName(goal.kind)) Goal", subtitle: StrategyFormat.range(period?.start ?? goal.startedOn, nil)) {
            HStack(alignment: .top) {
                StrategyStat(value: StrategyFormat.weight(goal.targetWeightKg, data.unit), caption: "Goal Weight")
                if goal.kind != .maintain {
                    StrategyStat(value: "\(StrategyFormat.signed(data.unit.fromKg(weeklyKg), digits: 2...2)) \(data.unit.rawValue)", caption: "Goal Rate / week")
                    StrategyStat(value: "\(StrategyFormat.signed(goal.ratePercentPerWeek, digits: 0...2)) %", caption: "Goal Rate / week")
                }
            }
            if let period { GoalProgressView(period: period, inputs: data.inputs, unit: data.unit) }
        } actions: {
            Button("New Goal", systemImage: "plus") { open(.newGoal) }
            Button("Edit Goal", systemImage: "pencil") { open(.editGoal) }
            if periods.count > 1 {
                Button("Reopen Previous Goal", systemImage: "arrow.uturn.backward") {
                    store.savePlan(StrategyRules.reopenedPlan(previous: periods[1].goal, current: plan, basis: data.basis, today: data.today))
                }
            }
        }
    }

    private func weekCard(_ plan: NutritionPlan) -> some View {
        let summary = CheckInRules.summary(data.inputs)
        let next = CheckInRules.nextCheckInDay(today: data.today, weekday: data.settings.nutrition.checkInWeekday)
        let subtitle = plan.coaching.style == .manual
            ? "Manual programs keep your targets; we keep tracking your expenditure."
            : data.checkInDue ? "Check-in due" : "Next check-in \(StrategyFormat.day(next))"
        return StrategyCard(title: "This Week", subtitle: subtitle) {
            Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 12) {
                GridRow {
                    StrategyStat(value: data.inputs.expenditureKcal.map(StrategyFormat.kcal) ?? "—", caption: data.inputs.isStaticExpenditure ? "Static Expenditure" : "Expenditure")
                    StrategyStat(value: StrategyFormat.weight(data.inputs.trendWeightKg, data.unit), caption: "Trend Weight")
                }
                GridRow {
                    StrategyStat(value: summary.averageIntakeKcal.map(StrategyFormat.kcal) ?? "—", caption: "Average Intake · \(summary.loggedDays)/7 days")
                    StrategyStat(
                        value: summary.trendChangeKg.map { "\(StrategyFormat.signed(data.unit.fromKg($0), digits: 2...2)) \(data.unit.rawValue)" } ?? "—",
                        caption: "Trend Change · \(summary.weighIns) weigh-ins"
                    )
                }
            }
        }
    }
}

private struct GoalProgressView: View {
    let period: GoalPeriod
    let inputs: StrategyInputs
    let unit: WeightUnit

    private var points: [(day: CalendarDay, kg: Double)] {
        var day = period.start
        var result: [(CalendarDay, Double)] = []
        while day <= inputs.today {
            if let kg = inputs.trend[day] { result.append((day, kg)) }
            day = day.adding(days: 1)
        }
        return result
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if points.count > 1 {
                Chart {
                    ForEach(points, id: \.day) { point in
                        LineMark(x: .value("Day", StrategyInputs.date(point.day, .current)), y: .value("Trend", unit.fromKg(point.kg)))
                            .foregroundStyle(StrategyPalette.goal)
                            .interpolationMethod(.monotone)
                    }
                    if let target = period.goal.targetWeightKg {
                        RuleMark(y: .value("Goal", unit.fromKg(target)))
                            .foregroundStyle(Theme.textSecondary)
                            .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                    }
                }
                .chartYScale(domain: .automatic(includesZero: false))
                .chartXAxis(.hidden)
                .frame(height: 90)
                .accessibilityLabel("Trend weight since the goal began")
            }
            if let progress = period.progress {
                ProgressView(value: progress) {
                    Text("\(StrategyFormat.weight(period.startWeightKg, unit)) → \(StrategyFormat.weight(period.endWeightKg, unit)) of \(StrategyFormat.weight(period.goal.targetWeightKg, unit))")
                        .font(AppFont.caption())
                        .foregroundStyle(Theme.textSecondary)
                }
                .tint(StrategyPalette.goal)
            }
        }
    }
}

private struct GoalHistoryRow: View {
    let period: GoalPeriod
    let unit: WeightUnit

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(StrategyFormat.range(period.start, period.end)).font(AppFont.headline(15))
                Text("\(StrategyFormat.weight(period.startWeightKg, unit)) → \(StrategyFormat.weight(period.endWeightKg, unit))")
                    .font(AppFont.caption())
                    .foregroundStyle(Theme.textSecondary)
            }
            Spacer()
            Text(kindName).font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
            Image(systemName: period.end == nil ? "hourglass" : "checkmark.circle.fill")
                .foregroundStyle(period.end == nil ? Theme.textPrimary : StrategyPalette.goal)
        }
        .padding(14)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
        .accessibilityElement(children: .combine)
    }

    private var kindName: String {
        switch period.goal.kind {
        case .lose: "Loss"
        case .maintain: "Maintain"
        case .gain: "Gain"
        }
    }
}

struct PlanRow: View {
    let plan: NutritionPlan

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(StrategyFormat.day(plan.id, year: true)).font(AppFont.headline(15))
                Text("\(kindName) · \(StrategyRules.styleName(plan.coaching.style))")
                    .font(AppFont.caption())
                    .foregroundStyle(Theme.textSecondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 3) {
                Text(StrategyFormat.kcal(StrategyRules.averageEnergy(plan.targets))).font(AppFont.medium(15)).monospacedDigit()
                if let expenditure = plan.expenditureKcal {
                    Text("Expenditure \(Int(expenditure.rounded()))").font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
                }
            }
        }
        .padding(14)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
        .accessibilityElement(children: .combine)
    }

    private var kindName: String {
        switch plan.kind {
        case .setup: "Setup"
        case .checkIn: "Check-In"
        case .edit: "Edit"
        }
    }
}

/// Every plan, newest first: the owner's imported history runs to dozens of rows.
struct PlanHistoryView: View {
    @Observe(NutritionPlan.all) private var plans

    var body: some View {
        List(plans.reversed()) { plan in
            PlanRow(plan: plan)
                .listRowInsets(EdgeInsets(top: 4, leading: 20, bottom: 4, trailing: 20))
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
        }
        .listStyle(.plain)
        .themedList()
        .navigationTitle("Program History")
        .navigationBarTitleDisplayMode(.inline)
    }
}
