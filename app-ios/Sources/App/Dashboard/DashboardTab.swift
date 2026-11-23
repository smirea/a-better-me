import Feedback
import SwiftUI

struct DashboardTab: View {
    @Binding var path: NavigationPath
    @Environment(\.scenePhase) private var scenePhase
    @Environment(ExerciseCatalog.self) private var catalog
    @State private var nutrition = NutritionData()
    @Observe(AppSettings.current) private var settings
    @Observe(NutritionLogDay.all, async: true) private var foodLog
    @Observe(NutritionPlan.all) private var plans
    @Observe(NutrientGoal.all) private var goals
    @Observe(BodyMetric.measurements, async: true) private var bodyMetrics

    var body: some View {
        // Reading `scenePhase` rebuilds the context when the scene becomes active, so a new day shows on return.
        let _ = scenePhase
        NavigationStack(path: $path) {
            DashboardHome(layout: settings.dashboard)
                .navigationDestination(for: DashboardRoute.self) { route in
                    switch route {
                    case .settings: SettingsView()
                    case .strain: StrainDetailView { path.append(DashboardRoute.ping($0.id)) }
                    case let .ping(id): PingHistoryView(pingID: id)
                    case .allMuscles: AllMusclesView()
                    case .allExercises: AllExercisesView()
                    case let .muscle(_, metric): MetricDetailView(route: route, initialTab: metric.title)
                    case let .exercise(_, metric): MetricDetailView(route: route, initialTab: metric.title)
                    case .goalProgress: GoalProgressView()
                    case .foodLogging: FoodLoggingHabitView()
                    case .nutritionData: NutritionDataManagerView()
                    case .allNutrition: AllNutritionView()
                    case .allBodyMetrics: AllBodyMetricsView()
                    case .levels: LevelsView { DashboardRoute.muscleLevels($0) }
                    case let .muscleLevels(muscle): MuscleLevelsView(muscle: muscle)
                    default: MetricDetailView(route: route)
                    }
                }
                .settingsDestinations()
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
    @Environment(\.dashboardContext) private var context

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 30) {
                OverviewFocus()
                    .padding(.horizontal, Theme.margin)
                StrainDashboardCard(day: CalendarDay(context.today, in: context.calendar))
                    .id(context.today)
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
                NavigationLink(value: DashboardRoute.settings) {
                    Image(systemName: "gearshape")
                }
                .accessibilityLabel("Settings")
            }
        }
        .feedback(self)
    }

    @ViewBuilder
    private func section(_ section: DashboardSection) -> some View {
        if section == .pings {
            PingCardsSection(today: context.today).id(context.today)
        } else if !isEmpty(section) {
            DashboardSectionView(title: section.title, seeAll: section.seeAll) {
                switch section {
                case .insights: ForEach(layout.insights, id: \.self) { InsightCardView(card: $0) }
                case .habits: ForEach(layout.habits, id: \.self) { HabitCardView(card: $0) }
                case .pings: EmptyView()
                case .nutrition: ForEach(layout.nutrition, id: \.self) { NutritionCardView(card: $0) }
                case .bodyMetrics: ForEach(layout.bodyMetrics, id: \.self) { BodyMetricCardView(card: $0) }
                case .muscles: ForEach(layout.muscles, id: \.self) { MuscleCardView(card: $0) }
                case .exercises: ForEach(layout.exercises, id: \.self) { ExerciseCardView(card: $0) }
                }
            }
        }
    }

    private func isEmpty(_ section: DashboardSection) -> Bool {
        switch section {
        case .insights: layout.insights.isEmpty
        case .habits: layout.habits.isEmpty
        case .pings: false
        case .nutrition: layout.nutrition.isEmpty
        case .bodyMetrics: layout.bodyMetrics.isEmpty
        case .muscles: layout.muscles.isEmpty
        case .exercises: layout.exercises.isEmpty
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
        case .insights, .habits, .pings: nil
        }
    }
}

private struct InsightCardView: View {
    let card: InsightCard
    private var values = DashboardValues()

    init(card: InsightCard) { self.card = card }

    var body: some View {
        Group {
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
                    DashboardCard(title: "Expenditure", period: "Last 7 Days", value: card.text, unit: "cal") {
                        MiniLine(values: card.values, color: Theme.coral)
                    }
                }
            case .energyBalance:
                EnergyBalanceInsightCard(balance: values.balance(.expenditure, days: 7))
            case .goalProgress:
                GoalProgressInsightCard(progress: values.goalProgress(.scale))
            case .steps:
                let goal = values.stepGoal
                NavigationLink(value: DashboardRoute.steps) {
                    DashboardCard(
                        title: "Steps", period: goal.streak > 0 ? "\(goal.streak)-day streak" : "Last 7 Days",
                        value: goal.hasSteps ? goal.today.wholeText : nil, unit: "steps"
                    ) {
                        MiniBars(values: goal.week.map(\.steps), color: Theme.coral, colors: goal.week.map(\.tier.color), goal: Double(goal.goal))
                    }
                }
            }
        }
        .feedback(self)
    }
}

private struct HabitCardView: View {
    let card: HabitCard
    private var values = DashboardValues()

    init(card: HabitCard) { self.card = card }

    var body: some View {
        Group {
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
        .feedback(self)
    }
}

struct DashboardSectionView<Cards: View>: View {
    let title: String?
    var seeAll: DashboardRoute?
    @ViewBuilder let cards: Cards

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let title {
                SectionHeader(title) {
                    if let seeAll { SeeAllLink(section: title, value: seeAll) }
                }
            }
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                cards
            }
            .buttonStyle(.plain)
        }
        .feedback(self)
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
        .feedback(self)
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
        .feedback(self)
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
        .feedback(self)
    }
}

struct AllExercisesView: View {
    private var values = DashboardValues()

    var body: some View {
        ScrollView {
            DashboardSectionView(title: nil) {
                ForEach(values.trainedExercises, id: \.self) { ExerciseCardView(card: ExerciseCard(exerciseID: $0)) }
            }
            .padding(.vertical, 16)
        }
        .overlay {
            if values.trainedExercises.isEmpty {
                ContentUnavailableView("No Exercises", systemImage: "dumbbell", description: Text("Finish a workout to see its exercises."))
            }
        }
        .background(Theme.background)
        .detailTitle("Exercises")
        .feedback(self)
    }
}
