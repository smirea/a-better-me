import Foundation

enum DashboardMetrics {
    static func workingSets(_ items: [BlockExercise]) -> [WorkoutSet] {
        items.flatMap(\.sets).filter { $0.isCompleted && $0.type.isWorking }
    }


    enum WorkoutMetric: String, CaseIterable {
        case sets = "Sets", volume = "Volume"
    }

    static func workouts(_ sessions: [WorkoutSession], metric: WorkoutMetric, catalog: (ExerciseID) -> Exercise?) -> [DatedValue] {
        sessions.filter { $0.endedAt != nil }.map { session in
            let items = session.blocks.flatMap(\.exercises)
            let value = switch metric {
            case .sets: Double(workingSets(items).count)
            case .volume: WorkoutMetrics.volumeKg(of: items, catalog: catalog)
            }
            return DatedValue(date: session.startedAt, value: value)
        }
        .sorted { $0.date < $1.date }
    }

    static func topExercises(_ sessions: [WorkoutSession], since: Date, limit: Int = 5) -> [(exerciseID: ExerciseID, sets: Int)] {
        var counts: [ExerciseID: Int] = [:]
        for session in sessions where session.endedAt != nil && session.startedAt >= since {
            for item in session.blocks.flatMap(\.exercises) {
                counts[item.exerciseID, default: 0] += workingSets([item]).count
            }
        }
        return counts.filter { $0.value > 0 }
            .map { (exerciseID: $0.key, sets: $0.value) }
            .sorted { ($0.sets, $1.exerciseID) > ($1.sets, $0.exerciseID) }
            .prefix(limit)
            .map { $0 }
    }


    /// Volume splits like muscle sets: all of it to each primary muscle and half to each secondary.
    static func muscle(_ muscle: Muscle, sessions: [WorkoutSession], metric: MuscleMetric, catalog: (ExerciseID) -> Exercise?) -> [DatedValue] {
        sessions.filter { $0.endedAt != nil }.compactMap { session in
            let value = switch metric {
            case .sets: WorkoutMetrics.muscleSets(in: session.blocks, catalog: catalog, loggedOnly: true)[muscle] ?? 0
            case .volume: session.blocks.flatMap(\.exercises).reduce(0) { total, item in
                guard let exercise = catalog(item.exerciseID) else { return total }
                return total + WorkoutMetrics.share(of: muscle, in: exercise) * WorkoutMetrics.volumeKg(of: [item], catalog: catalog)
            }
            }
            return value > 0 ? DatedValue(date: session.startedAt, value: value) : nil
        }
        .sorted { $0.date < $1.date }
    }


    /// Every chart metric of one exercise in one pass over the history, oldest first.
    static func exercise(_ id: ExerciseID, sessions: [WorkoutSession], catalog: (ExerciseID) -> Exercise?) -> [ExerciseChartMetric: [DatedValue]] {
        guard let exercise = catalog(id) else { return [:] }
        var series: [ExerciseChartMetric: [DatedValue]] = [:]
        for session in sessions where session.endedAt != nil {
            let items = session.blocks.flatMap(\.exercises).filter { $0.exerciseID == id }
            for (metric, value) in values(of: items, exercise: exercise) {
                series[metric, default: []].append(DatedValue(date: session.startedAt, value: value))
            }
        }
        return series.mapValues { $0.sorted { $0.date < $1.date } }
    }

    /// Empty when the items have no working set; a metric is missing when the sets don't measure it.
    static func values(of items: [BlockExercise], exercise: Exercise) -> [ExerciseChartMetric: Double] {
        let working = workingSets(items)
        guard !working.isEmpty else { return [:] }
        let stats = SessionRecords.stats(of: items, exercise: exercise)
        let logs = working.flatMap { [$0.log] + $0.subSets.map(\.log) }.compactMap { $0 }
        let values: [ExerciseChartMetric: Double?] = [
            .oneRM: stats.bestOneRepMaxKg,
            .threeRM: stats.bestOneRepMaxKg.map { WorkoutMetrics.estimatedRepMaxKg(oneRepMaxKg: $0, reps: 3) },
            .tenRM: stats.bestOneRepMaxKg.map { WorkoutMetrics.estimatedRepMaxKg(oneRepMaxKg: $0, reps: 10) },
            .heaviestWeight: logs.compactMap(\.weightKg).max(),
            .totalVolume: stats.volumeKg > 0 ? stats.volumeKg : nil,
            .bestSetVolume: working.map { WorkoutMetrics.volumeKg(of: $0, exercise: exercise) }.max().flatMap { $0 > 0 ? $0 : nil },
            .totalReps: logs.compactMap(\.reps).reduce(0, +).nonZero.map(Double.init),
            .bestSetReps: stats.bestReps.map(Double.init),
            .totalSets: Double(working.count),
        ]
        return values.compactMapValues { $0 }
    }


    static func habitDays(_ dates: [Date], count: Int = 30, now: Date, calendar: Calendar) -> [Bool] {
        let days = Set(dates.map { calendar.startOfDay(for: $0) })
        let today = calendar.startOfDay(for: now)
        return (0..<count).reversed().map { days.contains(calendar.date(byAdding: .day, value: -$0, to: today)!) }
    }

    static func daysThisWeek(_ dates: [Date], now: Date, calendar: Calendar) -> Int {
        Set(dates.filter { calendar.isDate($0, equalTo: now, toGranularity: .weekOfYear) }.map { calendar.startOfDay(for: $0) }).count
    }
}

private extension Int {
    var nonZero: Int? { self == 0 ? nil : self }
}
