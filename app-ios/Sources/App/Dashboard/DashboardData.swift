import SwiftUI

enum DashboardRoute: Hashable {
    case workouts, weightTrend, scaleWeight, steps
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
}

struct MetricTab: Identifiable {
    enum Style { case bar, line }

    var title: String
    var icon: String?
    var points: [DatedValue]
    var unit: String
    var averageTitle: String
    var summary: SummaryKind
    var style: Style
    var color: Color

    var id: String { title }
}

struct MetricDetail {
    enum Footer {
        case months
        case weighIns([WeighIn])
        case topExercises([(exerciseID: ExerciseID, sets: Int)])
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

    var trend: [DatedValue] {
        WeightTrend.daily(weighIns.map { DatedValue(date: $0.date, value: $0.kg) }, through: now, calendar: calendar)
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
            return MetricDetail(title: "Weight Trend", tabs: [MetricTab(
                title: "Trend Weight", points: weight(trend), unit: unit.rawValue, averageTitle: "Average",
                summary: .change, style: .line, color: DashboardColor.trend
            )], footer: .months)
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
        case .allMuscles, .allExercises, .customize:
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
