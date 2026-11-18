import Foundation

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
    var expenditureSettings = NutritionSettings.Expenditure()
    var heightUnit = NutritionSettings.HeightUnit.feetAndInches
    var expenditure: [NutritionEngine.ExpenditureDay] = []
    var goals: [NutrientGoal] = []
    var bodyMetrics: [BodyMetric] = []
    var profile = ProfileSettings()
    var flights: [DatedValue] = []
    var meters: [DatedValue] = []

    var trend: [DatedValue] {
        NutritionEngine.TrendWeight.daily(weighIns: weighIns.points, through: now, calendar: calendar)
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

    func convert(_ points: [DatedValue], _ metric: ExerciseChartMetric) -> [DatedValue] {
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

    var stepGoal: StepGoal.Summary {
        StepGoal.summary(steps, goal: profile.dailyStepGoal, today: now, calendar: calendar)
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
                exerciseID: record.exerciseID, name: catalog(record.exerciseID)?.name ?? Exercise.unknownName,
                label: label, fraction: record.value / top
            )
        }
    }

    /// Newest first.
    var trainedExercises: [ExerciseID] {
        sessions.sorted { $0.startedAt > $1.startedAt }.flatMap { $0.blocks.flatMap(\.exercises).map(\.exerciseID) }.firstOccurrences()
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

extension Array where Element: Hashable {
    func firstOccurrences() -> [Element] {
        var seen = Set<Element>()
        return filter { seen.insert($0).inserted }
    }
}
