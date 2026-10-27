import SwiftUI

enum DashboardRoute: Hashable {
    case workouts, weightTrend, scaleWeight, steps
    case muscle(Muscle, MuscleMetric)
    case exercise(ExerciseID, ExerciseChartMetric)
    case allMuscles, allExercises, customize
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

enum DashboardColor {
    static let workouts = Theme.accent
    static let trend = Color(hex: 0xA99BF0)
    static let scale = Color(hex: 0x7CC48A)
    static let exercise = Color(hex: 0x8EC9E8)
    static let records = Color(hex: 0xF5C842)
    static let muscle = Color(hex: 0x6C8EF0)
    static let energy = Color(hex: 0x68A0FA)
    static let protein = Color(hex: 0xFF8660)
    static let fat = Color(hex: 0xFFD05E)
    static let carbs = Color(hex: 0x5EB987)
    static let expenditure = Color(hex: 0xF9845D)
    static let goal = Color(hex: 0x5EBB89)
    static let goalAway = Color(hex: 0x6CC596)
    static let goalTowards = Color(hex: 0x1F5A3A)
    static let scaleOnTrend = Color(hex: 0x6E5BB8)

    static func nutrient(_ id: NutrientID) -> Color {
        switch id {
        case .protein: protein
        case .fat: fat
        case .carbs: carbs
        default: energy
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

    struct Stat {
        var title: String
        var value: Double?
    }

    var title: String
    var icon: String?
    var points: [DatedValue]
    var unit: String
    var averageTitle: String
    var summary: SummaryKind
    var style: Style
    var color: Color
    var overlay: Overlay?
    /// Days whose value was held, drawn as hollow squares and tagged in the list.
    var holding: Set<Date> = []
    /// Replaces the Average and second stat with these, computed over the range.
    var stats: ((DateInterval) -> [Stat])?

    var id: String { title }

    func format(_ value: Double) -> String {
        unit == "steps" || unit == "kcal" ? Int(value.rounded()).formatted() : value.dashboardText
    }
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

struct CardValues: Equatable {
    var values: [Double]
    var text: String?
}

struct HabitValues: Equatable {
    var days: [Bool]
    var text: String
}

struct RecordRow: Hashable {
    var exerciseID: ExerciseID
    var name: String
    var label: String
    /// The value over the largest one shown.
    var fraction: Double
}

/// Weights are stored in kilograms and converted to the owner's unit here, once, for every chart.
struct DashboardData {
    var sessions: [WorkoutSession]
    var weighIns: [WeighIn]
    var steps: [DatedValue]
    var unit: WeightUnit
    var catalog: (ExerciseID) -> Exercise?
    var now: Date
    var calendar: Calendar
    var log: [NutritionLogDay] = []
    var plans: [NutritionPlan] = []
    var nutritionSettings = NutritionSettings()
    var expenditure: [NutritionEngine.ExpenditureDay] = []
    var goals: [NutrientGoal] = []
    var bodyMetrics: [BodyMetric] = []
    var profile = ProfileSettings()

    var trend: [DatedValue] {
        WeightTrend.daily(weighIns.map { DatedValue(date: $0.date, value: $0.kg) }, through: now, calendar: calendar)
    }

    func weight(_ points: [DatedValue]) -> [DatedValue] {
        points.map { DatedValue(date: $0.date, value: unit.fromKg($0.value)) }
    }

    func lastDays(_ points: [DatedValue], count: Int = 7) -> [Double] {
        let today = calendar.startOfDay(for: now)
        let first = calendar.date(byAdding: .day, value: -(count - 1), to: today)!
        var days: [Date: Double] = [:]
        for point in points where point.date >= first {
            days[calendar.startOfDay(for: point.date), default: 0] += point.value
        }
        return (0..<count).reversed().map { days[calendar.date(byAdding: .day, value: -$0, to: today)!] ?? 0 }
    }

    func muscle(_ muscle: Muscle, _ metric: MuscleMetric) -> [DatedValue] {
        let points = DashboardMetrics.muscle(muscle, sessions: sessions, metric: metric, catalog: catalog)
        return metric == .volume ? weight(points) : points
    }

    func exercise(_ id: ExerciseID, _ metric: ExerciseChartMetric) -> [DatedValue] {
        convert(DashboardMetrics.exercise(id, sessions: sessions, catalog: catalog)[metric] ?? [], metric)
    }

    private func convert(_ points: [DatedValue], _ metric: ExerciseChartMetric) -> [DatedValue] {
        metric.isWeight ? weight(points) : points
    }

    func muscleCard(_ card: MuscleCard) -> CardValues {
        let days = lastDays(muscle(card.muscle, card.metric))
        let total = days.reduce(0, +)
        return CardValues(values: days, text: total > 0 ? total.dashboardText : nil)
    }

    func exerciseCard(_ card: ExerciseCard) -> CardValues {
        let values = exercise(card.exerciseID, card.metric).suffix(7).map(\.value)
        return CardValues(values: values, text: values.last?.dashboardText)
    }

    var workoutsCard: CardValues {
        let sets = DashboardMetrics.workouts(sessions, metric: .sets, catalog: catalog).suffix(7).map(\.value)
        return CardValues(values: sets, text: sets.last?.dashboardText)
    }

    var trendCard: CardValues {
        let values = weight(Array(trend.suffix(7))).map(\.value)
        return CardValues(values: values, text: values.last?.dashboardText)
    }

    var scaleWeightCard: CardValues {
        let entries = weighIns.suffix(7).map { unit.fromKg($0.kg) }
        return CardValues(values: entries, text: entries.last?.dashboardText)
    }

    var stepsCard: CardValues {
        let days = lastDays(steps)
        return CardValues(values: days, text: steps.isEmpty ? nil : Int(days.last!).formatted())
    }

    var weighInHabit: HabitValues {
        let dates = weighIns.map(\.date)
        return HabitValues(
            days: DashboardMetrics.habitDays(dates, now: now, calendar: calendar),
            text: "\(DashboardMetrics.daysThisWeek(dates, now: now, calendar: calendar))/7"
        )
    }

    var workoutHabit: HabitValues {
        let dates = sessions.map(\.startedAt)
        return HabitValues(
            days: DashboardMetrics.habitDays(dates, now: now, calendar: calendar),
            text: "\(dates.count { calendar.isDate($0, equalTo: now, toGranularity: .weekOfYear) })"
        )
    }

    func cycleProgress(_ scope: DashboardMetrics.CycleScope, program: Program?, templates: [WorkoutTemplate]) -> DashboardMetrics.CycleProgress {
        DashboardMetrics.cycleProgress(
            program == nil ? .allWorkouts : scope, program: program, templates: templates, sessions: sessions,
            now: now, calendar: calendar, catalog: catalog
        )
    }

    func recentRecords(_ kind: ExerciseRecord.Kind) -> [RecordRow] {
        let records = DashboardMetrics.recentRecords(sessions, kind: kind, catalog: catalog)
        let top = records.map(\.value).max() ?? 1
        return records.map { record in
            let label = switch kind {
            case .reps: "\(Int(record.value)) reps"
            case .volume, .oneRepMax: "\(unit.fromKg(record.value).dashboardText) \(unit.rawValue)"
            }
            return RecordRow(
                exerciseID: record.exerciseID, name: catalog(record.exerciseID)?.name ?? "Unknown exercise",
                label: label, fraction: record.value / top
            )
        }
    }

    /// Newest first.
    var trainedExercises: [ExerciseID] {
        sessions.sorted { $0.startedAt > $1.startedAt }.flatMap { $0.blocks.flatMap(\.exercises).map(\.exerciseID) }.firstOccurrences()
    }

    func detail(_ route: DashboardRoute) -> MetricDetail {
        switch route {
        case .workouts:
            let since = calendar.date(byAdding: .day, value: -30, to: now)!
            return MetricDetail(title: "Workouts", tabs: DashboardMetrics.WorkoutMetric.allCases.map { metric in
                let points = DashboardMetrics.workouts(sessions, metric: metric, catalog: catalog)
                return MetricTab(
                    title: metric.rawValue, icon: metric == .sets ? "arrow.right.circle.fill" : "scalemass.fill",
                    points: DailyCombine.sum.combine(metric == .volume ? weight(points) : points, calendar: calendar),
                    unit: metric == .sets ? "sets" : unit.rawValue, averageTitle: "Average \(metric.rawValue)",
                    summary: .total, style: .bar, color: DashboardColor.workouts
                )
            }, footer: .topExercises(DashboardMetrics.topExercises(sessions, since: since)))
        case .weightTrend:
            let trend = trend
            let scale = DailyCombine.mean.combine(weighIns.map { DatedValue(date: $0.date, value: $0.kg) }, calendar: calendar)
            return MetricDetail(title: "Weight Trend", tabs: [MetricTab(
                title: "Trend Weight", points: weight(trend), unit: unit.rawValue, averageTitle: "Average",
                summary: .change, style: .line, color: DashboardColor.trend,
                overlay: MetricTab.Overlay(title: "Scale Weight", points: weight(scale), color: DashboardColor.scaleOnTrend)
            )], footer: .weightTrend(WeightTrendSummary(
                changes: NutritionMetrics.changes(trend, now: now, calendar: calendar),
                insights: NutritionMetrics.weightInsights(trend: trend, now: now, calendar: calendar)
            )))
        case .expenditure:
            return MetricDetail(title: "Expenditure", tabs: [MetricTab(
                title: "Expenditure", points: expenditurePoints, unit: "kcal", averageTitle: "Average",
                summary: .change, style: .line, color: DashboardColor.expenditure,
                holding: Set(expenditure.filter(\.isHolding).map(\.date))
            )], footer: .expenditure(ExpenditureSummary(
                changes: NutritionMetrics.changes(expenditurePoints, now: now, calendar: calendar),
                currentKcal: expenditure.last?.kcal,
                strategy: NutritionMetrics.strategy(expenditure, settings: nutritionSettings.expenditure)
            )))
        case .energyBalance:
            return MetricDetail(title: "Energy Balance", tabs: [
                balanceTab("Expenditure", icon: "flame.fill", reference: expenditurePoints, color: DashboardColor.expenditure),
                balanceTab("Calorie Targets", icon: "smallcircle.filled.circle", reference: energyTargets, color: DashboardColor.fat),
            ], footer: .energyBalance)
        case .scaleWeight:
            let points = DailyCombine.mean.combine(weighIns.map { DatedValue(date: $0.date, value: $0.kg) }, calendar: calendar)
            return MetricDetail(title: "Scale Weight", tabs: [MetricTab(
                title: "Scale Weight", points: weight(points), unit: unit.rawValue, averageTitle: "Average",
                summary: .change, style: .line, color: DashboardColor.scale
            )], footer: .weighIns(weighIns.reversed()))
        case .steps:
            return MetricDetail(title: "Steps", tabs: [MetricTab(
                title: "Steps", points: steps, unit: "steps", averageTitle: "Average Steps",
                summary: .total, style: .bar, color: DashboardColor.workouts
            )], footer: .months)
        case let .muscle(muscle, _):
            return MetricDetail(title: muscle.displayName, tabs: [MuscleMetric.sets, .volume].map { metric in
                MetricTab(
                    title: metric.title, icon: metric == .sets ? "arrow.right.circle.fill" : "scalemass.fill",
                    points: DailyCombine.sum.combine(self.muscle(muscle, metric), calendar: calendar),
                    unit: metric.unit(unit), averageTitle: "Average \(metric.title)", summary: .total,
                    style: .bar, color: DashboardColor.muscle
                )
            }, footer: .months)
        case let .exercise(id, _):
            let series = DashboardMetrics.exercise(id, sessions: sessions, catalog: catalog)
            return MetricDetail(title: catalog(id)?.name ?? "Unknown exercise", tabs: ExerciseChartMetric.allCases.map { metric in
                MetricTab(
                    title: metric.title, points: metric.dailyCombine.combine(convert(series[metric] ?? [], metric), calendar: calendar),
                    unit: metric.unit(unit), averageTitle: "Avg \(metric.title)",
                    summary: .best, style: metric == .totalSets ? .bar : .line, color: DashboardColor.exercise
                )
            }, footer: .months)
        case let .nutrient(id):
            return nutrientDetail(id)
        case .macros:
            return macrosDetail
        case let .bodyMetric(card):
            return bodyMetricDetail(card)
        case .allMuscles, .allExercises, .customize, .goalProgress, .foodLogging, .nutritionData, .allNutrition, .allBodyMetrics:
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
        case muscleCard(MuscleCard), exerciseCard(ExerciseCard), workoutsCard, trendCard, scaleWeightCard, stepsCard
        case weighInHabit, workoutHabit, records(ExerciseRecord.Kind), trained
        case cycle(DashboardMetrics.CycleScope, Program?, [WorkoutTemplate])
        case detail(DashboardRoute), plot(DashboardRoute, MetricTab.ID?, ChartRange, Averaging)
        case expenditureDays, expenditureCard, balance(BalanceReference, days: Int), week, todayNutrition, foodLogging
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
            if usesNutrition {
                data.steps = NutritionMetrics.steps(health: health.steps, imported: nutrition.importedSteps, calendar: context.calendar)
                data.log = nutrition.log
                data.plans = nutrition.plans
                data.nutritionSettings = nutrition.settings
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
    var week: [NutritionMetrics.DayNutrition] { memo(.week, usesNutrition: true) { $0.week } }
    var todayNutrition: NutritionMetrics.DayNutrition { memo(.todayNutrition, usesNutrition: true) { $0.todayNutrition } }
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
    var stepsCard: CardValues { memo(.stepsCard, usesNutrition: true) { $0.stepsCard } }
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

extension MuscleMetric {
    var title: String {
        switch self {
        case .sets: "Sets"
        case .volume: "Volume"
        }
    }

    func unit(_ weight: WeightUnit) -> String { self == .sets ? "sets" : weight.rawValue }
}

extension ExerciseChartMetric {
    var title: String {
        switch self {
        case .oneRM: "1-RM"
        case .threeRM: "3-RM"
        case .tenRM: "10-RM"
        case .heaviestWeight: "Heaviest Weight"
        case .totalVolume: "Total Volume"
        case .bestSetVolume: "Best Set Volume"
        case .totalReps: "Total Reps"
        case .bestSetReps: "Best Set Reps"
        case .totalSets: "Total Sets"
        }
    }

    func unit(_ weight: WeightUnit) -> String {
        switch self {
        case .totalReps, .bestSetReps: "reps"
        case .totalSets: "sets"
        default: weight.rawValue
        }
    }

    var dailyCombine: DailyCombine {
        switch self {
        case .totalVolume, .totalReps, .totalSets: .sum
        case .oneRM, .threeRM, .tenRM, .heaviestWeight, .bestSetVolume, .bestSetReps: .max
        }
    }

    var isWeight: Bool {
        switch self {
        case .oneRM, .threeRM, .tenRM, .heaviestWeight, .totalVolume, .bestSetVolume: true
        case .totalReps, .bestSetReps, .totalSets: false
        }
    }
}

extension Double {
    var dashboardText: String { formatted(.number.precision(.fractionLength(0...1))) }
}
