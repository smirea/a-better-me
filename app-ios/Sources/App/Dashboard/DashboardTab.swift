import SwiftUI

struct DashboardTab: View {
    @Environment(\.scenePhase) private var scenePhase
    @Environment(ExerciseCatalog.self) private var catalog
    @State private var nutrition = NutritionData()
    @Observe(AppSettings.current) private var settings
    @Observe(NutritionLogDay.all) private var foodLog
    @Observe(NutritionPlan.all) private var plans
    @Observe(NutrientGoal.all) private var goals
    @Observe(BodyMetric.all) private var bodyMetrics

    var body: some View {
        // Reading `scenePhase` rebuilds the context when the scene becomes active, so a new day shows on return.
        let _ = scenePhase
        NavigationStack {
            DashboardHome(layout: settings.dashboard)
                .navigationDestination(for: DashboardRoute.self) { route in
                    switch route {
                    case .customize: CustomizeDashboardView()
                    case .allMuscles: AllMusclesView()
                    case .allExercises: AllExercisesView()
                    case let .muscle(_, metric): MetricDetailView(route: route, initialTab: metric.title)
                    case let .exercise(_, metric): MetricDetailView(route: route, initialTab: metric.title)
                    case .goalProgress: GoalProgressView()
                    case .foodLogging: FoodLoggingHabitView()
                    case .nutritionData: NutritionDataManagerView()
                    case .allNutrition: AllNutritionView()
                    case .allBodyMetrics: AllBodyMetricsView()
                    default: MetricDetailView(route: route)
                    }
                }
        }
        .environment(nutrition)
        .environment(\.dashboardContext, DashboardContext(
            unit: settings.weightUnit, today: Calendar.current.startOfDay(for: .now), calendar: .current, custom: catalog.custom
        ))
        .onChange(of: NutritionData.Inputs(
            log: foodLog, plans: plans, goals: goals, expenditure: settings.nutrition.expenditure, heightUnit: settings.nutrition.heightUnit,
            profile: settings.profile, bodyMetrics: bodyMetrics
        ), initial: true) { _, inputs in
            nutrition.update(inputs)
        }
        .onChange(of: settings.nutrition, initial: true) { _, settings in
            nutrition.settings = settings
        }
    }
}

private struct DashboardHome: View {
    let layout: DashboardLayout

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 30) {
                if !layout.primaryFocus.isEmpty {
                    primaryFocus
                }
                ForEach(layout.sections, id: \.self) { section in
                    self.section(section)
                }
            }
            .padding(.bottom, 30)
        }
        .background(Theme.background)
        .screenTitle("Dashboard")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink(value: DashboardRoute.customize) {
                    Image(systemName: "slider.horizontal.3")
                }
                .accessibilityLabel("Customize Dashboard")
            }
        }
    }

    private var primaryFocus: some View {
        TabView {
            ForEach(layout.primaryFocus, id: \.self) { card in
                Group {
                    switch card {
                    case .workouts: CycleFocus()
                    case .recentRecords: RecordsFocus()
                    case .weeklyNutrition: WeeklyNutritionFocus()
                    case .energyBalance: EnergyBalanceFocusCard()
                    case .dailyNutrition: DailyNutritionFocus()
                    }
                }
                .padding(.horizontal, Theme.margin)
                .frame(maxHeight: .infinity, alignment: .top)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: layout.primaryFocus.count > 1 ? .always : .never))
        .frame(height: 320)
    }

    @ViewBuilder
    private func section(_ section: DashboardSection) -> some View {
        if !isEmpty(section) {
            DashboardSectionView(title: section.title, seeAll: section.seeAll) {
                switch section {
                case .insights: ForEach(layout.insights, id: \.self) { InsightCardView(card: $0) }
                case .habits: ForEach(layout.habits, id: \.self) { HabitCardView(card: $0) }
                case .nutrition: ForEach(layout.nutrition, id: \.self) { NutritionCardView(card: $0) }
                case .bodyMetrics: ForEach(layout.bodyMetrics, id: \.self) { BodyMetricCardView(card: $0) }
                case .muscles: ForEach(layout.muscles, id: \.self) { MuscleCardView(card: $0) }
                case .exercises: ForEach(layout.exercises, id: \.self) { ExerciseCardView(card: $0) }
                case .general: StepsCardView()
                }
            }
        }
    }

    private func isEmpty(_ section: DashboardSection) -> Bool {
        switch section {
        case .insights: layout.insights.isEmpty
        case .habits: layout.habits.isEmpty
        case .nutrition: layout.nutrition.isEmpty
        case .bodyMetrics: layout.bodyMetrics.isEmpty
        case .muscles: layout.muscles.isEmpty
        case .exercises: layout.exercises.isEmpty
        case .general: !layout.general.contains(.steps)
        }
    }
}

private extension DashboardSection {
    var seeAll: DashboardRoute? {
        switch self {
        case .nutrition: .allNutrition
        case .bodyMetrics: .allBodyMetrics
        case .muscles: .allMuscles
        case .exercises: .allExercises
        case .insights, .habits, .general: nil
        }
    }
}

/// Owns its picker's state, so a tap re-renders this card alone.
private struct CycleFocus: View {
    @Observe(WorkoutTemplate.all) private var templates
    @Observe(Program.active) private var program
    @State private var scope = DashboardMetrics.CycleScope.activeProgram
    private var values = DashboardValues()

    var body: some View {
        CycleRingsCard(
            progress: values.cycleProgress(scope, program: program, templates: templates),
            hasProgram: program != nil,
            scope: $scope
        )
    }
}

private struct RecordsFocus: View {
    @State private var kind = ExerciseRecord.Kind.volume
    private var values = DashboardValues()

    var body: some View {
        RecentRecordsCard(records: values.recentRecords(kind), kind: $kind)
    }
}

private struct InsightCardView: View {
    let card: InsightCard
    private var values = DashboardValues()

    init(card: InsightCard) { self.card = card }

    var body: some View {
        switch card {
        case .workouts:
            let sets = values.workoutsCard
            NavigationLink(value: DashboardRoute.workouts) {
                DashboardCard(title: "Workouts", period: "Last 7 Workouts", value: sets.text, unit: "sets") {
                    MiniBars(values: sets.values, color: Theme.accent)
                }
            }
        case .weightTrend:
            let trend = values.trendCard
            NavigationLink(value: DashboardRoute.weightTrend) {
                DashboardCard(title: "Weight Trend", period: "Last 7 Days", value: trend.text, unit: values.context.unit.rawValue) {
                    MiniLine(values: trend.values, color: Theme.weightTrend)
                }
            }
        case .expenditure:
            let card = values.expenditureCard
            NavigationLink(value: DashboardRoute.expenditure) {
                DashboardCard(title: "Expenditure", period: "Last 7 Days", value: card.text, unit: "kcal") {
                    MiniLine(values: card.values, color: Theme.accent)
                }
            }
        case .energyBalance:
            EnergyBalanceInsightCard(balance: values.balance(.expenditure, days: 7))
        case .goalProgress:
            GoalProgressInsightCard(progress: values.goalProgress(.scale))
        }
    }
}

private struct HabitCardView: View {
    let card: HabitCard
    private var values = DashboardValues()

    init(card: HabitCard) { self.card = card }

    var body: some View {
        switch card {
        case .weighIn:
            let habit = values.weighInHabit
            NavigationLink(value: DashboardRoute.scaleWeight) {
                DashboardCard(title: "Weigh-In", period: "Last 30 Days", value: habit.text, unit: "this week") {
                    DotGrid(days: habit.days, color: Theme.green)
                }
            }
        case .workouts:
            let habit = values.workoutHabit
            NavigationLink(value: DashboardRoute.workouts) {
                DashboardCard(title: "Workouts", period: "Last 30 Days", value: habit.text, unit: "this week") {
                    DotGrid(days: habit.days, color: Theme.accent)
                }
            }
        case .foodLogging:
            let habit = values.foodLogging.habit
            NavigationLink(value: DashboardRoute.foodLogging) {
                DashboardCard(title: "Food Logging", period: "Last 30 Days", value: habit.text, unit: "this week") {
                    DotGrid(days: habit.days, color: Theme.calories)
                }
            }
        }
    }
}

private struct StepsCardView: View {
    private var values = DashboardValues()

    var body: some View {
        let days = values.stepsCard
        NavigationLink(value: DashboardRoute.steps) {
            DashboardCard(title: "Steps", period: "Last 7 Days", value: days.text, unit: "steps") {
                MiniBars(values: days.values, color: Theme.accent)
            }
        }
    }
}

struct DashboardSectionView<Cards: View>: View {
    let title: String
    var seeAll: DashboardRoute?
    @ViewBuilder let cards: Cards

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title) {
                if let seeAll { SeeAllLink(section: title, value: seeAll) }
            }
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                cards
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, Theme.margin)
    }
}

struct MuscleCardView: View {
    let card: MuscleCard
    private var values = DashboardValues()

    init(card: MuscleCard) { self.card = card }

    var body: some View {
        let days = values.muscleCard(card)
        NavigationLink(value: DashboardRoute.muscle(card.muscle, card.metric)) {
            DashboardCard(title: card.muscle.displayName, period: "Last 7 Days", value: days.text, unit: card.metric.unit(values.context.unit)) {
                MiniBars(values: days.values, color: Theme.muscle)
            }
        }
    }
}

struct ExerciseCardView: View {
    let card: ExerciseCard
    @Environment(ExerciseCatalog.self) private var catalog
    private var values = DashboardValues()

    init(card: ExerciseCard) { self.card = card }

    var body: some View {
        let points = values.exerciseCard(card)
        NavigationLink(value: DashboardRoute.exercise(card.exerciseID, card.metric)) {
            DashboardCard(title: catalog.name(card.exerciseID), period: "Last 7 Workouts", value: points.text, unit: card.metric.unit(values.context.unit)) {
                MiniLine(values: points.values, color: Theme.exercise)
            }
        }
    }
}

struct AllMusclesView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 30) {
                ForEach([("Upper", Muscle.upperBody), ("Lower", Muscle.lowerBody)], id: \.0) { title, muscles in
                    DashboardSectionView(title: title) {
                        ForEach(muscles) { MuscleCardView(card: MuscleCard(muscle: $0)) }
                    }
                }
            }
            .padding(.vertical, 16)
        }
        .background(Theme.background)
        .detailTitle("Muscle Groups")
    }
}

struct AllExercisesView: View {
    private var values = DashboardValues()

    var body: some View {
        ScrollView {
            DashboardSectionView(title: "Trained") {
                ForEach(values.trainedExercises, id: \.self) { ExerciseCardView(card: ExerciseCard(exerciseID: $0)) }
            }
            .padding(.vertical, 16)
        }
        .background(Theme.background)
        .detailTitle("Exercises")
    }
}

extension Array where Element: Hashable {
    func firstOccurrences() -> [Element] {
        var seen = Set<Element>()
        return filter { seen.insert($0).inserted }
    }
}
