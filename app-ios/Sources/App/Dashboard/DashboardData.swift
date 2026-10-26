import SwiftUI

enum DashboardRoute: Hashable {
    case workouts, weightTrend, scaleWeight, steps
    case expenditure, energyBalance, goalProgress, foodLogging, nutritionData
    case muscle(Muscle, MuscleMetric)
    case exercise(ExerciseID, ExerciseChartMetric)
    case allMuscles, allExercises, customize
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
}

struct MetricDetail {
    enum Footer {
        case months
        case weighIns([WeighIn])
        case topExercises([(exerciseID: ExerciseID, sets: Int)])
        case expenditure, weightTrend, energyBalance
    }

    var title: String
    var tabs: [MetricTab]
    var footer: Footer
}

/// Weights are stored in kilograms and converted to the owner's unit here, once, for every chart.
struct DashboardData {
    var sessions: [WorkoutSession]
    var weighIns: [WeighIn]
    var steps: [DatedValue]
    var unit: WeightUnit
    var catalog: (ExerciseID) -> Exercise?
    var now = Date.now
    var calendar = Calendar.current
    var log: [NutritionLogDay] = []
    var plans: [NutritionPlan] = []
    var nutritionSettings = NutritionSettings()
    var expenditure: [NutritionEngine.ExpenditureDay] = []

    var trend: [DatedValue] {
        WeightTrend.daily(weighIns.map { DatedValue(date: $0.date, value: $0.kg) }, through: now, calendar: calendar)
    }

    var today: CalendarDay { CalendarDay(now, in: calendar) }

    var intake: [DatedValue] { NutritionMetrics.intake(log, calendar: calendar) }

    var expenditurePoints: [DatedValue] { expenditure.map { DatedValue(date: $0.date, value: $0.kcal) } }

    var energyTargets: [DatedValue] { NutritionMetrics.energyTargets(plans, through: today, calendar: calendar) }

    var goalPlan: NutritionPlan? { NutritionPlan.effective(on: today, in: plans) }

    /// Intake bars against a dashed reference, with the range's mean difference as the one stat.
    private func balanceTab(_ title: String, icon: String, reference: [DatedValue], color: Color) -> MetricTab {
        let differences = NutritionMetrics.differences(intake: intake, reference: reference, calendar: calendar)
        let isExpenditure = title == "Expenditure"
        return MetricTab(
            title: title, icon: icon, points: intake, unit: "kcal", averageTitle: "Average", summary: .total, style: .bar,
            color: DashboardColor.energy,
            overlay: MetricTab.Overlay(title: isExpenditure ? "Expenditure" : "Targets", points: reference, color: color, dashed: true),
            stats: { interval in
                let mean = differences.inside(interval).average
                guard isExpenditure else { return [MetricTab.Stat(title: "Average", value: mean)] }
                return [MetricTab.Stat(title: (mean ?? 0) > 0 ? "Surplus" : "Deficit", value: mean.map(abs))]
            }
        )
    }

    func weight(_ points: [DatedValue]) -> [DatedValue] {
        points.map { DatedValue(date: $0.date, value: unit.fromKg($0.value)) }
    }

    func lastDays(_ points: [DatedValue], count: Int = 7) -> [Double] {
        let days = DailyCombine.sum.combine(points, calendar: calendar)
        let today = calendar.startOfDay(for: now)
        return (0..<count).reversed().map { offset in
            let day = calendar.date(byAdding: .day, value: -offset, to: today)!
            return days.first { $0.date == day }?.value ?? 0
        }
    }

    func muscleUnit(_ metric: MuscleMetric) -> String { metric == .sets ? "sets" : unit.rawValue }

    func muscle(_ muscle: Muscle, _ metric: MuscleMetric) -> [DatedValue] {
        let points = DashboardMetrics.muscle(muscle, sessions: sessions, metric: metric, catalog: catalog)
        return metric == .volume ? weight(points) : points
    }

    func exercise(_ id: ExerciseID, _ metric: ExerciseChartMetric) -> [DatedValue] {
        let points = DashboardMetrics.exercise(id, sessions: sessions, metric: metric, catalog: catalog)
        return metric.isWeight ? weight(points) : points
    }

    func exerciseUnit(_ metric: ExerciseChartMetric) -> String {
        switch metric {
        case .totalReps, .bestSetReps: "reps"
        case .totalSets: "sets"
        default: unit.rawValue
        }
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
            let scale = DailyCombine.mean.combine(weighIns.map { DatedValue(date: $0.date, value: $0.kg) }, calendar: calendar)
            return MetricDetail(title: "Weight Trend", tabs: [MetricTab(
                title: "Trend Weight", points: weight(trend), unit: unit.rawValue, averageTitle: "Average",
                summary: .change, style: .line, color: DashboardColor.trend,
                overlay: MetricTab.Overlay(title: "Scale Weight", points: weight(scale), color: DashboardColor.scaleOnTrend)
            )], footer: .weightTrend)
        case .expenditure:
            return MetricDetail(title: "Expenditure", tabs: [MetricTab(
                title: "Expenditure", points: expenditurePoints, unit: "kcal", averageTitle: "Average",
                summary: .change, style: .line, color: DashboardColor.expenditure,
                holding: Set(expenditure.filter(\.isHolding).map(\.date))
            )], footer: .expenditure)
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
                    unit: muscleUnit(metric), averageTitle: "Average \(metric.title)", summary: .total,
                    style: .bar, color: DashboardColor.muscle
                )
            }, footer: .months)
        case let .exercise(id, _):
            return MetricDetail(title: catalog(id)?.name ?? "Unknown exercise", tabs: ExerciseChartMetric.allCases.map { metric in
                MetricTab(
                    title: metric.title, points: metric.dailyCombine.combine(exercise(id, metric), calendar: calendar),
                    unit: exerciseUnit(metric), averageTitle: "Avg \(metric.title)",
                    summary: .best, style: metric == .totalSets ? .bar : .line, color: DashboardColor.exercise
                )
            }, footer: .months)
        case .allMuscles, .allExercises, .customize, .goalProgress, .foodLogging, .nutritionData:
            preconditionFailure("\(route) is not a metric detail")
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
