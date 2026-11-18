import SwiftUI

enum DashboardRoute: Hashable {
    case workouts, weightTrend, scaleWeight, steps
    case muscle(Muscle, MuscleMetric)
    case exercise(ExerciseID, ExerciseChartMetric)
    case allMuscles, allExercises, customize, levels, muscleLevels(Muscle)
    case expenditure, energyBalance, goalProgress, foodLogging, nutritionData
    case nutrient(NutrientID), macros, allNutrition
    case bodyMetric(BodyMetricCard), allBodyMetrics

    var usesHealth: Bool {
        switch self {
        case .weightTrend, .scaleWeight, .steps: true
        default: usesNutrition
        }
    }

    /// Reads the food log, plans, or imported steps, and the weigh-ins with them.
    var usesNutrition: Bool {
        switch self {
        case .steps, .expenditure, .energyBalance, .nutrient, .macros, .bodyMetric: true
        default: false
        }
    }
}

enum MetricUnit: Equatable {
    /// Whole numbers, as kcal and steps.
    case whole(String)
    /// Up to one decimal, as weights, lengths, sets, and grams.
    case decimal(String)
    /// Enough decimals that a small nutrient amount never reads as zero, as mg and mcg.
    case trace(String)
    /// Two decimals, the body ratios.
    case ratio

    init(_ unit: NutrientUnit) {
        switch unit {
        case .kcal: self = .whole(unit.rawValue)
        case .mg, .mcg: self = .trace(unit.rawValue)
        case .g, .mL: self = .decimal(unit.rawValue)
        }
    }

    var label: String {
        switch self {
        case let .whole(label), let .decimal(label), let .trace(label): label
        case .ratio: "ratio"
        }
    }

    func format(_ value: Double) -> String {
        switch self {
        case .whole: value.wholeText
        case .decimal: value.dashboardText
        case .trace: value.niceText
        case .ratio: value.formatted(.number.precision(.fractionLength(2)))
        }
    }
}

struct MetricTab: Identifiable {
    enum Style { case bar, line }

    /// A second series drawn over the first, such as expenditure over intake bars.
    struct Overlay {
        var title: String
        var points: [DatedValue]
        var color: Color
        var dashed = false
    }

    struct Stat: Equatable {
        var title: String
        var value: Double?
    }

    var title: String
    var points: [DatedValue]
    var unit: MetricUnit
    /// What the legend calls the main series when it differs from the tab, such as intake ("Calories") on a balance tab.
    var seriesTitle: String?
    var averageTitle: String
    var summary: SummaryKind
    var style: Style
    var color: Color
    var overlay: Overlay?
    /// Days whose value was held, drawn as hollow squares and tagged in the list.
    var holding: Set<Date> = []
    /// Replaces the Average and second stat with these, computed over the range.
    var stats: ((DateInterval) -> [Stat])?
    /// What an Energy Balance tab compares intake with.
    var balance: BalanceReference?
    /// A daily target drawn as a dashed rule; bars at or above it take the goal color.
    var goal: Double?

    var id: String { title }
}

struct MetricDetail {
    enum Footer {
        case months
        case weighIns([WeighIn])
        case topExercises([(exerciseID: ExerciseID, sets: Int)])
        case expenditure(ExpenditureSummary)
        case weightTrend(WeightTrendSummary)
        case energyBalance
        case nutrient(NutrientSummary)
        case macros([(date: Date, split: TileMetrics.MacroSplit)])
        case steps(StepGoal.Summary, flights: [DatedValue], meters: [DatedValue])
    }

    var title: String
    var tabs: [MetricTab]
    var footer: Footer

    func tab(_ id: MetricTab.ID?) -> MetricTab {
        tabs.first { $0.id == id } ?? tabs[0]
    }
}

/// What dashboard values read besides the history and Health; part of every memo key.
struct DashboardContext: Hashable {
    var unit = WeightUnit.kg
    /// Only re-renders the cards on a new day. Values key on the date `DashboardValues` reads when called, because a
    /// history change can recompute them before this refreshes.
    var today = Calendar.current.startOfDay(for: .now)
    var calendar = Calendar.current
    /// Editing a custom exercise can change its name or the muscles it counts toward.
    var custom: [Exercise] = []
}

extension EnvironmentValues {
    @Entry var dashboardContext = DashboardContext()
}

extension DashboardData {
    func detail(_ route: DashboardRoute) -> MetricDetail {
        switch route {
        case .workouts:
            let since = calendar.date(byAdding: .day, value: -30, to: now)!
            return MetricDetail(title: "Workouts", tabs: DashboardMetrics.WorkoutMetric.allCases.map { metric in
                let points = DashboardMetrics.workouts(sessions, metric: metric, catalog: catalog)
                return MetricTab(
                    title: metric.rawValue,
                    points: DailyCombine.sum.combine(metric == .volume ? weight(points) : points, calendar: calendar),
                    unit: .decimal(metric == .sets ? "sets" : unit.rawValue), averageTitle: "Average \(metric.rawValue)",
                    summary: .total, style: .bar, color: Theme.accent
                )
            }, footer: .topExercises(DashboardMetrics.topExercises(sessions, since: since)))
        case .weightTrend:
            let trend = trend
            let scale = DailyCombine.mean.combine(weighIns.points, calendar: calendar)
            return MetricDetail(title: "Weight Trend", tabs: [MetricTab(
                title: "Trend Weight", points: weight(trend), unit: .decimal(unit.rawValue), averageTitle: "Average",
                summary: .change, style: .line, color: Theme.weightTrend,
                overlay: MetricTab.Overlay(title: "Scale Weight", points: weight(scale), color: Theme.scaleOnTrend)
            )], footer: .weightTrend(WeightTrendSummary(
                changes: NutritionMetrics.changes(trend, now: now, calendar: calendar),
                insights: NutritionMetrics.weightInsights(trend: trend, now: now, calendar: calendar)
            )))
        case .expenditure:
            return MetricDetail(title: "Expenditure", tabs: [MetricTab(
                title: "Expenditure", points: expenditurePoints, unit: .whole("kcal"), averageTitle: "Average",
                summary: .change, style: .line, color: Theme.coral,
                holding: Set(expenditure.filter(\.isHolding).map(\.date))
            )], footer: .expenditure(ExpenditureSummary(
                changes: NutritionMetrics.changes(expenditurePoints, now: now, calendar: calendar),
                currentKcal: expenditure.last?.kcal,
                strategy: NutritionExpenditure.strategy(expenditure, settings: expenditureSettings)
            )))
        case .energyBalance:
            return MetricDetail(title: "Energy Balance", tabs: [
                balanceTab(.expenditure, title: "Expenditure", points: expenditurePoints, color: Theme.coral),
                balanceTab(.targets, title: "Calorie Targets", points: energyTargets, color: Theme.fat),
            ], footer: .energyBalance)
        case .scaleWeight:
            let points = DailyCombine.mean.combine(weighIns.points, calendar: calendar)
            return MetricDetail(title: "Scale Weight", tabs: [MetricTab(
                title: "Scale Weight", points: weight(points), unit: .decimal(unit.rawValue), averageTitle: "Average",
                summary: .change, style: .line, color: Theme.green
            )], footer: .weighIns(weighIns.reversed()))
        case .steps:
            return MetricDetail(title: "Steps", tabs: [MetricTab(
                title: "Steps", points: steps, unit: .whole("steps"), averageTitle: "Average Steps",
                summary: .total, style: .bar, color: Theme.coral, goal: Double(profile.dailyStepGoal)
            )], footer: .steps(stepGoal, flights: flights, meters: meters))
        case let .muscle(muscle, _):
            return MetricDetail(title: muscle.displayName, tabs: [MuscleMetric.sets, .volume].map { metric in
                MetricTab(
                    title: metric.title,
                    points: DailyCombine.sum.combine(self.muscle(muscle, metric), calendar: calendar),
                    unit: .decimal(metric.unit(unit)), averageTitle: "Average \(metric.title)", summary: .total,
                    style: .bar, color: Theme.muscle
                )
            }, footer: .months)
        case let .exercise(id, _):
            let series = DashboardMetrics.exercise(id, sessions: sessions, catalog: catalog)
            return MetricDetail(title: catalog(id)?.name ?? Exercise.unknownName, tabs: ExerciseChartMetric.allCases.map { metric in
                MetricTab(
                    title: metric.title, points: metric.dailyCombine.combine(convert(series[metric] ?? [], metric), calendar: calendar),
                    unit: .decimal(metric.unit(unit)), averageTitle: "Avg \(metric.title)",
                    summary: .best, style: metric == .totalSets ? .bar : .line, color: Theme.exercise
                )
            }, footer: .months)
        case let .nutrient(id):
            return nutrientDetail(id)
        case .macros:
            return macrosDetail
        case let .bodyMetric(card):
            return bodyMetricDetail(card)
        case .allMuscles, .allExercises, .customize, .goalProgress, .foodLogging, .nutritionData, .allNutrition, .allBodyMetrics, .levels, .muscleLevels:
            preconditionFailure("\(route) is not a metric detail")
        }
    }
}

/// Dashboard values through the history's memo: each is computed once per change of its inputs, and every view that
/// shows it shares the result.
@MainActor
struct DashboardValues: DynamicProperty {
    @Environment(SessionHistory.self) private var history
    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(HealthData.self) private var health
    @Environment(NutritionData.self) private var nutrition
    @Environment(\.dashboardContext) var context

    private enum Name: Hashable {
        case muscleCard(MuscleCard), exerciseCard(ExerciseCard), workoutsCard, trendCard, scaleWeightCard, stepGoal
        case weighInHabit, workoutHabit, records(ExerciseRecord.Kind), trained
        case cycle(DashboardMetrics.CycleScope, Program?, [WorkoutTemplate])
        case detail(DashboardRoute), plot(DashboardRoute, MetricTab.ID?, ChartRange, Averaging)
        case expenditureDays, expenditureCard, balance(BalanceReference, days: Int), week([NutrientID], overages: Bool), foodLogging
        case todaySummary([NutrientID], overages: Bool)
        case goal(GoalProgressValues.Source)
        case nutrientTile(NutritionCard), macrosCard, bodyMetricCard(BodyMetricCard)
    }

    private struct Key: Hashable {
        var name: Name
        var context: DashboardContext
        /// The start of today rather than `Date.now`, read on every call, so values that count days follow the date
        /// without recomputing on every render.
        var today: Date
        var healthRevision: Int?
        var nutritionRevision: Int?
    }

    /// Without `usesHealth`, `compute` sees no weigh-ins or steps, so a value that reads them without keying on Health
    /// shows up empty instead of silently stale. `usesNutrition` adds the food log, plans, nutrition settings, the
    /// expenditure, and the imported steps, and implies Health, because the expenditure reads the weigh-ins.
    private func memo<Value>(_ name: Name, usesHealth: Bool = false, usesNutrition: Bool = false, _ compute: (DashboardData) -> Value) -> Value {
        let today = context.calendar.startOfDay(for: .now)
        let readsHealth = usesHealth || usesNutrition
        let expenditure = usesNutrition && name != .expenditureDays ? expenditureDays : []
        let key = Key(
            name: name, context: context, today: today, healthRevision: readsHealth ? health.revision : nil,
            nutritionRevision: usesNutrition ? nutrition.revision : nil
        )
        return history.memo(key) { sessions in
            var data = DashboardData(
                sessions: sessions, weighIns: readsHealth ? health.weighIns : [], steps: readsHealth ? health.steps : [],
                unit: context.unit, catalog: catalog.exercise, now: today, calendar: context.calendar
            )
            if readsHealth {
                data.flights = health.flights
                data.meters = health.distance
            }
            if usesNutrition {
                data.steps = NutritionExpenditure.steps(health: health.steps, imported: nutrition.importedSteps, calendar: context.calendar)
                data.log = nutrition.log
                data.plans = nutrition.plans
                data.expenditureSettings = nutrition.inputs.expenditure
                data.heightUnit = nutrition.inputs.heightUnit
                data.expenditure = expenditure
                data.goals = nutrition.goals
                data.bodyMetrics = nutrition.bodyMetrics
                data.profile = nutrition.profile
            }
            return compute(data)
        }
    }

    private var expenditureDays: [NutritionEngine.ExpenditureDay] {
        memo(.expenditureDays, usesNutrition: true) { $0.computedExpenditure(profile: nutrition.profile) }
    }

    var expenditureCard: CardValues { memo(.expenditureCard, usesNutrition: true) { $0.expenditureCard } }
    func balance(_ reference: BalanceReference, days: Int) -> BalanceValues { memo(.balance(reference, days: days), usesNutrition: true) { $0.balance(reference, days: days) } }
    func week(_ columns: [NutrientID], overages: Bool) -> [NutritionMetrics.DaySummary] {
        memo(.week(columns, overages: overages), usesNutrition: true) { $0.week(columns, overages: overages) }
    }
    func todaySummary(_ columns: [NutrientID], overages: Bool) -> [MacroLine] {
        memo(.todaySummary(columns, overages: overages), usesNutrition: true) { $0.todaySummary(columns, overages: overages) }
    }
    var foodLogging: FoodLoggingValues { memo(.foodLogging, usesNutrition: true) { $0.foodLogging } }
    func goalProgress(_ source: GoalProgressValues.Source) -> GoalProgressValues? {
        memo(.goal(source), usesNutrition: true) { GoalProgressValues(data: $0, source: source) }
    }
    var nutritionSettings: NutritionSettings { nutrition.settings }
    func nutrientTile(_ card: NutritionCard) -> TileMetrics.Tile { memo(.nutrientTile(card), usesNutrition: true) { $0.nutrientTile(card) } }
    var macrosCard: MacrosCardValues { memo(.macrosCard, usesNutrition: true) { $0.macrosCard } }
    func bodyMetricCard(_ card: BodyMetricCard) -> CardValues { memo(.bodyMetricCard(card), usesNutrition: true) { $0.bodyMetricCard(card) } }

    func muscleCard(_ card: MuscleCard) -> CardValues { memo(.muscleCard(card)) { $0.muscleCard(card) } }
    func exerciseCard(_ card: ExerciseCard) -> CardValues { memo(.exerciseCard(card)) { $0.exerciseCard(card) } }
    var workoutsCard: CardValues { memo(.workoutsCard) { $0.workoutsCard } }
    var trendCard: CardValues { memo(.trendCard, usesHealth: true) { $0.trendCard } }
    var scaleWeightCard: CardValues { memo(.scaleWeightCard, usesHealth: true) { $0.scaleWeightCard } }
    var stepGoal: StepGoal.Summary { memo(.stepGoal, usesNutrition: true) { $0.stepGoal } }
    var weighInHabit: HabitValues { memo(.weighInHabit, usesHealth: true) { $0.weighInHabit } }
    var workoutHabit: HabitValues { memo(.workoutHabit) { $0.workoutHabit } }
    var trainedExercises: [ExerciseID] { memo(.trained) { $0.trainedExercises } }
    func recentRecords(_ kind: ExerciseRecord.Kind) -> [RecordRow] { memo(.records(kind)) { $0.recentRecords(kind) } }

    func cycleProgress(_ scope: DashboardMetrics.CycleScope, program: Program?, templates: [WorkoutTemplate]) -> DashboardMetrics.CycleProgress {
        memo(.cycle(scope, program, templates)) { $0.cycleProgress(scope, program: program, templates: templates) }
    }

    func detail(_ route: DashboardRoute) -> MetricDetail {
        memo(.detail(route), usesHealth: route.usesHealth, usesNutrition: route.usesNutrition) { $0.detail(route) }
    }

    func plot(_ route: DashboardRoute, tab: MetricTab.ID?, range: ChartRange, averaging: Averaging) -> MetricPlot {
        memo(.plot(route, tab, range, averaging), usesHealth: route.usesHealth, usesNutrition: route.usesNutrition) { data in
            let detail = detail(route)
            return MetricPlot(
                tab: detail.tab(tab), footer: detail.footer, range: range, averaging: averaging,
                now: data.now, calendar: data.calendar, unit: data.unit
            )
        }
    }
}
